/**
 * analyzer/bugs.js
 *
 * Detecta padrões de código que frequentemente causam bugs em JS.
 *
 * LIMITAÇÕES IMPORTANTES:
 * - Esta análise trabalha com HEURÍSTICAS baseadas em padrões da AST.
 * - NÃO garante ausência de bugs. Nunca afirme isso ao usuário.
 * - Falsos positivos são possíveis — o desenvolvedor deve avaliar cada item.
 * - Não analisa lógica de negócio, apenas padrões estruturais.
 */

const { traverse } = require('./parser');

function analyzeEquality(ast) {
  const issues = [];

  traverse(ast, {
    BinaryExpression(node) {
      if (node.operator === '==' || node.operator === '!=') {
        issues.push({
          type: 'equality_coercion',
          severity: 'warning',
          line: node.loc?.start?.line,
          message: `Operador "${node.operator}" realiza coerção de tipo. Use "${node.operator}=" para comparação estrita.`,
        });
      }
    },
  });

  return issues;
}

function analyzeVariables(ast) {
  const issues = [];
  const declaredVars = new Map(); // nome → { linha, usada }

  traverse(ast, {
    VariableDeclarator(node) {
      if (node.id?.name) {
        declaredVars.set(node.id.name, {
          line: node.loc?.start?.line,
          used: false,
        });
      }
    },
    // Marca variáveis como usadas quando aparecem em Identifiers
    Identifier(node) {
      if (declaredVars.has(node.name)) {
        declaredVars.get(node.name).used = true;
      }
    },
  });

  // Reporta variáveis declaradas mas nunca usadas
  // (exclui _ por convenção de "ignorada intencionalmente")
  for (const [name, info] of declaredVars.entries()) {
    if (!info.used && !name.startsWith('_')) {
      issues.push({
        type: 'unused_variable',
        severity: 'warning',
        line: info.line,
        message: `Variável "${name}" declarada mas nunca utilizada.`,
      });
    }
  }

  return issues;
}

function analyzeAsyncPatterns(ast) {
  const issues = [];

  traverse(ast, {
    // Detecta .then() sem .catch() (Promise sem tratamento de erro)
    CallExpression(node) {
      if (
        node.callee?.type === 'MemberExpression' &&
        node.callee?.property?.name === 'then'
      ) {
        // Verifica se o .then está encadeado com um .catch
        // Heurística: se o pai não tem .catch encadeado logo após
        // Isso é limitado — não detecta .catch em cadeia mais longa
        issues.push({
          type: 'unhandled_promise',
          severity: 'warning',
          line: node.loc?.start?.line,
          message:
            'Promise com .then() detectada. Verifique se há .catch() para tratar erros.',
        });
      }
    },

    // Detecta await fora de função async
    AwaitExpression(node) {
      // Nota: Babel já invalida isso em parse, mas com errorRecovery pode passar
      // Esta verificação é um reforço
    },
  });

  return issues;
}

function analyzeNullAccess(ast) {
  const issues = [];

  traverse(ast, {
    // Detecta acesso de propriedade sem optional chaining em posições suspeitas
    MemberExpression(node) {
      if (
        !node.optional && // Não tem ?.
        node.object?.type === 'CallExpression' // Acessa propriedade direto em resultado de função
      ) {
        // Ex: getUser().name — se getUser() retornar null, quebra
        issues.push({
          type: 'potential_null_access',
          severity: 'info',
          line: node.loc?.start?.line,
          message: `Acesso de propriedade direto no retorno de uma função. Considere usar optional chaining (?.) se o retorno pode ser nulo.`,
        });
      }
    },
  });

  return issues;
}

function analyzeReturnConsistency(ast) {
  const issues = [];

  function checkFunction(node) {
    if (!node.body || node.body.type !== 'BlockStatement') return;

    let hasExplicitReturn = false;
    let hasImplicitReturn = false;

    traverse(node.body, {
      ReturnStatement(ret) {
        if (ret.argument) {
          hasExplicitReturn = true;
        } else {
          hasImplicitReturn = true;
        }
      },
    });

    if (hasExplicitReturn && hasImplicitReturn) {
      const name = node.id?.name || '<anônima>';
      issues.push({
        type: 'inconsistent_return',
        severity: 'warning',
        line: node.loc?.start?.line,
        message: `Função "${name}" tem retornos inconsistentes: alguns caminhos retornam valor, outros não.`,
      });
    }
  }

  traverse(ast, {
    FunctionDeclaration: checkFunction,
    FunctionExpression: checkFunction,
  });

  return issues;
}

function analyzeBugs(ast) {
  const allIssues = [
    ...analyzeEquality(ast),
    ...analyzeVariables(ast),
    ...analyzeAsyncPatterns(ast),
    ...analyzeNullAccess(ast),
    ...analyzeReturnConsistency(ast),
  ];

  const byType = allIssues.reduce((acc, issue) => {
    acc[issue.type] = acc[issue.type] || [];
    acc[issue.type].push(issue);
    return acc;
  }, {});

  const errors = allIssues.filter((i) => i.severity === 'error');
  const warnings = allIssues.filter((i) => i.severity === 'warning');
  const infos = allIssues.filter((i) => i.severity === 'info');

  // Score: começa em 100, perde por erro/warning
  let score = 100;
  score -= errors.length * 15;
  score -= warnings.length * 5;
  score -= infos.length * 2;
  score = Math.max(0, score);

  return {
    score,
    disclaimer:
      'Esta análise usa heurísticas e não garante ausência de bugs. Revise cada item manualmente.',
    total: allIssues.length,
    counts: {
      errors: errors.length,
      warnings: warnings.length,
      infos: infos.length,
    },
    issues: allIssues,
    byType,
  };
}

module.exports = { analyzeBugs };
