const express = require('express');
const desafioController = require('../controllers/desafioController');

const router = express.Router();

router.get('/', desafioController.listarDesafios);
router.get('/:id', desafioController.obterDesafio);
router.post('/', desafioController.criarDesafio);
router.put('/:id', desafioController.atualizarDesafio);
router.delete('/:id', desafioController.excluirDesafio);
router.post('/:id/candidatar', desafioController.candidatarDesafio);
router.get('/:id/candidaturas', desafioController.listarCandidaturas);
router.post('/:id/candidatos/:candidato_id/avancar', desafioController.avancarParaEntrevista);
router.get('/meus/:candidato_id', desafioController.meusDesafios);

module.exports = router;
