// TRIVIO - ROTAS DE AUTENTICAÇÃO
// Este arquivo define as rotas relacionadas a autenticação.
// É como a "recepção" do sistema de login/cadastro.
// Duas rotas principais:
// 1. /cadastro - Para criar nova conta
// 2. /login - Para entrar no sistema


// IMPORTAÇÕES
// - express: Para criar as rotas
// - authController: O controller com as funções de autenticação

const express = require('express');
const authController = require('../controllers/authController');


// CONFIGURAÇÃO DO ROUTER
// Cria um router para gerenciar as rotas de autenticação.
// Todas as rotas aqui vão começar com /api/v1/auth/

const router = express.Router();


// ROTA: /cadastro
// Chamada quando alguém quer se cadastrar.
// URL: POST /api/v1/auth/cadastro
// O corpo da requisição deve ter:
// - tipo: "candidato" ou "empresa"
// - nome: Nome completo
// - email: E-mail (vai ser o login)
// - senha: Senha (mínimo 6 caracteres)
// - cnpj: Apenas para empresas

router.post('/cadastro', authController.cadastrar);


// ROTA: /login
// Chamada quando alguém quer entrar no sistema.
// URL: POST /api/v1/auth/login
// O corpo da requisição deve ter:
// - tipo: "candidato" ou "empresa"
// - email: E-mail cadastrado
// - senha: Senha

router.post('/login', authController.login);


// EXPORTAÇÃO
// Exporta o router para ser usado no servidor principal.

module.exports = router;