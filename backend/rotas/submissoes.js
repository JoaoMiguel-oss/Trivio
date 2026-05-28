// TRIVIO - ROTAS DE SUBMISSÕES
// Mapeamento de URLs para as funções do submissaoController.
// Padrão do projeto: Express Router separado por domínio.
// Registrado no servidor.js como /api/v1/submissoes

const express = require('express');
const router = express.Router();
const submissaoController = require('../controllers/submissaoController');
const verificarAutenticacao = require('../middlewares/verificarAutenticacao');
const db = require('../banco/conexao');

// ROTAS DO CANDIDATO

// POST /api/v1/submissoes
// Candidato envia solução de código para um desafio
// Body: { desafio_id, candidato_id, codigo, linguagem, mensagem?, solucao_url? }
router.post('/', verificarAutenticacao, submissaoController.criarSubmissao);

// GET /api/v1/submissoes/usuario
// Candidato lista suas próprias submissões
// Header: id-usuario (candidato_id)
router.get('/usuario', verificarAutenticacao, submissaoController.listarSubmissoesUsuario);

// ROTAS DA EMPRESA

// GET /api/v1/submissoes/desafio/:desafio_id
// Empresa vê todas as submissões de um desafio seu
// Header: id-usuario (empresa_id)
router.get('/desafio/:desafio_id', verificarAutenticacao, submissaoController.listarSubmissoesDesafio);

// PATCH /api/v1/submissoes/:id/status
// Empresa aprova ou rejeita uma submissão
// Body: { status: 'aprovado' | 'rejeitado' | 'em_revisao', feedback? }
router.patch('/:id/status', verificarAutenticacao, submissaoController.atualizarStatus);

// GET /api/v1/submissoes/:id/analise
// Empresa ou candidato consulta o relatório de IA de uma submissão
router.get('/:id/analise', verificarAutenticacao, async (req, res) => {
  try {
    const { id } = req.params;
    const submissao = db.prepare(
      'SELECT score_ia, relatorio_ia FROM candidaturas_desafio WHERE id = ?'
    ).get(id);
    if (!submissao) return res.status(404).json({ sucesso: false, mensagem: 'Submissão não encontrada' });
    if (!submissao.relatorio_ia) return res.status(202).json({ sucesso: false, mensagem: 'Análise ainda em processamento' });
    return res.status(200).json({ sucesso: true, score: submissao.score_ia, relatorio: JSON.parse(submissao.relatorio_ia) });
  } catch (err) {
    return res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar análise' });
  }
});

// ROTA COMPARTILHADA

// GET /api/v1/submissoes/:id
// Detalhe completo de uma submissão (candidato vê a própria, empresa vê as do seu desafio)
// IMPORTANTE: Esta rota deve ficar depois das rotas com path fixo (usuario, desafio)
// para o Express não confundir "usuario" e "desafio" como :id
router.get('/:id', verificarAutenticacao, submissaoController.obterSubmissao);

module.exports = router;