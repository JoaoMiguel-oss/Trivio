const express = require('express');
const { evaluateCode } = require('./evaluator');

const app = express();
app.use(express.json({ limit: '1mb' }));

// ─── Health check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', supportedLanguages: ['javascript', 'python'] });
});

// ─── POST /evaluate ──────────────────────────────────────────────────────────
app.post('/evaluate', async (req, res) => {
  const { language, code, tests } = req.body;

  // ── Input validation ──────────────────────────────────────────────────────
  if (!language || typeof language !== 'string') {
    return res.status(400).json({ error: 'Campo "language" é obrigatório e deve ser uma string.' });
  }
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Campo "code" é obrigatório e deve ser uma string.' });
  }
  if (!Array.isArray(tests) || tests.length === 0) {
    return res.status(400).json({ error: 'Campo "tests" deve ser um array não vazio.' });
  }
  if (tests.length > 20) {
    return res.status(400).json({ error: 'Máximo de 20 casos de teste por requisição.' });
  }

  const lang = language.toLowerCase().trim();
  const supported = ['javascript', 'python'];
  if (!supported.includes(lang)) {
    return res.status(400).json({
      error: `Linguagem "${lang}" não suportada. Suportadas: ${supported.join(', ')}.`,
    });
  }

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    if (typeof t.input === 'undefined' || typeof t.expected_output === 'undefined') {
      return res.status(400).json({
        error: `Caso de teste #${i + 1} deve conter "input" e "expected_output".`,
      });
    }
  }

  // ── Execute ───────────────────────────────────────────────────────────────
  try {
    const results = await evaluateCode(lang, code, tests);
    const success = results.every((r) => r.passed);

    return res.json({ success, results });
  } catch (err) {
    console.error('[evaluate] erro interno:', err);
    return res.status(500).json({ error: 'Erro interno ao executar o código.' });
  }
});

// ─── 404 catch-all ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`[trivio-evaluator] rodando em http://localhost:${PORT}`);
});
