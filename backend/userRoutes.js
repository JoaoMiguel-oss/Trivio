const express = require('express');
const multer = require('multer');
const userController = require('./userController');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/users', upload.single('imagem'), userController.criarUsuario);
router.post('/upload', upload.single('arquivo'), userController.uploadImagemAvulsa);
router.put('/user/:tipo/:id/foto', upload.single('imagem'), userController.atualizarFotoPerfil);

router.get('/user/:tipo/:id/configuracoes', userController.getConfiguracoes);
router.put('/user/:tipo/:id/configuracoes', userController.atualizarConfiguracoes);

module.exports = router;
