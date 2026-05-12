const express             = require('express');
const pagamentoController = require('../controllers/pagamentoController');

const router = express.Router();

router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    if (Buffer.isBuffer(req.body)) {
      req.rawBody = req.body.toString('utf8');
      try {
        req.body = JSON.parse(req.rawBody);
      } catch {
        return res.status(400).json({ erro: 'Body invalido' });
      }
    }
    next();
  },
  pagamentoController.receberWebhook
);

router.get('/', pagamentoController.listarPagamentos);
router.get('/metricas', pagamentoController.obterMetricas);
router.get('/vaga/:vaga_id/metricas', pagamentoController.obterMetricasVaga);
router.get('/:pagamento_id/link', pagamentoController.obterLinkPagamento);

module.exports = router;
