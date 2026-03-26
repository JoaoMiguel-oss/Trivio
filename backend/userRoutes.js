// ============================================================
// TRIVIO - ROTAS DE USUÁRIOS
// ============================================================
// Este arquivo define todas as rotas relacionadas a usuários.
// É como um "cardápio" que lista todas as operações disponíveis.
//
// O que você pode fazer aqui:
// - Criar novos usuários
// - Upload de fotos
// - Ver e editar configurações
// - Gerenciar vagas de emprego
// ============================================================


// ============================================================
// IMPORTAÇÕES
// ============================================================
// Precisamos de três bibliotecas principais:
//
// - express: Para criar as rotas
// - multer: Para lidar com upload de arquivos (fotos, documentos)
// - userController: Onde estão as funções que realmente fazem o trabalho
// ============================================================

const express = require('express');       // Framework para rotas
const userController = require('./userController'); // Funções de usuário


// ============================================================
// CONFIGURAÇÃO DO ROUTER
// ============================================================
// O router é como um "carteiro". Ele recebe as requisições
// e as distribui para o lugar certo.
// ============================================================

const router = express.Router();


// ============================================================
// ROTAS DE CONFIGURAÇÕES
// ============================================================
// Cada usuário pode ter suas configurações personalizadas.
// Por exemplo: notificações, tema, privacidade.
//
// GET /user/:tipo/:id/configuracoes
//    - Busca as configurações de um usuário
//    - :tipo pode ser "candidato" ou "empresa"
//    - :id é o identificador do usuário
//
// PUT /user/:tipo/:id/configuracoes
//    - Atualiza as configurações do usuário
// ============================================================

router.get('/user/:tipo/:id/configuracoes', userController.getConfiguracoes);
router.put('/user/:tipo/:id/configuracoes', userController.atualizarConfiguracoes);


// ============================================================
// EXPORTAÇÃO DO ROUTER
// ============================================================
// Precisamos exportar o router para que o servidor principal
// possa usá-lo. É como dizer: "Aqui está o carteiro,
// pode utilizá-lo".
// ============================================================

module.exports = router;
