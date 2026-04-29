/**
 * analyzer/performance.js
 *
 * Detecta padrões de código com potencial impacto negativo em performance.
 *
 * LIMITAÇÕES:
 * - Análise estática não pode medir performance real (isso exige profiler).
 * - Apenas detecta padrões conhecidos por serem ineficientes em geral.
 * - Contexto importa: um .find() num array de 3 itens é irrelevante.
 */

const { traverse } = require('./parser');

function detectNestedLoops(ast) {
  const issues = [];

  const loopTypes = new Set([
    'ForStatement',
    'ForInStatement',
    'ForOfStatement',
    'WhileStatement',
    'DoWhileStatement',
  ]);

  function walk(node, depth = 0) {
    if (!node || typeof node !== 'object') return;

    const isLoop = node.type && loopTypes.has(node.type);
    if (isLoop) {
      depth++;
      if (depth >= 2) {
        issues.push({
          type: 'nested_loop',
          severity: depth >= 3 ? 'high' : 'warning',
          line: node.loc?.start?.line,
          message: `Loop aninhado em ${depth} níveis detectado (complexidade O(n^${depth})). Pode ser lento com grandes volumes de dados.`,
          recommendation:
            'Considere usar Map/Set para lookups O(1), ou reformule o algoritmo.',
        });
      }
    }

    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach((item) => walk(item, depth));
      } else if (child && typeof child === 'object' && child.type) {
        walk(child, depth);
      }
    }
  }

  walk(ast);
  return issues;
}

function detectArrayInefficiency(ast) {
  const issues = [];

  // Detecta padrões como arr.find() dentro de loops, ou múltiplos .filter().map()
  const arrayMethods = new Set(['find', 'findIndex', 'includes', 'indexOf', 'filter', 'map', 'reduce', 'forEach']);

  const loopTypes = new Set([
    'ForStatement', 'ForInStatement', 'ForOfStatement',
    'WhileStatement', 'DoWhileStatement',
  ]);

  // Rastreia se estamos dentro de um loop
  let inLoopDepth = 0;

  function walk(node) {
    if (!node || typeof node !== 'object') return;

    const isLoop = node.type && loopTypes.has(node.type);
    if (isLoop) inLoopDepth++;

    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'MemberExpression' &&
      arrayMethods.has(node.callee?.property?.name) &&
      inLoopDepth > 0
    ) {
      const method = node.callee.property.name;
      if (['find', 'findIndex', 'includes', 'indexOf'].includes(method)) {
        issues.push({
          type: 'linear_search_in_loop',
          severity: 'warning',
          line: node.loc?.start?.line,
          message: `Busca linear (Array.${method}) dentro de um loop. Pode resultar em O(n²) ou pior.`,
          recommendation:
            'Pré-processe os dados em um Map ou Set antes do loop para buscas O(1).',
        });
      }
    }

    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(walk);
      } else if (child && typeof child === 'object' && child.type) {
        walk(child);
      }
    }

    if (isLoop) inLoopDepth--;
  }

  walk(ast);
  return issues;
}

function detectSyncInAsync(ast) {
  const issues = [];

  const heavySyncFunctions = new Set([
    'readFileSync',
    'writeFileSync',
    'appendFileSync',
    'existsSync',
    'mkdirSync',
    'readdirSync',
    'execSync',
  ]);

  traverse(ast, {
    CallExpression(node) {
      const fnName = node.callee?.property?.name || node.callee?.name;
      if (heavySyncFunctions.has(fnName)) {
        issues.push({
          type: 'sync_in_async_context',
          severity: 'warning',
          line: node.loc?.start?.line,
          message: `Função síncrona "${fnName}" bloqueia o event loop do Node.js durante sua execução.`,
          recommendation: `Substitua por "${fnName.replace('Sync', '')}()" com await para não bloquear outras requisições.`,
        });
      }
    },
  });

  return issues;
}

function detectStringConcatenation(ast) {
  const issues = [];

  // Detecta concatenação de string em loop (clássico problema de performance)
  let inLoopDepth = 0;
  const loopTypes = new Set(['ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement']);

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    const isLoop = node.type && loopTypes.has(node.type);
    if (isLoop) inLoopDepth++;

    if (
      inLoopDepth > 0 &&
      node.type === 'AssignmentExpression' &&
      node.operator === '+=' &&
      // Heurística: se o lado direito é string ou template literal
      (node.right?.type === 'StringLiteral' || node.right?.type === 'TemplateLiteral')
    ) {
      issues.push({
        type: 'string_concat_in_loop',
        severity: 'warning',
        line: node.loc?.start?.line,
        message:
          'Concatenação de string com += dentro de loop. Em grandes volumes, cria muitos objetos intermediários na memória.',
        recommendation:
          'Use um array e junte com .join() ao final do loop. Ex: parts.push(str); result = parts.join("")',
      });
    }

    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) child.forEach(walk);
      else if (child && typeof child === 'object' && child.type) walk(child);
    }

    if (isLoop) inLoopDepth--;
  }

  walk(ast);
  return issues;
}

function analyzePerformance(ast) {
  const allIssues = [
    ...detectNestedLoops(ast),
    ...detectArrayInefficiency(ast),
    ...detectSyncInAsync(ast),
    ...detectStringConcatenation(ast),
  ];

  const highs = allIssues.filter((i) => i.severity === 'high');
  const warnings = allIssues.filter((i) => i.severity === 'warning');

  let score = 100;
  score -= highs.length * 15;
  score -= warnings.length * 7;
  score = Math.max(0, score);

  return {
    score,
    disclaimer:
      'Análise estática identifica padrões conhecidos. Performance real depende de contexto — use um profiler para medir.',
    total: allIssues.length,
    counts: { high: highs.length, warnings: warnings.length },
    issues: allIssues,
  };
}

module.exports = { analyzePerformance };
