const express              = require('express');
const pagamentoController  = require('../controllers/pagamentoController');

const router = express.Router();

// ──────────────────────────────────────────────────────────────
// IMPORTANTE: O webhook DEVE vir antes de qualquer middleware
// que faça parse do body como JSON, pois precisamos do raw body
// para validar a assinatura HMAC do Pagar.me.
//
// No servidor.js, registre esta rota ANTES do express.json():
//   app.use('/api/v1/pagamentos', pagamentosRoutes);
//   app.use(express.json()); ← NÃO, coloque o json() antes mas
//                              use express.raw() só no webhook
// ──────────────────────────────────────────────────────────────

// POST /api/v1/pagamentos/webhook
// Recebe eventos automáticos do Pagar.me (order.paid, etc.)
// Configure esta URL no dashboard: Pagar.me > Webhooks > Criar
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }), // raw body para validar assinatura
  (req, res, next) => {
    // Converte o Buffer para string e faz o parse manual
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body.toString('utf8');
      try {
        req.body = JSON.parse(req.rawBody);
      } catch {
        return res.status(400).json({ erro: 'Body inválido' });
      }
    }
    next();
  },
  pagamentoController.receberWebhook
);

// GET  /api/v1/pagamentos
// Lista todos os pagamentos de uma empresa
router.get('/', pagamentoController.listarPagamentos);

// GET  /api/v1/pagamentos/metricas
// Métricas gerais da empresa
router.get('/metricas', pagamentoController.obterMetricas);

// GET  /api/v1/pagamentos/vaga/:vaga_id/metricas
// Métricas de uma vaga específica
router.get('/vaga/:vaga_id/metricas', pagamentoController.obterMetricasVaga);

// GET  /api/v1/pagamentos/:pagamento_id/link
// Retorna (ou cria) o link de checkout de um pagamento pendente
router.get('/:pagamento_id/link', pagamentoController.obterLinkPagamento);

module.exports = router;
