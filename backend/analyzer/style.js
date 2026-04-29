/**
 * analyzer/style.js
 *
 * Analisa convenções de estilo e padronização do código.
 * Coisas como nomenclatura, uso de var/let/const, tamanho de linhas, etc.
 *
 * LIMITAÇÕES:
 * - Não substitui um linter real como ESLint com regras do seu projeto.
 * - Regras de estilo são convenções — nem sempre há certo/errado absoluto.
 */

const { traverse } = require('./parser');

const STYLE_CONFIG = {
  maxLineLength: 100,
  preferConst: true,
  namingConventions: {
    variables: 'camelCase',
    constants: 'UPPER_SNAKE_CASE',
    classes: 'PascalCase',
    functions: 'camelCase',
  },
};

function isCamelCase(name) {
  return /^[a-z][a-zA-Z0-9]*$/.test(name);
}

function isPascalCase(name) {
  return /^[A-Z][a-zA-Z0-9]*$/.test(name);
}

function isUpperSnakeCase(name) {
  return /^[A-Z][A-Z0-9_]*$/.test(name);
}

function detectVarUsage(ast) {
  const issues = [];

  traverse(ast, {
    VariableDeclaration(node) {
      if (node.kind === 'var') {
        issues.push({
          type: 'var_usage',
          severity: 'warning',
          line: node.loc?.start?.line,
          message:
            'Uso de "var" detectado. "var" tem escopo de função e hoisting, o que pode causar comportamentos inesperados.',
          recommendation: 'Substitua por "const" (padrão) ou "let" (quando precisa reatribuir).',
        });
      }
    },
  });

  return issues;
}

function detectLetInsteadOfConst(ast) {
  if (!STYLE_CONFIG.preferConst) return [];
  const issues = [];

  // Detecta "let" em variáveis que nunca são reassinadas
  // Heurística simplificada: coleta todos os "let" e verifica se há AssignmentExpression com o mesmo nome
  const letDeclarations = new Map();

  traverse(ast, {
    VariableDeclaration(node) {
      if (node.kind === 'let') {
        node.declarations.forEach((decl) => {
          if (decl.id?.name) {
            letDeclarations.set(decl.id.name, {
              line: node.loc?.start?.line,
              reassigned: false,
            });
          }
        });
      }
    },
    AssignmentExpression(node) {
      const name = node.left?.name;
      if (name && letDeclarations.has(name)) {
        letDeclarations.get(name).reassigned = true;
      }
    },
    UpdateExpression(node) {
      const name = node.argument?.name;
      if (name && letDeclarations.has(name)) {
        letDeclarations.get(name).reassigned = true;
      }
    },
  });

  for (const [name, info] of letDeclarations.entries()) {
    if (!info.reassigned) {
      issues.push({
        type: 'prefer_const',
        severity: 'info',
        line: info.line,
        message: `Variável "${name}" declarada com "let" mas nunca reatribuída. Prefira "const".`,
        recommendation: 'Use const para variáveis que não mudam de referência.',
      });
    }
  }

  return issues;
}

function detectNamingIssues(ast) {
  const issues = [];

  traverse(ast, {
    VariableDeclarator(node) {
      const name = node.id?.name;
      if (!name || name.length <= 1) return; // ignora nomes de 1 char (i, j, k em loops)

      // Se é constante (const) e multiword, verifica se é UPPER_SNAKE_CASE ou camelCase
      // Aqui usamos heurística: se pai é VariableDeclaration com kind='const' e tem underscore
      // é provável que deveria ser UPPER_SNAKE_CASE
      if (!isCamelCase(name) && !isUpperSnakeCase(name) && !isPascalCase(name)) {
        issues.push({
          type: 'naming_convention',
          severity: 'info',
          line: node.loc?.start?.line,
          message: `Variável "${name}" não segue camelCase, PascalCase ou UPPER_SNAKE_CASE.`,
          recommendation:
            'Variáveis comuns: camelCase. Constantes globais: UPPER_SNAKE_CASE. Classes: PascalCase.',
        });
      }
    },

    FunctionDeclaration(node) {
      const name = node.id?.name;
      if (name && !isCamelCase(name) && !isPascalCase(name)) {
        issues.push({
          type: 'naming_convention',
          severity: 'info',
          line: node.loc?.start?.line,
          message: `Função "${name}" não segue camelCase. Funções devem começar com letra minúscula.`,
          recommendation: 'Use camelCase para funções. Ex: getUserById, not GetUserById.',
        });
      }
    },

    ClassDeclaration(node) {
      const name = node.id?.name;
      if (name && !isPascalCase(name)) {
        issues.push({
          type: 'naming_convention',
          severity: 'warning',
          line: node.loc?.start?.line,
          message: `Classe "${name}" não está em PascalCase. Classes DEVEM usar PascalCase.`,
          recommendation: `Renomeie para "${name.charAt(0).toUpperCase() + name.slice(1)}".`,
        });
      }
    },
  });

  return issues;
}

function detectLongLines(code) {
  const issues = [];
  const lines = code.split('\n');

  lines.forEach((line, index) => {
    if (line.length > STYLE_CONFIG.maxLineLength) {
      issues.push({
        type: 'long_line',
        severity: 'info',
        line: index + 1,
        message: `Linha ${index + 1} tem ${line.length} caracteres (limite: ${STYLE_CONFIG.maxLineLength}).`,
        recommendation: 'Quebre linhas longas para melhorar a legibilidade.',
      });
    }
  });

  return issues;
}

function detectConsoleLog(ast) {
  const issues = [];

  traverse(ast, {
    CallExpression(node) {
      if (
        node.callee?.type === 'MemberExpression' &&
        node.callee?.object?.name === 'console' &&
        ['log', 'warn', 'error', 'debug'].includes(node.callee?.property?.name)
      ) {
        const method = node.callee.property.name;
        if (method === 'log') {
          issues.push({
            type: 'console_log',
            severity: 'info',
            line: node.loc?.start?.line,
            message: 'console.log() encontrado. Logs de debug não devem ir para produção.',
            recommendation:
              'Use uma biblioteca de logging (winston, pino) ou remova logs de debug antes do deploy.',
          });
        }
      }
    },
  });

  return issues;
}

function analyzeStyle(ast, code) {
  const allIssues = [
    ...detectVarUsage(ast),
    ...detectLetInsteadOfConst(ast),
    ...detectNamingIssues(ast),
    ...detectLongLines(code),
    ...detectConsoleLog(ast),
  ];

  const warnings = allIssues.filter((i) => i.severity === 'warning');
  const infos = allIssues.filter((i) => i.severity === 'info');

  let score = 100;
  score -= warnings.length * 5;
  score -= infos.length * 2;
  score = Math.max(0, score);

  return {
    score,
    total: allIssues.length,
    counts: { warnings: warnings.length, infos: infos.length },
    issues: allIssues,
    config: STYLE_CONFIG,
  };
}

module.exports = { analyzeStyle };
