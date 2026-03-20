// servidor principal
require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');


// const rotasAutenticacao = require('./rotas/autenticacao');
// const rotasUsuario = require('./rotas/usuario');
// const rotasTelas = require('./rotas/telas');

const userRoutes = require('./userRoutes');
const authRoutes = require('./rotas/auth');
const inicializarTabelas = require('./database/setup');

const app = express();
const porta = process.env.PORT || 3001;

// app.use(helmet()); // Adiciona headers de segurança
app.use(morgan('dev')); // Loga as requisições no console
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Servir arquivos estáticos da pasta public (caminho absoluto)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Aliases para pastas com espaço no nome
app.use('/frontend/tela-principal', express.static(path.join(__dirname, '..', 'public', 'frontend', 'tela principal')));
app.use('/Empresas/tela-principal', express.static(path.join(__dirname, '..', 'public', 'Empresas', 'tela principal')));

// Rotas explícitas para arquivos dentro de pastas com espaço
app.get('/frontend/tela principal/*', (req, res) => {
  const filePath = req.params[0];
  res.sendFile(path.join(__dirname, '..', 'public', 'frontend', 'tela principal', filePath));
});
app.get('/Empresas/tela principal/*', (req, res) => {
  const filePath = req.params[0];
  res.sendFile(path.join(__dirname, '..', 'public', 'Empresas', 'tela principal', filePath));
});

// Inicializa tabelas do banco (MVP)
inicializarTabelas();

// Rotas da API (Prefixo /api/v1 para versionamento)
app.use('/api/v1', userRoutes);
app.use('/api/v1/auth', authRoutes); // POST /api/v1/auth/cadastro | POST /api/v1/auth/login

// Middleware para tratar rota não encontrada (404)
app.use((req, res, next) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

// Middleware global de tratamento de erros (500)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

app.listen(porta, () => {
  console.log(`Servidor rodando em http://localhost:${porta}`);
});