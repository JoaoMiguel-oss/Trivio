// TRIVIO - EXECUTOR DE CÓDIGO
// Executa código submetido por candidatos em processo isolado,
// captura stdout e compara com output esperado dos casos de teste.
// RISCOS MVP: sem sandbox real (sem Docker/seccomp). Mitigações:
// timeout de 5s, processo filho isolado, arquivo temporário deletado.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Mapeamento de linguagem para comando e extensão de arquivo
const LINGUAGENS = {
    python: { cmd: 'python3', ext: '.py' },
    javascript: { cmd: 'node', ext: '.js' },
    js: { cmd: 'node', ext: '.js' },
};

/**
 * Executa um trecho de código com um input específico.
 * @param {string} codigo - Código-fonte do candidato
 * @param {string} linguagem - 'python' | 'javascript' | 'js'
 * @param {string} input - Texto enviado para stdin do processo
 * @param {number} timeout - Milissegundos antes de matar o processo (padrão 5000)
 * @returns {{ sucesso: boolean, output: string, erro: string, tempo: number }}
 */
function executarCodigo(codigo, linguagem, input = '', timeout = 5000) {
    return new Promise((resolve) => {
        const lang = linguagem ? linguagem.toLowerCase() : '';
        const config = LINGUAGENS[lang];

        if (!config) {
            return resolve({
                sucesso: false,
                output: '',
                erro: `Linguagem '${linguagem}' não suportada. Use: ${Object.keys(LINGUAGENS).join(', ')}`,
                tempo: 0,
            });
        }

        // Cria arquivo temporário único para não haver colisão entre execuções paralelas
        const nomeTemp = `trivio_${Date.now()}_${Math.random().toString(36).slice(2)}${config.ext}`;
        const caminhoTemp = path.join(os.tmpdir(), nomeTemp);

        try {
            fs.writeFileSync(caminhoTemp, codigo, 'utf8');
        } catch (err) {
            return resolve({ sucesso: false, output: '', erro: `Falha ao criar arquivo temp: ${err.message}`, tempo: 0 });
        }

        const inicio = Date.now();
        let stdout = '';
        let stderr = '';
        let encerrado = false;

        const processo = spawn(config.cmd, [caminhoTemp], {
            timeout,
            // Processo filho herda apenas o ambiente mínimo — sem acesso a env vars do backend
            env: { PATH: process.env.PATH },
        });

        // Timer manual de segurança (além do timeout do spawn)
        const timer = setTimeout(() => {
            if (!encerrado) {
                processo.kill('SIGKILL');
            }
        }, timeout + 500);

        if (input) {
            processo.stdin.write(input);
            processo.stdin.end();
        } else {
            processo.stdin.end();
        }

        processo.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
        processo.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

        processo.on('close', (code) => {
            encerrado = true;
            clearTimeout(timer);
            const tempo = Date.now() - inicio;

            // Deleta o arquivo temp independente do resultado
            try { fs.unlinkSync(caminhoTemp); } catch (_) {}

            resolve({
                sucesso: code === 0,
                output: stdout.trim(),
                erro: stderr.trim(),
                tempo,
            });
        });

        processo.on('error', (err) => {
            encerrado = true;
            clearTimeout(timer);
            try { fs.unlinkSync(caminhoTemp); } catch (_) {}

            resolve({
                sucesso: false,
                output: '',
                erro: `Erro ao executar processo: ${err.message}`,
                tempo: Date.now() - inicio,
            });
        });
    });
}

module.exports = { executarCodigo };
