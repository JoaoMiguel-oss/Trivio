const Database = require('better-sqlite3');
const path     = require('path');

const db = new Database(path.join(__dirname, 'trivio.db'));

console.log('Iniciando migracao da tabela pagamentos...');

const colunas = db.pragma('table_info(pagamentos)').map(c => c.name);

if (!colunas.includes('pagarme_order_id')) {
  db.exec(`ALTER TABLE pagamentos ADD COLUMN pagarme_order_id TEXT`);
  console.log('Coluna pagarme_order_id adicionada');
} else {
  console.log('pagarme_order_id ja existe, pulando');
}

if (!colunas.includes('checkout_url')) {
  db.exec(`ALTER TABLE pagamentos ADD COLUMN checkout_url TEXT`);
  console.log('Coluna checkout_url adicionada');
} else {
  console.log('checkout_url ja existe, pulando');
}

try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pagamentos_pagarme_order_id
    ON pagamentos(pagarme_order_id)
  `);
  console.log('Indice idx_pagamentos_pagarme_order_id criado');
} catch (e) {
  console.log('Indice ja existe ou erro:', e.message);
}

console.log('Migracao concluida com sucesso!');
db.close();
