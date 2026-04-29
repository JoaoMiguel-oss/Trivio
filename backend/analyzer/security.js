/**
 * analyzer/security.js
 *
 * Detecta padrões de código com potencial de vulnerabilidade de segurança.
 *
 * LIMITAÇÕES CRÍTICAS:
 * - Análise estática NÃO detecta todas as vulnerabilidades.
 * - Falsos positivos são comuns — avalie cada item no contexto.
 * - Não substitui uma auditoria de segurança real (pentest, SAST profissional).
 * - Não analisa configurações de runtime, variáveis de ambiente ou dependências.
 */

const { traverse } = require('./parser');

// Funções perigosas do Node.js/JavaScript
const DANGEROUS_FUNCTIONS = new Set([
  'eval',
  'Function',
  'setTimeout',  // quando recebe string
  'setInterval', // quando recebe string
  'execSync',
  'exec',
  'spawn',
  'execFile',
]);

// Módulos perigosos do Node.js (quando usados sem cuidado)
const DANGEROUS_MODULES = new Set([
  'child_process',
  'vm',
  'fs', // não é perigoso em si, mas merece atenção
]);

function detectEvalUsage(ast) {
  const issues = [];

  traverse(ast, {
    CallExpression(node) {
      const calleeName =
        node.callee?.name || node.callee?.property?.name;

      if (calleeName === 'eval') {
        issues.push({
          type: 'eval_usage',
          severity: 'critical',
          line: node.loc?.start?.line,
          message:
            'Uso de eval() detectado. Eval executa strings como código arbitrário, abrindo brechas para injeção de código (XSS, RCE). Evite completamente.',
          recommendation:
            'Use JSON.parse() para dados, ou refatore o código para não precisar de eval.',
        });
      }

      // new Function("código") é eval disfarçado
      if (
        node.callee?.type === 'MemberExpression' &&
        node.callee?.property?.name === 'Function'
      ) {
        issues.push({
          type: 'dynamic_function',
          severity: 'high',
          line: node.loc?.start?.line,
          message:
            'Construção de função dinâmica detectada. Similar ao eval() em termos de risco.',
          recommendation: 'Substitua por funções estáticas ou closures.',
        });
      }
    },

    NewExpression(node) {
      if (node.callee?.name === 'Function') {
        issues.push({
          type: 'new_function',
          severity: 'high',
          line: node.loc?.start?.line,
          message:
            'new Function() detectado. Equivalente ao eval() — executa código dinâmico.',
          recommendation: 'Refatore para não usar código dinâmico.',
        });
      }
    },
  });

  return issues;
}

function detectHardcodedSecrets(ast) {
  const issues = [];

  // Padrões de nomes de variáveis que costumam guardar segredos
  const secretPatterns = [
    /password/i,
    /passwd/i,
    /secret/i,
    /api[_-]?key/i,
    /token/i,
    /private[_-]?key/i,
    /auth/i,
  ];

  traverse(ast, {
    VariableDeclarator(node) {
      const name = node.id?.name || '';
      const isSecret = secretPatterns.some((p) => p.test(name));

      // Se o nome parece ser um segredo E o valor é uma string literal (hardcoded)
      if (isSecret && node.init?.type === 'StringLiteral') {
        const value = node.init.value;
        // Só reporta se não for placeholder/vazio
        if (value.length > 0 && !['xxx', 'todo', 'changeme', 'sua_senha'].includes(value.toLowerCase())) {
          issues.push({
            type: 'hardcoded_secret',
            severity: 'critical',
            line: node.loc?.start?.line,
            message: `Possível segredo hardcoded na variável "${name}". Credenciais não devem estar no código-fonte.`,
            recommendation:
              'Use variáveis de ambiente (process.env) e um arquivo .env fora do repositório.',
          });
        }
      }
    },

    AssignmentExpression(node) {
      const name = node.left?.property?.name || node.left?.name || '';
      const isSecret = secretPatterns.some((p) => p.test(name));

      if (isSecret && node.right?.type === 'StringLiteral') {
        const value = node.right.value;
        if (value.length > 3) {
          issues.push({
            type: 'hardcoded_secret',
            severity: 'critical',
            line: node.loc?.start?.line,
            message: `Possível segredo hardcoded em "${name}".`,
            recommendation: 'Use process.env para credenciais.',
          });
        }
      }
    },
  });

  return issues;
}

