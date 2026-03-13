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

  // Adicionar coluna de configurações se não existir
  try {
    db.exec(`ALTER TABLE candidatos ADD COLUMN configuracoes TEXT DEFAULT '{}'`);
    console.log('Coluna configuracoes alterada em candidatos');
  } catch (err) {
    // a coluna já existe
  }

  try {
    db.exec(`ALTER TABLE empresas ADD COLUMN configuracoes TEXT DEFAULT '{}'`);
    console.log('Coluna configuracoes alterada em empresas');
  } catch (err) {
    // a coluna já existe
  }
}

module.exports = inicializarTabelas;
