
// Carrega as variáveis de ambiente (senhas, configurações)
require('dotenv').config();

// Importa o framework Express - é ele que cria o servidor web
const express = require('express');

// Importa a biblioteca path - ajuda a trabalhar com caminhos de arquivos
const path = require('path');

// Importa CORS - permite que o frontend converse com o backend
const cors = require('cors');

// Importa Helmet - adiciona headers de segurança
const helmet = require('helmet');

// Importa Morgan - faz logs das requisições no terminal
const morgan = require('morgan');



const userRoutes = require('./userRoutes');
const authRoutes = require('./rotas/auth');
const desafiosRoutes = require('./rotas/desafios');
const pagamentosRoutes = require('./rotas/pagamentos');
const vagasRoutes = require('./rotas/vagas');
const submissoesRoutes = require('./rotas/submissoes');
const analyzeRoutes = require('./rotas/analyze');

// Importa a função que cria as tabelas do banco de dados
const inicializarTabelas = require('./database/setup');


// Cria a aplicação Express - é como inicializar o servidor
const app = express();

// Define a porta do servidor (usa a variável PORT ou 3001 como padrão)
const porta = process.env.PORT || 3001;


app.use(morgan('dev')); // Loga as requisições no console
app.use(cors({
  origin: '*',  // Permite qualquer domínio acessar
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json()); // Permite receber dados em formato JSON


// Serve arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/frontend/tela-principal', express.static(path.join(__dirname, '..', 'public', 'frontend', 'tela principal')));
app.use('/Empresas/tela-principal', express.static(path.join(__dirname, '..', 'public', 'Empresas', 'tela principal')));

// Rotas especiais para arquivos dentro de pastas com espaço
// Isso garante que arquivos em pastas como "tela principal" funcionem
app.get('/frontend/tela principal/*', (req, res) => {
  const filePath = req.params[0];
  res.sendFile(path.join(__dirname, '..', 'public', 'frontend', 'tela principal', filePath));
});
app.get('/Empresas/tela principal/*', (req, res) => {
  const filePath = req.params[0];
  res.sendFile(path.join(__dirname, '..', 'public', 'Empresas', 'tela principal', filePath));
});




inicializarTabelas();


// rotas... me maaata... mas é necessário para o backend funcionar
app.use('/api/v1', userRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/desafios', desafiosRoutes);
app.use('/api/v1/pagamentos', pagamentosRoutes);
app.use('/api/v1/vagas', vagasRoutes);
app.use('/api/v1/submissoes', submissoesRoutes);
app.use('/api/v1', analyzeRoutes);



// Middleware para rota não encontrada (404)
app.use((req, res, next) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

// Middleware global de tratamento de erros (500)
app.use((err, req, res, next) => {
  console.error(err.stack); // Log do erro no terminal
  res.status(500).json({ erro: 'Erro interno do servidor' });
});



app.listen(porta, () => {
  console.log(`Servidor rodando em http://localhost:${porta}`);
});