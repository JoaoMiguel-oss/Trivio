// Database setup - Initializes tables
const db = require('../banco/conexao');

function migrar(sql) {
  try { db.exec(sql); } catch (_) { /* coluna já existe */ }
}

function inicializarTabelas() {
  // Tabela de casos de teste vinculados a desafios
  db.exec(`
    CREATE TABLE IF NOT EXISTS casos_teste (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      desafio_id       INTEGER NOT NULL,
      input            TEXT,
      output_esperado  TEXT NOT NULL,
      peso             INTEGER DEFAULT 1,
      descricao        TEXT,
      criado_em        DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);


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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      pagarme_order_id TEXT,
      checkout_url TEXT
    )
  `);

  console.log('Database tables initialized');

  // Migrações seguras
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

  // Submissão de código (sistema de submissões v1)
  // codigo: código-fonte enviado pelo candidato
  // linguagem: linguagem de programação usada
  // mensagem_candidato: mensagem opcional junto à submissão
  // feedback_empresa: comentário da empresa após revisar
  migrar(`ALTER TABLE candidaturas_desafio ADD COLUMN codigo TEXT`);
  migrar(`ALTER TABLE candidaturas_desafio ADD COLUMN linguagem TEXT`);
  migrar(`ALTER TABLE candidaturas_desafio ADD COLUMN mensagem_candidato TEXT`);
  migrar(`ALTER TABLE candidaturas_desafio ADD COLUMN feedback_empresa TEXT`);

  console.log('Migrations de submissões aplicadas');

  // Campos para correção automática por casos de teste
  migrar(`ALTER TABLE candidaturas_desafio ADD COLUMN testes_passados INTEGER DEFAULT 0`);
  migrar(`ALTER TABLE candidaturas_desafio ADD COLUMN total_testes INTEGER DEFAULT 0`);
  migrar(`ALTER TABLE candidaturas_desafio ADD COLUMN resultado_execucao TEXT`);
  migrar(`ALTER TABLE candidaturas_desafio ADD COLUMN entregue_em DATETIME`);
  migrar(`ALTER TABLE candidaturas_desafio ADD COLUMN avancou_entrevista INTEGER DEFAULT 0`);

  console.log('Migrations de auto-correção aplicadas');

  // Sincronizar vagas antigas sem desafio correspondente
  try {
    const vagasSemDesafio = db.prepare(`
      SELECT v.* FROM vagas v
      LEFT JOIN desafios d ON v.id = d.vaga_id
      WHERE d.id IS NULL AND v.empresa_id IS NOT NULL
    `).all();

    for (const v of vagasSemDesafio) {
      db.prepare(`
        INSERT INTO desafios (empresa_id, vaga_id, titulo, descricao, stack, nivel, tempo_limite_h, bolsa_tecnica, status, instrucoes, criterios)
        VALUES (?, ?, ?, ?, ?, 'pleno', 4, ?, 'ativo', ?, 'Qualidade do código, arquitetura, testes e corretude.')
      `).run(
        v.empresa_id,
        v.id,
        v.titulo,
        v.descricao || '',
        v.tipo || 'Fullstack',
        v.bolsa_tecnica || 0,
        v.requisitos || 'Resolva o desafio técnico com base no enunciado da vaga.'
      );
    }
    if (vagasSemDesafio.length > 0) {
      console.log(`[DB SYNC] Sincronizados ${vagasSemDesafio.length} desafios de vagas antigas`);
    }
  } catch (e) {
    console.error('[DB SYNC ERROR] Erro na sincronização de vagas e desafios:', e);
  }
}

module.exports = inicializarTabelas;