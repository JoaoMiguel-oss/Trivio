// Database setup - Initializes tables
const db = require('../banco/conexao');

function migrar(sql) {
  try { db.exec(sql); } catch (_) { /* coluna já existe */ }
}

function inicializarTabelas() {
  // Tabela de vagas
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
      bolsa_tecnica REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Database tables initialized');

  // ── Migrações seguras ──────────────────────────────────────────────────────
  migrar(`ALTER TABLE candidatos ADD COLUMN configuracoes TEXT DEFAULT '{}'`);
  migrar(`ALTER TABLE empresas   ADD COLUMN configuracoes TEXT DEFAULT '{}'`);
  migrar(`ALTER TABLE vagas      ADD COLUMN bolsa_tecnica REAL DEFAULT 0`);

  // Perfil técnico do candidato
  migrar(`ALTER TABLE candidatos ADD COLUMN github_url TEXT`);
  migrar(`ALTER TABLE candidatos ADD COLUMN linkedin_url TEXT`);
  migrar(`ALTER TABLE candidatos ADD COLUMN skills TEXT`);
  migrar(`ALTER TABLE candidatos ADD COLUMN anos_experiencia INTEGER DEFAULT 0`);
  migrar(`ALTER TABLE candidatos ADD COLUMN bio TEXT`);
  migrar(`ALTER TABLE candidatos ADD COLUMN verificado INTEGER DEFAULT 0`);

  // Entrega de solução e canal privado
  migrar(`ALTER TABLE candidaturas_desafio ADD COLUMN solucao_url TEXT`);
  migrar(`ALTER TABLE candidaturas_desafio ADD COLUMN solucao_descricao TEXT`);
  migrar(`ALTER TABLE candidaturas_desafio ADD COLUMN canal_liberado INTEGER DEFAULT 0`);

  // ── Submissão de código (sistema de submissões v1) ────────────────────────
  // codigo: código-fonte enviado pelo candidato
  // linguagem: linguagem de programação usada
  // mensagem_candidato: mensagem opcional junto à submissão
  // feedback_empresa: comentário da empresa após revisar
  migrar(`ALTER TABLE candidaturas_desafio ADD COLUMN codigo TEXT`);
  migrar(`ALTER TABLE candidaturas_desafio ADD COLUMN linguagem TEXT`);
  migrar(`ALTER TABLE candidaturas_desafio ADD COLUMN mensagem_candidato TEXT`);
  migrar(`ALTER TABLE candidaturas_desafio ADD COLUMN feedback_empresa TEXT`);

  console.log('Migrations de submissões aplicadas');
}

module.exports = inicializarTabelas;
