// ============================================================
// TRIVIO - SERVIDOR PRINCIPAL
// ============================================================
// Este é o arquivo que coloca o sistema para funcionar.
// Pense nele como o "maestro" que coordena toda a orquestra.
// Sem ele, nada funciona!
//
// Vamos entender o que cada biblioteca faz:
//
// - dotenv: É como um caderno de segredos. Guarda configurações
//           confidenciais (como senhas de banco) de forma segura.
//
// - express: É o framework principal. Ele cria o servidor web.
//           Sem ele, seria muito difícil criar APIs e rotas.
//
// - path: Ajuda a encontrar arquivos no computador. É como um
//         GPS para navegar entre pastas.
//
// - cors: Permite que diferentes sistemas conversem entre si.
//         Sem ele, o frontend não conseguiria falar com o backend.
//
// - helmet: Adiciona camada de segurança. Protege contra ataques.
//
// - morgan: Faz logs (anotações) de todas as requisições. Ajuda
//           a debugar quando algo dá errado.
// ============================================================

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


// ============================================================
// IMPORTAÇÃO DAS ROTAS
// ============================================================
// Imagine as rotas como diferentes departamentos de uma empresa.
// Cada uma cuidar de uma área específica:
//
// - userRoutes: Cuida dos usuários (cadastro, perfil, etc)
// - authRoutes: Cuida da autenticação (login, logout)
// - desafiosRoutes: Cuida dos desafios (criar, listar, participar)
// - pagamentosRoutes: Cuida dos pagamentos
// - vagasRoutes: Cuida das vagas de emprego
// ============================================================

const userRoutes = require('./userRoutes');
const authRoutes = require('./rotas/auth');
const desafiosRoutes = require('./rotas/desafios');
const pagamentosRoutes = require('./rotas/pagamentos');
const vagasRoutes = require('./rotas/vagas');

// Importa a função que cria as tabelas do banco de dados
const inicializarTabelas = require('./database/setup');


// ============================================================
// CONFIGURAÇÃO DO SERVIDOR
// ============================================================

// Cria a aplicação Express - é como inicializar o servidor
const app = express();

// Define a porta do servidor (usa a variável PORT ou 3001 como padrão)
const porta = process.env.PORT || 3001;


// ============================================================
// MIDDLEWARES (Configurações intermediárias)
// ============================================================
// Middlewares são funções que processam as requisições antes
// de chegar às rotas. É como um porteiro que verifica tudo.
//
// morgan('dev'): Loga todas as requisições no terminal.
//                Ajuda a ver o que está acontecendo.
//
// cors({...}): Permite que diferentes domínios conversem.
//              Sem isso, o frontend no localhost:3002 não
//              conseguiria falar com o backend no localhost:3001.
//
// express.json(): Permite que o servidor entenda dados JSON
//                 que vem nas requisições.
// ============================================================

// app.use(helmet()); // Descomente para adicionar mais segurança
app.use(morgan('dev')); // Loga as requisições no console
app.use(cors({
  origin: '*',  // Permite qualquer domínio acessar
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json()); // Permite receber dados em formato JSON


// ============================================================
// ARQUIVOS ESTÁTICOS (Frontend)
// ============================================================
// Aqui we're telling the server to serve files from the public
// folder. É como dizer: "Se alguém pedir um arquivo, procure
// na pasta public". Isso inclui HTML, CSS, JS e imagens.
// ============================================================

// Serve arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, '..', 'public')));

// Aliases para pastas com espaço no nome (solução para URLs)
// Isso permite acessar via /frontend/tela-principal ao invés de
// ter que lidar com espaços nas URLs
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


// ============================================================
// INICIALIZAÇÃO DO BANCO DE DADOS
// ============================================================
// Antes de tudo, precisamos criar as tabelas no banco de dados.
// Se não existirem, o sistema não vai funcionar direito.
// ============================================================

inicializarTabelas();


// ============================================================
// REGISTRO DAS ROTAS DA API
// ============================================================
// Aqui registramos todas as rotas (endpoints) do sistema.
// O prefixo /api/v1 serve para versionar a API.
// É como dizer: "Todas essas rotas começam com /api/v1/"
//
// Exemplos de URLs resultantes:
// - POST /api/v1/auth/cadastro (cadastrar usuário)
// - POST /api/v1/auth/login (fazer login)
// - GET /api/v1/desafios (listar desafios)
// - POST /api/v1/desafios (criar desafio)
// ============================================================

app.use('/api/v1', userRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/desafios', desafiosRoutes);
app.use('/api/v1/pagamentos', pagamentosRoutes);
app.use('/api/v1/vagas', vagasRoutes);


// ============================================================
// TRATAMENTO DE ERROS
// ============================================================
// Se nenhuma rota atender a requisição, chegamos aqui.
// É como o "cão de guarda" que pega tudo que escapa.
//
// 404: Rota não encontrada - o caminho digitado não existe.
//
// 500: Erro interno - algo deu errado no servidor.
// ============================================================

// Middleware para rota não encontrada (404)
app.use((req, res, next) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

// Middleware global de tratamento de erros (500)
app.use((err, req, res, next) => {
  console.error(err.stack); // Log do erro no terminal
  res.status(500).json({ erro: 'Erro interno do servidor' });
});


// ============================================================
// INICIAR O SERVIDOR
// ============================================================
// Finally! Após toda a configuração, vamos colocar pra rodar.
// O servidor vai ficar escutando na porta definida.
// ============================================================

app.listen(porta, () => {
  console.log(`Servidor rodando em http://localhost:${porta}`);
});
