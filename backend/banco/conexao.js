// TRIVIO - CONEXÃO COM O BANCO DE DADOS
// Este arquivo é o "coração" do sistema. Ele conecta tudo
// ao banco de dados SQLite e cria as tabelas necessárias.
// O banco de dados é como um enorme arquivo柜 com diversas
// planilhas. Cada planilha (tabela) guarda um tipo de informação.
// SQLite é um banco de dados "portátil". Não precisa instalar
// um servidor separado - o arquivo fica no próprio projeto.


// IMPORTAÇÕES
// - better-sqlite3: Biblioteca que permite usar SQLite no Node.js
// - path: Para construir o caminho do arquivo do banco

// Configuração do banco de dados SQLite local
const Database = require('better-sqlite3');
const caminho = require('path');


// CRIAR/ABRIR O BANCO DE DADOS
// Criamos (ou abrimos se já existir) o arquivo trivio.db
// na pasta banco/. O arquivo vai guardar todas as informações.
// __dirname é uma variável especial que aponta para a pasta
// onde este arquivo está (backend/banco/).

const db = new Database(caminho.join(__dirname, 'trivio.db'));


// MODO WAL (Write-Ahead Logging)
// Isso configura o banco para usar o modo WAL, que é mais
// rápido e permite múltiplas pessoas acessando ao mesmo tempo.
// É como abrir várias gavetas ao invés de uma só.

db.pragma('journal_mode = WAL');


// CRIAÇÃO DAS TABELAS
// Abaixo we're criando todas as "planilhas" do nosso banco.
// Se a tabela já existe, nada acontece (IF NOT EXISTS).


// TABELA: candidatos
// Guarda informações dos candidatos (pessoas que procuram emprego).
// Cada candidato tem:
// - id: Número único (自动递增)
// - public_id: ID único que usamos no frontend
// - nome: Nome completo
// - email: E-mail único (não pode ter dois com mesmo e-mail)
// - senha_hash: Senha criptografada
// - foto_url: Link da foto de perfil
// - github_url: Link do GitHub
// - linkedin_url: Link do LinkedIn
// - skills: Habilidades (guardado como texto JSON)
// - anos_experiencia: Anos de experiência
// - bio: Biografia/descrição
// - verificado: Se foi verificado (0 = não, 1 = sim)
// - criado_em: Data de criação ( automático)

db.exec(`
  CREATE TABLE IF NOT EXISTS candidatos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id       TEXT UNIQUE NOT NULL,
    nome            TEXT NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    senha_hash      TEXT NOT NULL,
    foto_url        TEXT,
    github_url      TEXT,
    linkedin_url    TEXT,
    skills          TEXT,
    anos_experiencia INTEGER DEFAULT 0,
    bio             TEXT,
    verificado      INTEGER DEFAULT 0,
    criado_em       DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);


// TABELA: empresas
// Guarda informações das empresas que vão contratar.
// Campos principais:
// - id: Número único
// - public_id: ID único para uso externo
// - nome: Nome da empresa
// - cnpj: CNPJ único (obrigatório)
// - email: E-mail da empresa
// - senha_hash: Senha criptografada
// - logo_url: Link do logo
// - criado_em: Data de criação

db.exec(`
  CREATE TABLE IF NOT EXISTS empresas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id   TEXT UNIQUE NOT NULL,
    nome        TEXT NOT NULL,
    cnpj        TEXT UNIQUE,
    email       TEXT UNIQUE NOT NULL,
    senha_hash  TEXT NOT NULL,
    logo_url    TEXT,
    criado_em   DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);


// TABELA: desafios
// Desafios técnicos são testes que as empresas criam para
// avaliar candidatos. É como uma "prova" de emprego.
// Cada desafio tem:
// - empresa_id: Qual empresa criou
// - vaga_id: Vinculado a uma vaga (opcional)
// - titulo: Nome do desafio
// - descricao: O que precisa fazer
// - stack: Tecnologias envolvidas (React, Node, etc)
// - nivel: junior, pleno ou senior
// - tempo_limite_h: Horas para completar
// - bolsa_tecnica: Valor pago ao candidato
// - status: ativo, inativo ou encerrado
// - instrucoes: Como entregar
// - criterios: Como será avaliado

