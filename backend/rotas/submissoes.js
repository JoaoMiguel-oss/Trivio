const express = require('express');
const router = express.Router();
const submissaoController = require('../controllers/submissaoController');
const verificarAutenticacao = require('../middlewares/verificarAutenticacao');

router.post('/', verificarAutenticacao, submissaoController.criarSubmissao);
router.get('/usuario', verificarAutenticacao, submissaoController.listarSubmissoesUsuario);
router.get('/desafio/:desafio_id', verificarAutenticacao, submissaoController.listarSubmissoesDesafio);
router.get('/:id/analise', verificarAutenticacao, submissaoController.obterAnaliseIA);
router.patch('/:id/status', verificarAutenticacao, submissaoController.atualizarStatus);
router.get('/:id', verificarAutenticacao, submissaoController.obterSubmissao);

module.exports = router;
