const express = require('express');
const pagamentoController = require('../controllers/pagamentoController');

const router = express.Router();

// GET  /api/v1/pagamentos              - Lista pagamentos da empresa
router.get('/', pagamentoController.listarPagamentos);

// GET  /api/v1/pagamentos/metricas    - Métricas gerais da empresa
router.get('/metricas', pagamentoController.obterMetricas);

// GET  /api/v1/pagamentos/vaga/:vaga_id/metricas - Métricas por vaga
router.get('/vaga/:vaga_id/metricas', pagamentoController.obterMetricasVaga);

// POST /api/v1/pagamentos/:pagamento_id/pagar - Confirmar pagamento
router.post('/:pagamento_id/pagar', pagamentoController.confirmarPagamento);

module.exports = router;
