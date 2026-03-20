// Configuração do banco de dados SQLite local
const Database = require('better-sqlite3');
const caminho = require('path');

const db = new Database(caminho.join(__dirname, 'trivio.db'));

// Habilita WAL mode para melhor performance
db.pragma('journal_mode = WAL');

// Tabela de candidatos (com perfil técnico)
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

// Tabela de empresas
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

// Tabela de desafios técnicos
// Cada desafio é derivado de um problema real já resolvido internamente pela empresa,
// isolado de todo código proprietário ou sistema de produção.
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

// Tabela de candidaturas a desafios
// Um candidato pode receber apenas UM desafio por vaga (sem exploração em massa)
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

// Canal privado de mensagens (liberado após empresa avançar candidato)
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

// Tabela de pagamentos (taxa plataforma + bolsa técnica)
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

// Métricas do processo seletivo por empresa
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

// Histórico de atividades (para auditoria e métricas)
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

module.exports = db;