/**
 * analyzer/score.js
 *
 * Agrega os scores de todos os módulos em um score geral.
 *
 * Os pesos são configuráveis. A ideia é que segurança e bugs
 * importem mais do que estilo, por exemplo.
 *
 * Para adicionar uma nova dimensão de análise:
 * 1. Crie o módulo em /analyzer/novaDimensao.js
 * 2. Adicione o peso em WEIGHTS
 * 3. Inclua no objeto de scores recebido por calculateOverallScore()
 */

// Pesos de cada dimensão (devem somar 1.0)
const WEIGHTS = {
  quality:     0.20,
  bugs:        0.25,
  security:    0.25,
  performance: 0.10,
  style:       0.10,
  testability: 0.10,
};

// Valida que os pesos somam 1 (com tolerância de ponto flutuante)
const totalWeight = Object.values(WEIGHTS).reduce((s, w) => s + w, 0);
if (Math.abs(totalWeight - 1.0) > 0.001) {
  console.warn(`[analyzer/score] ATENÇÃO: Os pesos somam ${totalWeight}, não 1.0`);
}

/**
 * Calcula o score geral ponderado.
 *
 * @param {object} scores - { quality, bugs, security, performance, style, testability }
 * @returns {{ overall: number, breakdown: object, grade: string }}
 */
function calculateOverallScore(scores) {
  let overall = 0;
  const breakdown = {};

  for (const [dimension, weight] of Object.entries(WEIGHTS)) {
    const dimensionScore = scores[dimension] ?? 0;
    const contribution = dimensionScore * weight;
    overall += contribution;

    breakdown[dimension] = {
      score: dimensionScore,
      weight: Math.round(weight * 100),
      contribution: Math.round(contribution),
    };
  }

  overall = Math.round(overall);

  return {
    overall,
    breakdown,
    grade: getGrade(overall),
    summary: getSummary(overall),
  };
}

/**
 * Converte score numérico em letra/conceito.
 */
function getGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Mensagem de resumo baseada no score.
 */
function getSummary(score) {
  if (score >= 90) return 'Código excelente. Poucos ou nenhum problema significativo.';
  if (score >= 80) return 'Bom código. Alguns pontos de melhoria não críticos.';
  if (score >= 70) return 'Código aceitável. Há problemas que merecem atenção.';
  if (score >= 60) return 'Código com problemas relevantes. Refatoração recomendada.';
  return 'Código com problemas graves. Revisão urgente necessária.';
}

module.exports = { calculateOverallScore, WEIGHTS };
