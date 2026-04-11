const express = require('express');
const vagaController = require('../controllers/vagaController');
const verificarAutenticacao = require('../middlewares/verificarAutenticacao');

const router = express.Router();

// Middleware para verificar se o usuário é empresa
const verificarEmpresa = (req, res, next) => {
  const tipoUsuario = req.headers['tipo-usuario'];
  
  if (tipoUsuario !== 'empresa') {
    return res.status(403).json({ 
      erro: 'Apenas empresas podem criar/editar vagas' 
    });
  }
  
  next();
};

// GET - Listar vagas (público)
router.get('/', vagaController.listarVagas);

// POST - Criar vaga (só empresas autenticadas)
router.post('/', verificarAutenticacao, verificarEmpresa, vagaController.criarVaga);

// PUT - Atualizar vaga (só empresas autenticadas)
router.put('/:id', verificarAutenticacao, verificarEmpresa, vagaController.atualizarVaga);

// DELETE - Excluir vaga (só empresas autenticadas)
router.delete('/:id', verificarAutenticacao, verificarEmpresa, vagaController.excluirVaga);

module.exports = router;
