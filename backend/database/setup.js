// Database setup - Initializes tables
const db = require('../banco/conexao');

function inicializarTabelas() {
  // Create vagas table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS vagas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa_id TEXT,
      titulo TEXT NOT NULL,
      descricao TEXT,
      requisitos TEXT,
      remuneracao TEXT,
      localizacao TEXT,
      tipo TEXT DEFAULT 'CLT',
      status TEXT DEFAULT 'ativa',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Database tables initialized');
}

module.exports = inicializarTabelas;
