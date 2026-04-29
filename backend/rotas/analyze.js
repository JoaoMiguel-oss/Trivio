/**
 * rotas/analyze.js
 *
 * Rota POST /api/v1/analyze
 *
 * Esta rota é completamente isolada. Ela não toca em nenhuma outra
 * parte do sistema. Para integrá-la no servidor, adicione apenas:
 *
 *   const analyzeRoutes = require('./rotas/analyze');
 *   app.use('/api/v1', analyzeRoutes);
 *
 * E nada mais precisa mudar.
 */

const express = require('express');
const { analyzeCode } = require('../services/analyzeCodeService');

const router = express.Router();

/**
 * POST /api/v1/analyze
 *
 * Body: { "code": "string", "language": "javascript" }
 *
 * Retorna análise estática completa do código enviado.
 */
router.post('/analyze', async (req, res) => {
  const { code, language = 'javascript' } = req.body;

  // Validação de entrada
  if (!code || typeof code !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Campo "code" é obrigatório e deve ser uma string.',
    });
  }

  if (code.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'O código enviado está vazio.',
    });
  }

  // Limite de tamanho: 100KB de código (~2500 linhas)
  const MAX_SIZE = 100 * 1024;
  if (Buffer.byteLength(code, 'utf8') > MAX_SIZE) {
    return res.status(413).json({
      success: false,
      error: 'Código muito grande. Limite: 100KB.',
    });
  }

  try {
    const result = await analyzeCode(code, language);

    if (!result.success) {
      return res.status(422).json(result);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('[POST /analyze] Erro inesperado:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno durante a análise. Tente novamente.',
    });
  }
});

module.exports = router;
