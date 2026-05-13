const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../banco/conexao');

const router = express.Router();

router.post('/cadastro', async (req, res) => {
  const { tipo, nome, email, senha, cnpj } = req.body;

  if (!tipo || !nome || !email || !senha) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Tipo, nome, email e senha sao obrigatorios'
    });
  }

  if (!['candidato', 'empresa'].includes(tipo)) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Tipo deve ser "candidato" ou "empresa"'
    });
  }

  try {
    const tabela = tipo === 'candidato' ? 'candidatos' : 'empresas';
    const existe = db.prepare(`SELECT id FROM ${tabela} WHERE email = ?`).get(email);

    if (existe) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Email ja cadastrado'
      });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const public_id = Date.now().toString(36) + Math.random().toString(36).substr(2);

    if (tipo === 'candidato') {
      db.prepare(
        'INSERT INTO candidatos (public_id, nome, email, senha_hash) VALUES (?, ?, ?, ?)'
      ).run(public_id, nome, email, senhaHash);
    } else {
      db.prepare(
        'INSERT INTO empresas (public_id, nome, cnpj, email, senha_hash) VALUES (?, ?, ?, ?, ?)'
      ).run(public_id, nome, cnpj || null, email, senhaHash);
    }

    res.status(201).json({
      sucesso: true,
      mensagem: 'Usuario cadastrado com sucesso',
      dados: { public_id, nome, email, tipo }
    });
  } catch (erro) {
    console.error('[AUTENTICACAO CADASTRO]', erro);
    res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao cadastrar usuario'
    });
  }
});

router.post('/login', async (req, res) => {
  const { tipo, email, senha } = req.body;

  if (!tipo || !email || !senha) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Tipo, email e senha sao obrigatorios'
    });
  }

  if (!['candidato', 'empresa'].includes(tipo)) {
    return res.status(400).json({
      sucesso: false,
      mensagem: 'Tipo deve ser "candidato" ou "empresa"'
    });
  }

  try {
    const tabela = tipo === 'candidato' ? 'candidatos' : 'empresas';
    const usuario = db.prepare(`SELECT * FROM ${tabela} WHERE email = ?`).get(email);

    if (!usuario) {
      return res.status(401).json({
        sucesso: false,
        mensagem: 'Email ou senha incorretos'
      });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaValida) {
      return res.status(401).json({
        sucesso: false,
        mensagem: 'Email ou senha incorretos'
      });
    }

    res.status(200).json({
      sucesso: true,
      mensagem: 'Login realizado com sucesso',
      dados: {
        public_id: usuario.public_id,
        nome: usuario.nome,
        email: usuario.email,
        tipo
      }
    });
  } catch (erro) {
    console.error('[AUTENTICACAO LOGIN]', erro);
    res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao fazer login'
    });
  }
});

module.exports = router;
