/**
 * evaluator.js
 *
 * Executa código de candidatos em ambientes isolados.
 *
 * JavaScript → isolated-vm (V8 Isolate separado, zero acesso ao Node host)
 * Python     → child_process com restrições de timeout + sem acesso de rede/fs via flags
 */

const ivm = require('isolated-vm');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

const TIMEOUT_MS = 2000; // 2 segundos por caso de teste

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normaliza uma string de saída:
 * - Remove espaços/tabs/newlines no início e fim
 * - Normaliza quebras de linha para \n
 * - Remove trailing whitespace em cada linha
 */
function normalizeOutput(str) {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Sandbox JavaScript (isolated-vm)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Envolve o código do candidato para capturar saídas de console.log e simular
 * readline/input() via leitura de uma variável injetada.
 *
 * O isolate recebe '__INPUT__' como string global e expõe '__OUTPUT__' de volta.
 */
function buildJSWrapper(candidateCode) {
  return `
(function() {
  const __lines__ = typeof __INPUT__ === 'string' ? __INPUT__.split('\\n') : [];
  let __lineIdx__ = 0;
  let __output__ = [];

  // Substitui console.log
  const console = {
    log: (...args) => {
      __output__.push(args.map(String).join(' '));
    },
    error: (...args) => { /* silenciado */ },
    warn:  (...args) => { /* silenciado */ },
  };

  // Simula readline síncrono (linha a linha)
  function input(prompt) {
    return __lines__[__lineIdx__++] ?? '';
  }

  // Candidatos frequentemente chamam de formas diferentes
  const readline = {
    createInterface: () => ({
      question: (_, cb) => cb(__lines__[__lineIdx__++] ?? ''),
      close: () => {},
    }),
  };

  // ── Código do candidato ──────────────────────────────────────────────────
  ${candidateCode}
  // ────────────────────────────────────────────────────────────────────────

  __OUTPUT__ = __output__.join('\\n');
})();
`;
}

async function runJavaScript(code, inputStr) {
  const isolate = new ivm.Isolate({ memoryLimit: 32 }); // 32 MB

  try {
    const context = await isolate.createContext();
    const jail = context.global;

    // Injeta o input e um slot para o output
    await jail.set('__INPUT__', inputStr, { copy: true });
    await jail.set('__OUTPUT__', '', { copy: true });

    const wrappedCode = buildJSWrapper(code);
    const script = await isolate.compileScript(wrappedCode);

    await script.run(context, { timeout: TIMEOUT_MS });

    const output = await jail.get('__OUTPUT__', { copy: true });
    return { output: String(output), error: null };
  } catch (err) {
    if (err.message && err.message.includes('Script execution timed out')) {
      return { output: '', error: 'TIMEOUT' };
    }
    return { output: '', error: err.message };
  } finally {
    isolate.dispose();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sandbox Python (subprocess)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Executa Python em um processo filho com:
 * - timeout de 2 segundos (SIGKILL após isso)
 * - stdin alimentado com o input do teste
 * - sem acesso de rede (não há como bloquear no nível do SO sem Docker/seccomp
 *   aqui, mas bloqueamos imports perigosos via wrapper)
 */
function buildPythonWrapper(candidateCode) {
  // Bloqueia módulos de rede, SO e sistema de arquivos
  const BLOCKED_MODULES = [
    'socket', 'http', 'urllib', 'requests', 'httpx', 'aiohttp',
    'ftplib', 'smtplib', 'telnetlib', 'subprocess', 'multiprocessing',
    'threading', 'ctypes', 'cffi', 'importlib',
  ];

  const blockList = BLOCKED_MODULES.map(
    (m) => `"${m}": None`
  ).join(', ');

  return `
import sys
import builtins
import os

# ── Restrições ────────────────────────────────────────────────────────────────
_BLOCKED = {${blockList}}
_original_import = builtins.__import__

def _safe_import(name, *args, **kwargs):
    root = name.split('.')[0]
    if root in _BLOCKED:
        raise ImportError(f"Módulo '{name}' bloqueado pelo avaliador.")
    return _original_import(name, *args, **kwargs)

builtins.__import__ = _safe_import

# Bloqueia abertura de arquivos fora do /dev/null e /dev/stdin
_original_open = builtins.open
def _safe_open(file, mode='r', *args, **kwargs):
    file_str = str(file)
    if not file_str.startswith('/dev/'):
        raise PermissionError(f"Acesso ao sistema de arquivos bloqueado: '{file_str}'")
    return _original_open(file, mode, *args, **kwargs)

builtins.open = _safe_open

# ── Código do candidato ───────────────────────────────────────────────────────
${candidateCode}
`;
}

function runPython(code, inputStr) {
  return new Promise((resolve) => {
    const wrappedCode = buildPythonWrapper(code);

    // Escreve o wrapper em um arquivo temporário (evita problemas com aspas no -c)
    const tmpFile = path.join(os.tmpdir(), `trivio_${crypto.randomBytes(8).toString('hex')}.py`);

    try {
      fs.writeFileSync(tmpFile, wrappedCode, 'utf8');
    } catch (e) {
      return resolve({ output: '', error: `Erro ao criar arquivo temporário: ${e.message}` });
    }

    const child = spawn('python3', [tmpFile], {
      stdio: ['pipe', 'pipe', 'pipe'],
      // Sem herdar variáveis de ambiente sensíveis
      env: {
        PATH: process.env.PATH,
        LANG: 'en_US.UTF-8',
      },
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, TIMEOUT_MS);

    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));

    // Envia o input e fecha o stdin
    if (inputStr !== '') {
      child.stdin.write(inputStr);
    }
    child.stdin.end();

    child.on('close', () => {
      clearTimeout(timer);
      // Cleanup
      try { fs.unlinkSync(tmpFile); } catch (_) {}

      if (killed) {
        return resolve({ output: '', error: 'TIMEOUT' });
      }

      if (stderr.trim()) {
        // Retorna o stderr como erro mas sem vazar o caminho do arquivo temp
        const cleanErr = stderr.replace(tmpFile, '<code>');
        return resolve({ output: '', error: cleanErr.trim() });
      }

      resolve({ output: stdout, error: null });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      try { fs.unlinkSync(tmpFile); } catch (_) {}
      resolve({ output: '', error: err.message });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Orquestrador principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Avalia o código em todos os casos de teste sequencialmente.
 * Retorna array de resultados no formato esperado pelo spec da API.
 */
async function evaluateCode(language, code, tests) {
  const results = [];

  for (const testCase of tests) {
    const inputStr = String(testCase.input ?? '');
    const expectedStr = normalizeOutput(String(testCase.expected_output ?? ''));

    let runResult;
    if (language === 'javascript') {
      runResult = await runJavaScript(code, inputStr);
    } else if (language === 'python') {
      runResult = await runPython(code, inputStr);
    } else {
      runResult = { output: '', error: `Linguagem não suportada: ${language}` };
    }

    const actualStr = normalizeOutput(runResult.output);
    const passed = !runResult.error && actualStr === expectedStr;

    const result = {
      input: testCase.input,
      expected_output: testCase.expected_output,
      actual_output: runResult.error
        ? null
        : runResult.output.trimEnd(), // output original sem normalizar para exibição
      passed,
    };

    if (runResult.error) {
      result.error = runResult.error === 'TIMEOUT'
        ? 'Tempo limite excedido (2s)'
        : runResult.error;
    }

    results.push(result);
  }

  return results;
}

module.exports = { evaluateCode };