db.exec(`
  CREATE TABLE IF NOT EXISTS desafios (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id      TEXT NOT NULL,
    vaga_id         INTEGER,
    titulo          TEXT NOT NULL,
    descricao       TEXT NOT NULL,
    stack           TEXT NOT NULL,
    nivel           TEXT DEFAULT 'junior',
    tempo_limite_h  INTEGER DEFAULT 4,
    bolsa_tecnica   REAL DEFAULT 0,
    status          TEXT DEFAULT 'ativo',
    instrucoes      TEXT,
    criterios       TEXT,
    criado_em       DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);


// TABELA: candidaturas_desafio
// Guarda quem está fazendo qual desafio.
// Cada candidato só pode fazer UM desafio por vaga
// (para evitar "spamm" de candidaturas).
// Campos:
// - desafio_id: Qual desafio
// - candidato_id: Quem está fazendo
// - status: em_andamento, entregue, aprovado, reprovado
// - iniciado_em: Quando começou
// - entregue_em: Quando enviou
// - solucao_url: Link da solução (GitHub, etc)
// - solucao_descricao: Explicação da solução
// - score_ia: Nota dada pela IA
// - relatorio_ia: Detalhes da avaliação
// - avancou_entrevista: Se passou para próxima fase
// - canal_liberado: Se pode messaging com empresa

db.exec(`
  CREATE TABLE IF NOT EXISTS candidaturas_desafio (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    desafio_id          INTEGER NOT NULL,
    candidato_id        TEXT NOT NULL,
    status              TEXT DEFAULT 'em_andamento',
    iniciado_em         DATETIME DEFAULT CURRENT_TIMESTAMP,
    entregue_em         DATETIME,
    solucao_url         TEXT,
    solucao_descricao   TEXT,
    score_ia            REAL,
    relatorio_ia        TEXT,
    avancou_entrevista  INTEGER DEFAULT 0,
    canal_liberado      INTEGER DEFAULT 0,
    UNIQUE(desafio_id, candidato_id)
  )
`);


// TABELA: mensagens_canal
// Canal privado de mensagens entre empresa e candidato.
// Só é liberado após a empresa "avançar" o candidato.
// Estrutura similar a um chat:
// - desafio_id: Contexto da conversa
// - candidato_id e empresa_id: Participantes
// - remetente_tipo: quem enviou (candidato ou empresa)
// - texto: Mensagem
// - lida: Se já foi lida (0 = não, 1 = sim)
// - enviada_em: Data/hora

db.exec(`
  CREATE TABLE IF NOT EXISTS mensagens_canal (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    desafio_id      INTEGER NOT NULL,
    candidato_id    TEXT NOT NULL,
    remetente_tipo  TEXT NOT NULL,
    remetente_id    TEXT NOT NULL,
    texto           TEXT NOT NULL,
    lida            INTEGER DEFAULT 0,
    enviada_em      DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);


// TABELA: pagamentos
// Registra todos os pagamentos:
// - taxa_plataforma: Taxa que a Trivio cobra
// - bolsa_tecnica: Valor pago ao candidato
// Campos:
// - empresa_id: Quem pagou
// - vaga_id: Qual vaga
// - tipo: tipo do pagamento
// - valor: Valor em reais
// - status: pendente, pago ou estornado
// - paid_at: Quando foi pago

db.exec(`
  CREATE TABLE IF NOT EXISTS pagamentos (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id          TEXT NOT NULL,
    vaga_id             INTEGER,
    tipo                TEXT NOT NULL, -- 'taxa_plataforma' | 'bolsa_tecnica'
    valor               REAL NOT NULL,
    status              TEXT DEFAULT 'pendente', -- 'pendente' | 'pago' | 'estornado'
    descricao           TEXT,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    paid_at             DATETIME
  )
`);


// TABELA: metricas_empresa
// Guarda métricas do processo seletivo de cada empresa.
// Ajuda a ver como está o funil de contratações.
// Métricas guardadas:
// - candidatos_total: Total que se candidataram
// - desafios_iniciados: Quantos começaram desafios
// - desafios_entregues: Quantos entregaram
// - entrevistas_agendadas: Quantos passaram para entrevista
// - tempo_medio_shortlist_minutos: Tempo médio para filtrar

db.exec(`
  CREATE TABLE IF NOT EXISTS metricas_empresa (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id          TEXT NOT NULL,
    vaga_id             INTEGER,
    candidatos_total    INTEGER DEFAULT 0,
    desafios_iniciados  INTEGER DEFAULT 0,
    desafios_entregues  INTEGER DEFAULT 0,
    entrevistas_agendadas INTEGER DEFAULT 0,
    tempo_medio_shortlist_minutos INTEGER DEFAULT 0,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);


// TABELA: historico_atividades
// LOG de todas as ações do sistema. É como um "diário"
// que registra o que aconteceu, quando e quem fez.
// Útil para:
// - Auditoria (saber o que aconteceu)
// - Metrics (gerar relatórios)
// - Debug (descobrir onde deu erro)
// Entidade pode ser: vaga, desafio, candidatura, pagamento

db.exec(`
  CREATE TABLE IF NOT EXISTS historico_atividades (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    entidade_tipo       TEXT NOT NULL, -- 'vaga' | 'desafio' | 'candidatura' | 'pagamento'
    entidade_id         INTEGER NOT NULL,
    acao                TEXT NOT NULL,
    detalhes            TEXT,
    usuario_id          TEXT,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);


// EXPORTA O BANCO DE DADOS
// Exporta o objeto 'db' para que outros arquivos possam
// usar o banco de dados. É como emprestar o arquivo柜.

module.exports = db;