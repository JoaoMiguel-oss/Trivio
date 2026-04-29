
const { parseCode, isLanguageSupported } = require('../analyzer/parser');
const { analyzeQuality }     = require('../analyzer/quality');
const { analyzeBugs }        = require('../analyzer/bugs');
const { analyzeSecurity }    = require('../analyzer/security');
const { analyzePerformance } = require('../analyzer/performance');
const { analyzeStyle }       = require('../analyzer/style');
const { analyzeTestability } = require('../analyzer/testability');
const { calculateOverallScore } = require('../analyzer/score');
const { generateSuggestions, getTopSuggestions } = require('../analyzer/suggestions');

/**
 *
 * @param {string} code - Código-fonte como string
 * @param {string} language - Linguagem ('javascript' | 'typescript')
 * @returns {object} Relatório completo de análise
 */
async function analyzeCode(code, language = 'javascript') {
  if (!isLanguageSupported(language)) {
    return {
      success: false,
      error: `Linguagem "${language}" não suportada. Use: javascript, typescript.`,
    };
  }

  const parseResult = parseCode(code, language);

  if (parseResult.error && !parseResult.ast) {
    return {
      success: false,
      error: parseResult.error,
      details: 'O código tem erros de sintaxe que impedem a análise.',
    };
  }

  const { ast, syntaxErrors, lines } = parseResult;
  const [quality, bugs, security, performance, style, testability] = await Promise.all([
    Promise.resolve(analyzeQuality(ast, code)),
    Promise.resolve(analyzeBugs(ast)),
    Promise.resolve(analyzeSecurity(ast)),
    Promise.resolve(analyzePerformance(ast)),
    Promise.resolve(analyzeStyle(ast, code)),
    Promise.resolve(analyzeTestability(ast)),
  ]);

  const scoreResult = calculateOverallScore({
    quality:     quality.score,
    bugs:        bugs.score,
    security:    security.score,
    performance: performance.score,
    style:       style.score,
    testability: testability.score,
  });

  const allSuggestions = generateSuggestions({
    quality, bugs, security, performance, style, testability,
  });

  // 6. Monta resposta final
  return {
    success: true,
    meta: {
      language,
      lines,
      analyzedAt: new Date().toISOString(),
      syntaxWarnings: syntaxErrors?.length || 0,
    },
    overallScore: scoreResult.overall,
    grade: scoreResult.grade,
    summary: scoreResult.summary,
    scoreBreakdown: scoreResult.breakdown,

    // Dimensões detalhadas
    quality,
    bugs,
    security,
    performance,
    style,
    testability,

    // Sugestões priorizadas
    suggestions: allSuggestions,
    topSuggestions: getTopSuggestions(allSuggestions, 5),
  };
}

module.exports = { analyzeCode };
