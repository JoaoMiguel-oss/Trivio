const express = require('express');
const desafioController = require('../controllers/desafioController');

const router = express.Router();

// GET  /api/v1/desafios              - Lista desafios ativos (filtros: empresa_id, stack, nivel)
router.get('/', desafioController.listarDesafios);

// GET  /api/v1/desafios/:id          - Detalhes de um desafio
router.get('/:id', desafioController.obterDesafio);

// POST /api/v1/desafios              - Empresa cria um desafio técnico
router.post('/', desafioController.criarDesafio);

// PUT  /api/v1/desafios/:id          - Atualiza um desafio
router.put('/:id', desafioController.atualizarDesafio);

// DELETE /api/v1/desafios/:id        - Encerra um desafio (soft delete)
router.delete('/:id', desafioController.excluirDesafio);

// POST /api/v1/desafios/:id/candidatar  - Candidato aceita o desafio (1 por vaga)
router.post('/:id/candidatar', desafioController.candidatarDesafio);

// GET  /api/v1/desafios/:id/candidaturas - Empresa vê candidatos realizando o desafio
router.get('/:id/candidaturas', desafioController.listarCandidaturas);

// GET  /api/v1/desafios/meus/:candidato_id - Candidato vê seus desafios realizados
router.get('/meus/:candidato_id', desafioController.meusDesafios);

module.exports = router;
