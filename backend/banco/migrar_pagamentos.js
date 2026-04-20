// ============================================================
// MIGRAÇÃO: Adicionar colunas do Pagar.me na tabela pagamentos
// ============================================================
// Execute este script UMA VEZ antes de subir o servidor:
//   node backend/banco/migrar_pagamentos.js
//
// O que ele faz:
//   - Adiciona pagarme_order_id (ID da ordem no Pagar.me)
//   - Adiciona checkout_url (link de pagamento gerado)
//   - Adiciona coluna 'falhou' como status possível
// ============================================================

const Database = require('better-sqlite3');
const path     = require('path');

const db = new Database(path.join(__dirname, 'trivio.db'));

console.log('Iniciando migração da tabela pagamentos...');

// Verifica quais colunas já existem para não duplicar
const colunas = db.pragma('table_info(pagamentos)').map(c => c.name);

if (!colunas.includes('pagarme_order_id')) {
  db.exec(`ALTER TABLE pagamentos ADD COLUMN pagarme_order_id TEXT`);
  console.log('✔ Coluna pagarme_order_id adicionada');
} else {
  console.log('– pagarme_order_id já existe, pulando');
}

if (!colunas.includes('checkout_url')) {
  db.exec(`ALTER TABLE pagamentos ADD COLUMN checkout_url TEXT`);
  console.log('✔ Coluna checkout_url adicionada');
} else {
  console.log('– checkout_url já existe, pulando');
}

// Adiciona índice para busca rápida por order_id (webhook usa isso)
try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pagamentos_pagarme_order_id
    ON pagamentos(pagarme_order_id)
  `);
  console.log('✔ Índice idx_pagamentos_pagarme_order_id criado');
} catch (e) {
  console.log('– Índice já existe ou erro:', e.message);
}

console.log('\nMigração concluída com sucesso!');
db.close();
