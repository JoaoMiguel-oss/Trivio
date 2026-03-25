const db = require('../banco/conexao');

const listarVagas = async (req, res) => {
    try {
        const { empresa_id } = req.query;
        let query = 'SELECT * FROM vagas';
        const params = [];
        if (empresa_id) {
            query += ' WHERE empresa_id = ?';
            params.push(empresa_id);
        }
        query += ' ORDER BY created_at DESC';
        const vagas = db.prepare(query).all(...params);
        res.status(200).json(vagas);
    } catch (err) {
        console.error('[VAGAS LIST]', err);
        res.status(500).json({ erro: 'Erro ao listar vagas' });
    }
};

const criarVaga = async (req, res) => {
    try {
        const { empresa_id, titulo, descricao, requisitos, remuneracao, localizacao, tipo, bolsa_tecnica } = req.body;
        if (!empresa_id || !titulo) {
            return res.status(400).json({ erro: 'empresa_id e titulo são obrigatórios' });
        }

        const status = 'ativa';
        const result = db.prepare(`
            INSERT INTO vagas (empresa_id, titulo, descricao, requisitos, remuneracao, localizacao, tipo, status, bolsa_tecnica)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(empresa_id, titulo, descricao || '', requisitos || '', remuneracao || '', localizacao || '', tipo || 'CLT', status, bolsa_tecnica || 0);

        const novaVaga = db.prepare('SELECT * FROM vagas WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(novaVaga);
    } catch (err) {
        console.error('[VAGAS CREATE]', err);
        res.status(500).json({ erro: 'Erro ao criar vaga' });
    }
};

const atualizarVaga = async (req, res) => {
    try {
        const { id } = req.params;
        const v = db.prepare('SELECT * FROM vagas WHERE id = ?').get(id);
        if (!v) return res.status(404).json({ erro: 'Vaga não encontrada' });

        const { titulo, descricao, requisitos, remuneracao, localizacao, tipo, status, bolsa_tecnica } = req.body;

        db.prepare(`
            UPDATE vagas SET 
                titulo = COALESCE(?, titulo),
                descricao = COALESCE(?, descricao),
                requisitos = COALESCE(?, requisitos),
                remuneracao = COALESCE(?, remuneracao),
                localizacao = COALESCE(?, localizacao),
                tipo = COALESCE(?, tipo),
                status = COALESCE(?, status),
                bolsa_tecnica = COALESCE(?, bolsa_tecnica),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(titulo ?? null, descricao ?? null, requisitos ?? null, remuneracao ?? null, localizacao ?? null, tipo ?? null, status ?? null, bolsa_tecnica ?? null, id);

        const vagaAtualizada = db.prepare('SELECT * FROM vagas WHERE id = ?').get(id);
        res.status(200).json(vagaAtualizada);
    } catch (err) {
        console.error('[VAGAS UPDATE]', err);
        res.status(500).json({ erro: 'Erro ao atualizar vaga' });
    }
};

const excluirVaga = async (req, res) => {
    try {
        const { id } = req.params;
        const v = db.prepare('SELECT * FROM vagas WHERE id = ?').get(id);
        if (!v) return res.status(404).json({ erro: 'Vaga não encontrada' });

        db.prepare('UPDATE vagas SET status = ? WHERE id = ?').run('inativa', id);
        res.status(200).json({ mensagem: 'Vaga inativada com sucesso' });
    } catch (err) {
        console.error('[VAGAS DELETE]', err);
        res.status(500).json({ erro: 'Erro ao excluir vaga' });
    }
};

module.exports = { listarVagas, criarVaga, atualizarVaga, excluirVaga };
