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
const multer = require('multer');         // Para fazer upload de arquivos
const userController = require('./userController'); // Funções de usuário
const vagaController = require('./controllers/vagaController'); // Funções de vagas


// ============================================================
// CONFIGURAÇÃO DO ROUTER
// ============================================================
// O router é como um "carteiro". Ele recebe as requisições
// e as distribui para o lugar certo.
// ============================================================

const router = express.Router();


// ============================================================
// CONFIGURAÇÃO DO MULTER (Upload de arquivos)
// ============================================================
// Multer é o "carregador" que manipula arquivos enviados.
// storage: memoryStorage significa que o arquivo fica na
//          memória RAM temporariamente (não salva no disco).
// Isso é bom para arquivos pequenos que serão enviados para
// o Cloud logo em seguida.
// ============================================================

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


// ============================================================
// ROTAS DE USUÁRIOS
// ============================================================
// Vamos definir o que cada rota faz:
//
// POST /users
//    - Cria um novo usuário no sistema
//    - Pode receber uma foto (imagem) junto
//    - Exemplo: POST /api/v1/users
//
// POST /upload
//    - Upload avulso de imagem
//    - Útil para testar o sistema de uploads
//    - Exemplo: POST /api/v1/upload
//
// PUT /user/:tipo/:id/foto
//    - Atualiza a foto de perfil de um usuário específico
//    - O :tipo é "candidato" ou "empresa", e :id é o identificador
//    - Exemplo: PUT /api/v1/user/candidato/123/foto
// ============================================================

router.post('/users', upload.single('imagem'), userController.criarUsuario);
router.post('/upload', upload.single('arquivo'), userController.uploadImagemAvulsa);
router.put('/user/:tipo/:id/foto', upload.single('imagem'), userController.atualizarFotoPerfil);


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
// ROTAS DE VAGAS
// ============================================================
// Aqui está tudo sobre gerenciamento de vagas de emprego.
//
// GET /vagas
//    - Lista todas as vagas disponíveis
//    - Exemplo: GET /api/v1/vagas
//
// POST /vagas
//    - Cria uma nova vaga (normalmente empresas fazem isso)
//    - Exemplo: POST /api/v1/vagas
//
// PUT /vagas/:id
//    - Atualiza uma vaga existente
//    - :id é o identificador da vaga
//
// DELETE /vagas/:id
//    - Exclui uma vaga
//    - :id é o identificador da vaga
// ============================================================

router.get('/vagas', vagaController.listarVagas);
router.post('/vagas', vagaController.criarVaga);
router.put('/vagas/:id', vagaController.atualizarVaga);
router.delete('/vagas/:id', vagaController.excluirVaga);


// ============================================================
// EXPORTAÇÃO DO ROUTER
// ============================================================
// Precisamos exportar o router para que o servidor principal
// possa usá-lo. É como dizer: "Aqui está o carteiro,
// pode utilizá-lo".
// ============================================================

module.exports = router;
