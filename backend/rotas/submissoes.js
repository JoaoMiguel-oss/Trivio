// ============================================================
// TRIVIO - ROTAS DE SUBMISSÕES
// ============================================================
// Mapeamento de URLs para as funções do submissaoController.
//
// Padrão do projeto: Express Router separado por domínio.
// Registrado no servidor.js como /api/v1/submissoes
// ============================================================

const express = require('express');
const router = express.Router();
const submissaoController = require('../controllers/submissaoController');
const verificarAutenticacao = require('../middlewares/verificarAutenticacao');

// ─────────────────────────────────────────────────────────────────────────────
// ROTAS DO CANDIDATO
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/submissoes
// Candidato envia solução de código para um desafio
// Body: { desafio_id, candidato_id, codigo, linguagem, mensagem?, solucao_url? }
router.post('/', verificarAutenticacao, submissaoController.criarSubmissao);

// GET /api/v1/submissoes/usuario
// Candidato lista suas próprias submissões
// Header: id-usuario (candidato_id)
router.get('/usuario', verificarAutenticacao, submissaoController.listarSubmissoesUsuario);

// ─────────────────────────────────────────────────────────────────────────────
// ROTAS DA EMPRESA
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/submissoes/desafio/:desafio_id
// Empresa vê todas as submissões de um desafio seu
// Header: id-usuario (empresa_id)
router.get('/desafio/:desafio_id', verificarAutenticacao, submissaoController.listarSubmissoesDesafio);

// PATCH /api/v1/submissoes/:id/status
// Empresa aprova ou rejeita uma submissão
// Body: { status: 'aprovado' | 'rejeitado' | 'em_revisao', feedback? }
router.patch('/:id/status', verificarAutenticacao, submissaoController.atualizarStatus);

// ─────────────────────────────────────────────────────────────────────────────
// ROTA COMPARTILHADA
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/submissoes/:id
// Detalhe completo de uma submissão (candidato vê a própria, empresa vê as do seu desafio)
// IMPORTANTE: Esta rota deve ficar depois das rotas com path fixo (usuario, desafio)
//             para o Express não confundir "usuario" e "desafio" como :id
router.get('/:id', verificarAutenticacao, submissaoController.obterSubmissao);

module.exports = router;
