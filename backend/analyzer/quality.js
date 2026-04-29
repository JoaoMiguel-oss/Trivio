/**
 * analyzer/quality.js
 *
 * Analisa a qualidade geral do código:
 * - Complexidade ciclomática (quantos caminhos de execução existem)
 * - Profundidade de aninhamento (quantos níveis de if/for dentro de if/for)
 * - Tamanho das funções (linhas e parâmetros)
 * - Uso de comentários
 *
 * LIMITAÇÕES:
 * - Complexidade ciclomática é calculada por heurística de contagem de nós,
 *   não pelo método McCabe completo (que exige grafo de fluxo de controle).
 * - Não detecta "dead code" dentro de fluxos complexos.
 */

const { traverse } = require('./parser');

// Limites configuráveis. Poderia vir de um arquivo de config no futuro.
const THRESHOLDS = {
  maxFunctionLines: 30,
  maxFunctionParams: 4,
  maxNestingDepth: 4,
  maxCyclomaticComplexity: 10,
  minCommentRatio: 0.05, // 5% das linhas deveriam ser comentários
};

/**
 * Nós da AST que aumentam a complexidade ciclomática.
 * Cada um representa uma bifurcação no fluxo de execução.
 */
const COMPLEXITY_NODES = new Set([
  'IfStatement',
  'ConditionalExpression',
  'LogicalExpression',
  'SwitchCase',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'CatchClause',
  'TryStatement',
]);

/**
 * Nós que representam blocos que aumentam o aninhamento.
 */
const NESTING_NODES = new Set([
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'SwitchStatement',
  'TryStatement',
  'CatchClause',
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

function analyzeFunctions(ast) {
  const functions = [];

  traverse(ast, {
    FunctionDeclaration(node) {
      functions.push(extractFunctionInfo(node));
    },
    FunctionExpression(node) {
      functions.push(extractFunctionInfo(node));
    },
    ArrowFunctionExpression(node) {
      functions.push(extractFunctionInfo(node));
    },
  });

  return functions;
}

function extractFunctionInfo(node) {
  const startLine = node.loc?.start?.line || 0;
  const endLine = node.loc?.end?.line || 0;
  const lines = endLine - startLine + 1;
  const params = node.params?.length || 0;
  const name =
    node.id?.name ||
    (node.type === 'ArrowFunctionExpression' ? '<arrow>' : '<anônima>');

  // Conta a complexidade ciclomática DENTRO desta função
  let complexity = 1; // começa em 1 (caminho padrão)
  traverse(node.body, {
    IfStatement: () => complexity++,
    ConditionalExpression: () => complexity++,
    LogicalExpression: (n) => {
      if (n.operator === '&&' || n.operator === '||') complexity++;
    },
    SwitchCase: () => complexity++,
    ForStatement: () => complexity++,
    ForInStatement: () => complexity++,
    ForOfStatement: () => complexity++,
    WhileStatement: () => complexity++,
    DoWhileStatement: () => complexity++,
    CatchClause: () => complexity++,
  });

  const issues = [];
  if (lines > THRESHOLDS.maxFunctionLines) {
    issues.push(
      `Função muito longa (${lines} linhas, limite: ${THRESHOLDS.maxFunctionLines})`
    );
  }
  if (params > THRESHOLDS.maxFunctionParams) {
    issues.push(
      `Muitos parâmetros (${params}, limite: ${THRESHOLDS.maxFunctionParams}). Considere agrupar em um objeto.`
    );
  }
  if (complexity > THRESHOLDS.maxCyclomaticComplexity) {
    issues.push(
      `Alta complexidade ciclomática (${complexity}). Divida em funções menores.`
    );
  }

  return { name, startLine, endLine, lines, params, complexity, issues };
}

function calculateNestingDepth(ast) {
  let maxDepth = 0;
  let currentDepth = 0;

  // Percorremos a AST manualmente para controlar profundidade de entrada/saída
  function walk(node) {
    if (!node || typeof node !== 'object') return;

    const isNestingNode = node.type && NESTING_NODES.has(node.type);
    if (isNestingNode) {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    }

    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(walk);
      } else if (child && typeof child === 'object' && child.type) {
        walk(child);
      }
    }

    if (isNestingNode) currentDepth--;
  }

  walk(ast);
  return maxDepth;
}

function analyzeComments(code) {
  const lines = code.split('\n');
  const totalLines = lines.length;

  // Conta linhas que contêm comentários (heurística simples)
  const commentLines = lines.filter((line) => {
    const trimmed = line.trim();
    return (
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*/')
    );
  }).length;

  const ratio = totalLines > 0 ? commentLines / totalLines : 0;
  return {
    commentLines,
    totalLines,
    ratio: Math.round(ratio * 100) / 100,
    adequate: ratio >= THRESHOLDS.minCommentRatio,
  };
}

function analyzeQuality(ast, code) {
  const functions = analyzeFunctions(ast);
  const nestingDepth = calculateNestingDepth(ast);
  const comments = analyzeComments(code);

  const functionsWithIssues = functions.filter((f) => f.issues.length > 0);

  const avgComplexity =
    functions.length > 0
      ? Math.round(
          (functions.reduce((s, f) => s + f.complexity, 0) / functions.length) * 10
        ) / 10
      : 0;

  const issues = [];

  if (nestingDepth > THRESHOLDS.maxNestingDepth) {
    issues.push(
      `Aninhamento muito profundo (${nestingDepth} níveis). Extraia lógica para funções.`
    );
  }
  if (!comments.adequate) {
    issues.push(
      `Baixa cobertura de comentários (${Math.round(comments.ratio * 100)}%). Documente suas funções e lógicas complexas.`
    );
  }

  // Score de qualidade: começa em 100 e vai perdendo pontos
  let score = 100;
  score -= Math.min(30, functionsWithIssues.length * 10);
  score -= Math.min(20, Math.max(0, nestingDepth - THRESHOLDS.maxNestingDepth) * 5);
  score -= Math.min(10, Math.max(0, (avgComplexity - 5) * 2));
  if (!comments.adequate) score -= 10;
  score = Math.max(0, score);

  return {
    score,
    functions: {
      total: functions.length,
      withIssues: functionsWithIssues.length,
      details: functions,
    },
    nestingDepth: {
      max: nestingDepth,
      acceptable: nestingDepth <= THRESHOLDS.maxNestingDepth,
    },
    complexity: {
      average: avgComplexity,
      acceptable: avgComplexity <= THRESHOLDS.maxCyclomaticComplexity,
    },
    comments,
    issues,
  };
}

module.exports = { analyzeQuality };
