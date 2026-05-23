// TRIVIO - ROTAS DE CASOS DE TESTE
// Montadas sob /api/v1 no servidor.js, por isso os paths
// incluem /desafios/:id/casos-teste para ficar junto às rotas de desafios.

const express = require('express');
const {
    criarCasoTeste,
    listarCasosTeste,
    atualizarCasoTeste,
    deletarCasoTeste,
} = require('../controllers/casosTesteController');

const router = express.Router();

// POST   /api/v1/desafios/:id/casos-teste          - Empresa adiciona caso de teste
router.post('/desafios/:id/casos-teste', criarCasoTeste);

// GET    /api/v1/desafios/:id/casos-teste          - Empresa lista casos de teste
router.get('/desafios/:id/casos-teste', listarCasosTeste);

// PUT    /api/v1/desafios/:id/casos-teste/:caso_id - Empresa edita caso de teste
router.put('/desafios/:id/casos-teste/:caso_id', atualizarCasoTeste);

// DELETE /api/v1/desafios/:id/casos-teste/:caso_id - Empresa remove caso de teste
router.delete('/desafios/:id/casos-teste/:caso_id', deletarCasoTeste);

module.exports = router;
