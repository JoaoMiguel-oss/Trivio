const db = require('./conexao');

function migrar() {
    console.log('Iniciando migracao: Analise IA...');

    try {
        const colunas = db.prepare("PRAGMA table_info(candidaturas_desafio)").all();
        const temScoreIA = colunas.some(c => c.name === 'score_ia');
        const temRelatorioIA = colunas.some(c => c.name === 'relatorio_ia');

        if (temScoreIA && temRelatorioIA) {
            console.log('Colunas ja existem. Migracao nao necessaria.');
            return;
        }

        if (!temScoreIA) {
            db.exec(`ALTER TABLE candidaturas_desafio ADD COLUMN score_ia INTEGER`);
            console.log('Coluna score_ia adicionada');
        }

        if (!temRelatorioIA) {
            db.exec(`ALTER TABLE candidaturas_desafio ADD COLUMN relatorio_ia TEXT`);
            console.log('Coluna relatorio_ia adicionada');
        }

        console.log('Migracao concluida com sucesso!');
        
    } catch (err) {
        console.error('Erro durante migracao:', err.message);
        process.exit(1);
    }
}

if (require.main === module) {
    migrar();
    process.exit(0);
}

module.exports = migrar;
