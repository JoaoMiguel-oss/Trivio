
const express = require('express');       // Framework para rotas
const userController = require('./userController'); // Funções de usuário


// CONFIGURAÇÃO DO ROUTER

const router = express.Router();


// ROTAS DE CONFIGURAÇÕES


router.get('/user/:tipo/:id/configuracoes', userController.getConfiguracoes);
router.put('/user/:tipo/:id/configuracoes', userController.atualizarConfiguracoes);


// EXPORTAÇÃO DO ROUTER

module.exports = router;