function detectCommandInjection(ast) {
  const issues = [];

  const shellFunctions = new Set(['exec', 'execSync', 'execFile', 'spawn', 'spawnSync']);

  traverse(ast, {
    CallExpression(node) {
      const callee = node.callee;

      // Detecta child_process.exec(...) ou exec() diretamente
      const fnName =
        callee?.property?.name || callee?.name;

      if (shellFunctions.has(fnName)) {
        const firstArg = node.arguments?.[0];

        // Se o primeiro argumento é uma template string ou concatenação, pode ser injeção
        if (
          firstArg?.type === 'TemplateLiteral' ||
          (firstArg?.type === 'BinaryExpression' && firstArg?.operator === '+')
        ) {
          issues.push({
            type: 'command_injection_risk',
            severity: 'critical',
            line: node.loc?.start?.line,
            message: `Chamada a "${fnName}" com argumento dinâmico. Risco de injeção de comando (Command Injection).`,
            recommendation:
              'Valide e sanitize todas as entradas do usuário. Use arrays de argumentos no spawn() ao invés de strings.',
          });
        } else {
          issues.push({
            type: 'shell_execution',
            severity: 'high',
            line: node.loc?.start?.line,
            message: `Execução de shell detectada via "${fnName}". Verifique se entradas do usuário chegam aqui.`,
            recommendation: 'Prefira APIs nativas do Node.js no lugar de comandos de shell.',
          });
        }
      }
    },
  });

  return issues;
}

function detectSqlPatterns(ast) {
  const issues = [];

  traverse(ast, {
    // Detecta strings SQL com concatenação dinâmica
    BinaryExpression(node) {
      if (node.operator !== '+') return;

      function hasSqlKeyword(n) {
        if (n?.type === 'StringLiteral' || n?.type === 'TemplateLiteral') {
          const val = n?.value || n?.quasis?.map((q) => q.value.raw).join('');
          return /\b(SELECT|INSERT|UPDATE|DELETE|DROP|WHERE)\b/i.test(val);
        }
        return false;
      }

      if (hasSqlKeyword(node.left) || hasSqlKeyword(node.right)) {
        issues.push({
          type: 'sql_injection_risk',
          severity: 'critical',
          line: node.loc?.start?.line,
          message:
            'Possível SQL construído por concatenação de string. Risco de SQL Injection.',
          recommendation:
            'Use prepared statements / query parameterizada. Nunca concatene input do usuário em SQL.',
        });
      }
    },

    TemplateLiteral(node) {
      const rawParts = node.quasis?.map((q) => q.value.raw).join('');
      if (/\b(SELECT|INSERT|UPDATE|DELETE|DROP|WHERE)\b/i.test(rawParts) && node.expressions?.length > 0) {
        issues.push({
          type: 'sql_injection_risk',
          severity: 'critical',
          line: node.loc?.start?.line,
          message:
            'Template literal com SQL e interpolações detectado. Risco de SQL Injection.',
          recommendation:
            'Use prepared statements. Ex: db.prepare("SELECT * FROM t WHERE id = ?").run(id)',
        });
      }
    },
  });

  return issues;
}

function analyzeSecurity(ast) {
  const allIssues = [
    ...detectEvalUsage(ast),
    ...detectHardcodedSecrets(ast),
    ...detectCommandInjection(ast),
    ...detectSqlPatterns(ast),
  ];

  const criticals = allIssues.filter((i) => i.severity === 'critical');
  const highs = allIssues.filter((i) => i.severity === 'high');
  const mediums = allIssues.filter((i) => i.severity === 'medium');

  let score = 100;
  score -= criticals.length * 25;
  score -= highs.length * 10;
  score -= mediums.length * 5;
  score = Math.max(0, score);

  return {
    score,
    disclaimer:
      'Análise estática detecta padrões conhecidos, mas não substitui auditoria de segurança profissional.',
    total: allIssues.length,
    counts: {
      critical: criticals.length,
      high: highs.length,
      medium: mediums.length,
    },
    issues: allIssues,
  };
}

module.exports = { analyzeSecurity };
