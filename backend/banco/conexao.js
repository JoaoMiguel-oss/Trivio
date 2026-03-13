// Configuração do banco de dados SQLite local
const Database = require('better-sqlite3');
const caminho = require('path');

const db = new Database(caminho.join(__dirname, 'trivio.db'));

// Habilita WAL mode para melhor performance
db.pragma('journal_mode = WAL');

// Tabela de candidatos
db.exec(`
  CREATE TABLE IF NOT EXISTS candidatos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id   TEXT UNIQUE NOT NULL,
    nome        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    senha_hash  TEXT NOT NULL,
    foto_url    TEXT,
    criado_em   DATETIME DEFAULT CURRENT_TIMESTAMP
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

module.exports = db;