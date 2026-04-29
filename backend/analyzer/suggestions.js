/**
 * analyzer/suggestions.js
 *
 * Agrega e prioriza todas as sugestões dos módulos de análise,
 * ordenando por severidade e impacto.
 *
 * O objetivo é dar ao desenvolvedor uma lista clara e priorizada
 * do que atacar primeiro, sem precisar vasculhar cada dimensão.
 */

// Mapa de severidade → prioridade numérica (menor = mais urgente)
const SEVERITY_PRIORITY = {
  critical: 1,
  high:     2,
  error:    2,
  warning:  3,
  medium:   3,
  info:     4,
};

// Mapa de dimensão → nome amigável
const DIMENSION_LABELS = {
  security:    'Segurança',
  bugs:        'Bugs Potenciais',
  performance: 'Performance',
  quality:     'Qualidade',
  testability: 'Testabilidade',
  style:       'Estilo',
};

/**
 * Recebe o resultado completo de todas as análises
 * e retorna uma lista unificada e ordenada de sugestões.
 *
 * @param {object} analysisResults - { quality, bugs, security, performance, style, testability }
 * @returns {Array} Lista de sugestões ordenadas por prioridade
 */
function generateSuggestions(analysisResults) {
  const allSuggestions = [];

  for (const [dimension, result] of Object.entries(analysisResults)) {
    if (!result || !Array.isArray(result.issues)) continue;

    for (const issue of result.issues) {
      allSuggestions.push({
        dimension: DIMENSION_LABELS[dimension] || dimension,
        dimensionKey: dimension,
        type: issue.type,
        severity: issue.severity || 'info',
        priority: SEVERITY_PRIORITY[issue.severity] ?? 4,
        line: issue.line || null,
        message: issue.message,
        recommendation: issue.recommendation || null,
      });
    }
  }

  // Ordena: primeiro por prioridade (menor = mais urgente), depois por dimensão
  allSuggestions.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    // Se mesma prioridade, segurança e bugs primeiro
    const order = ['security', 'bugs', 'performance', 'quality', 'testability', 'style'];
    return order.indexOf(a.dimensionKey) - order.indexOf(b.dimensionKey);
  });

  return allSuggestions;
}

/**
 * Retorna as top N sugestões mais urgentes.
 * Útil para exibir um resumo executivo.
 */
function getTopSuggestions(suggestions, n = 5) {
  return suggestions.slice(0, n);
}

module.exports = { generateSuggestions, getTopSuggestions };
