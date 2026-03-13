const express = require('express');
const multer = require('multer');
const userController = require('./userController');
const vagaController = require('./controllers/vagaController');

const router = express.Router();

// Configuração do Multer (Armazena na memória RAM temporariamente)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Endpoints de usuários
router.post('/users', upload.single('imagem'), userController.criarUsuario);
router.post('/upload', upload.single('arquivo'), userController.uploadImagemAvulsa);
router.put('/users/:id/foto', upload.single('imagem'), userController.atualizarFotoPerfil);

// Endpoints de configurações
router.get('/user/:tipo/:id/configuracoes', userController.getConfiguracoes);
router.put('/user/:tipo/:id/configuracoes', userController.atualizarConfiguracoes);
// Endpoints de vagas
router.get('/vagas', vagaController.listarVagas);
router.post('/vagas', vagaController.criarVaga);
router.put('/vagas/:id', vagaController.atualizarVaga);
router.delete('/vagas/:id', vagaController.excluirVaga);

module.exports = router;
