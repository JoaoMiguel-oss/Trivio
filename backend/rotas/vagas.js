const express = require('express');
const vagasController = require('../controllers/vagasController');

const router = express.Router();

router.get('/', vagasController.listarVagas);
router.post('/', vagasController.criarVaga);
router.put('/:id', vagasController.atualizarVaga);
router.delete('/:id', vagasController.excluirVaga);

module.exports = router;
