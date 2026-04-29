/**
 * analyzer/testability.js
 *
 * Avalia o quão fácil é escrever testes para o código.
 * Código testável tende a ser mais modular, desacoplado e previsível.
 *
 * Principais fatores analisados:
 * - Funções puras vs funções com efeitos colaterais
 * - Dependências hardcoded (new AlgumaCoisa() dentro de funções)
 * - Exportações (código exportado é mais testável)
 * - Tamanho das funções (funções menores são mais fáceis de testar)
 */

const { traverse } = require('./parser');

function detectHardcodedDependencies(ast) {
  const issues = [];

  // new Dependency() dentro de uma função = dependência hardcoded = difícil de mockar
  let insideFunction = false;

  function walk(node) {
    if (!node || typeof node !== 'object') return;

    const isFunction =
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression';

    if (isFunction) {
      const wasInside = insideFunction;
      insideFunction = true;

      if (
        node.type === 'NewExpression' &&
        insideFunction &&
        // Ignora new Promise(), new Error(), new Map(), new Set() — são primitivos
        !['Promise', 'Error', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Date', 'RegExp'].includes(
          node.callee?.name
        )
      ) {
        issues.push({
          type: 'hardcoded_dependency',
          severity: 'warning',
          line: node.loc?.start?.line,
          message: `Instanciação de "${node.callee?.name}" hardcoded dentro de função. Dificulta testes (não dá pra mockar).`,
          recommendation:
            'Injete dependências como parâmetros (Dependency Injection). Ex: function foo(dep) { dep.doSomething() }',
        });
      }

      for (const key of Object.keys(node)) {
        const child = node[key];
        if (Array.isArray(child)) child.forEach(walk);
        else if (child && typeof child === 'object' && child.type) walk(child);
      }

      insideFunction = wasInside;
      return;
    }

    if (
      node.type === 'NewExpression' &&
      insideFunction &&
      !['Promise', 'Error', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Date', 'RegExp'].includes(
        node.callee?.name
      )
    ) {
      issues.push({
        type: 'hardcoded_dependency',
        severity: 'warning',
        line: node.loc?.start?.line,
        message: `Instanciação de "${node.callee?.name}" hardcoded dentro de função.`,
        recommendation: 'Injete dependências via parâmetros para facilitar testes com mocks.',
      });
    }

    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) child.forEach(walk);
      else if (child && typeof child === 'object' && child.type) walk(child);
    }
  }

  walk(ast);
  return issues;
}

function detectGlobalStateMutation(ast) {
  const issues = [];

  // Detecta modificação de variáveis declaradas fora do escopo da função
  // Heurística: atribuição a propriedades de objetos globais conhecidos
  const globalObjects = new Set(['global', 'globalThis', 'window', 'process']);

  traverse(ast, {
    AssignmentExpression(node) {
      const objName = node.left?.object?.name;
      if (objName && globalObjects.has(objName)) {
        issues.push({
          type: 'global_state_mutation',
          severity: 'warning',
          line: node.loc?.start?.line,
          message: `Mutação de estado global em "${objName}". Funções que modificam estado global são difíceis de testar.`,
          recommendation:
            'Prefira funções puras que recebem tudo via parâmetros e retornam o resultado.',
        });
      }
    },
  });

  return issues;
}

function analyzeExports(ast) {
  let hasExports = false;
  let exportCount = 0;

  traverse(ast, {
    AssignmentExpression(node) {
      // module.exports = ...
      if (
        node.left?.type === 'MemberExpression' &&
        node.left?.object?.name === 'module' &&
        node.left?.property?.name === 'exports'
      ) {
        hasExports = true;
        exportCount++;
      }
      // exports.foo = ...
      if (node.left?.object?.name === 'exports') {
        hasExports = true;
        exportCount++;
      }
    },
    ExportDefaultDeclaration: () => {
      hasExports = true;
      exportCount++;
    },
    ExportNamedDeclaration: () => {
      hasExports = true;
      exportCount++;
    },
  });

  return { hasExports, exportCount };
}

function countPureFunctions(ast) {
  let total = 0;
  let likelyPure = 0;

  traverse(ast, {
    FunctionDeclaration(node) {
      total++;
      if (isFunctionLikelyPure(node)) likelyPure++;
    },
    FunctionExpression(node) {
      total++;
      if (isFunctionLikelyPure(node)) likelyPure++;
    },
    ArrowFunctionExpression(node) {
      total++;
      if (isFunctionLikelyPure(node)) likelyPure++;
    },
  });

  return { total, likelyPure };
}

function isFunctionLikelyPure(node) {
  // Heurística: função é provavelmente pura se:
  // 1. Não tem chamadas a funções externas não matemáticas
  // 2. Não tem await (sem I/O)
  // 3. Tem return com valor
  // Esta é uma heurística MUITO simplificada.
  let hasAwait = false;
  let hasSideEffect = false;

  const sideEffectCalls = new Set([
    'console', 'fetch', 'axios', 'require', 'setTimeout', 'setInterval',
  ]);

  traverse(node.body || node, {
    AwaitExpression: () => { hasAwait = true; },
    CallExpression(n) {
      const obj = n.callee?.object?.name;
      if (obj && sideEffectCalls.has(obj)) hasSideEffect = true;
    },
  });

  return !hasAwait && !hasSideEffect;
}

function analyzeTestability(ast) {
  const dependencyIssues = detectHardcodedDependencies(ast);
  const globalStateIssues = detectGlobalStateMutation(ast);
  const { hasExports, exportCount } = analyzeExports(ast);
  const { total: totalFunctions, likelyPure } = countPureFunctions(ast);

  const allIssues = [...dependencyIssues, ...globalStateIssues];

  if (!hasExports && totalFunctions > 0) {
    allIssues.push({
      type: 'no_exports',
      severity: 'warning',
      line: null,
      message: 'Nenhum export detectado. Funções não exportadas não podem ser testadas diretamente.',
      recommendation: 'Exporte as funções que precisam de teste com module.exports ou export.',
    });
  }

  const pureRatio = totalFunctions > 0 ? likelyPure / totalFunctions : 0;

  let score = 100;
  score -= allIssues.filter((i) => i.severity === 'warning').length * 10;
  score -= Math.round((1 - pureRatio) * 20); // penaliza por baixa proporção de funções puras
  if (!hasExports && totalFunctions > 0) score -= 15;
  score = Math.max(0, score);

  return {
    score,
    disclaimer:
      'Testabilidade é avaliada por heurísticas de estrutura. Código pode ser testável mesmo com algumas flags.',
    total: allIssues.length,
    functions: {
      total: totalFunctions,
      likelyPure,
      pureRatio: Math.round(pureRatio * 100),
    },
    exports: { hasExports, exportCount },
    issues: allIssues,
  };
}

module.exports = { analyzeTestability };
