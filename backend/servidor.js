require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const userRoutes = require('./userRoutes');
const authRoutes = require('./rotas/auth');
const desafiosRoutes = require('./rotas/desafios');
const pagamentosRoutes = require('./rotas/pagamentos');
const vagasRoutes = require('./rotas/vagas');
const submissoesRoutes = require('./rotas/submissoes');
const analyzeRoutes = require('./rotas/analyze');
const inicializarTabelas = require('./database/setup');

const app = express();
const porta = process.env.PORT || 3001;

app.use(morgan('dev'));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'id-usuario', 'tipo-usuario']
}));
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/frontend/tela-principal', express.static(path.join(__dirname, '..', 'public', 'frontend', 'tela principal')));
app.use('/Empresas/tela-principal', express.static(path.join(__dirname, '..', 'public', 'Empresas', 'tela principal')));

app.get('/frontend/tela principal/*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'frontend', 'tela principal', req.params[0]));
});
app.get('/Empresas/tela principal/*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'Empresas', 'tela principal', req.params[0]));
});

inicializarTabelas();

app.use('/api/v1', userRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/desafios', desafiosRoutes);
app.use('/api/v1/pagamentos', pagamentosRoutes);
app.use('/api/v1/vagas', vagasRoutes);
app.use('/api/v1/submissoes', submissoesRoutes);
app.use('/api/v1', analyzeRoutes);

app.use((req, res, next) => {
  res.status(404).json({ erro: 'Rota nao encontrada' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

app.listen(porta, () => {
  console.log(`Servidor rodando em http://localhost:${porta}`);
});
