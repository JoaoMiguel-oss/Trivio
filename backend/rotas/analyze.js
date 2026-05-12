const express = require('express');
const { analyzeCode } = require('../services/analyzeCodeService');

const router = express.Router();

router.post('/analyze', async (req, res) => {
  const { code, language = 'javascript' } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Campo "code" e obrigatorio e deve ser uma string.',
    });
  }

  if (code.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'O codigo enviado esta vazio.',
    });
  }

  const MAX_SIZE = 100 * 1024;
  if (Buffer.byteLength(code, 'utf8') > MAX_SIZE) {
    return res.status(413).json({
      success: false,
      error: 'Codigo muito grande. Limite: 100KB.',
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
      error: 'Erro interno durante a analise. Tente novamente.',
    });
  }
});

module.exports = router;
