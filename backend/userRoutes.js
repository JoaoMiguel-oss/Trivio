const express = require('express');
const multer = require('multer');
const userController = require('./userController');
const vagaController = require('./controllers/vagaController');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/users', upload.single('imagem'), userController.criarUsuario);
router.post('/upload', upload.single('arquivo'), userController.uploadImagemAvulsa);
router.put('/user/:tipo/:id/foto', upload.single('imagem'), userController.atualizarFotoPerfil);

router.get('/user/:tipo/:id/configuracoes', userController.getConfiguracoes);
router.put('/user/:tipo/:id/configuracoes', userController.atualizarConfiguracoes);

router.get('/vagas', vagaController.listarVagas);
router.post('/vagas', vagaController.criarVaga);
router.put('/vagas/:id', vagaController.atualizarVaga);
router.delete('/vagas/:id', vagaController.excluirVaga);

module.exports = router;
