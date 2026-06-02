const db = require('../banco/conexao');

const listarVagas = async (req, res) => {
    try {
        const { empresa_id } = req.query;
        let query = 'SELECT * FROM vagas';
        const params = [];
        if (empresa_id) {
            query += ' WHERE empresa_id = ?';
            params.push(empresa_id);
        } else {
            query += " WHERE status = 'ativa'";
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

        // Criar desafio correspondente automaticamente
        db.prepare(`
            INSERT INTO desafios (empresa_id, vaga_id, titulo, descricao, stack, nivel, tempo_limite_h, bolsa_tecnica, status, instrucoes, criterios)
            VALUES (?, ?, ?, ?, ?, 'pleno', 4, ?, 'ativo', ?, 'Qualidade do código, arquitetura, testes e corretude.')
        `).run(
            empresa_id,
            novaVaga.id,
            titulo,
            descricao || '',
            tipo || 'Fullstack',
            bolsa_tecnica || 0,
            requisitos || 'Resolva o desafio técnico com base no enunciado da vaga.'
        );

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

        // Atualizar desafio correspondente
        const desafio = db.prepare('SELECT id FROM desafios WHERE vaga_id = ?').get(id);
        if (desafio) {
            db.prepare(`
                UPDATE desafios SET 
                    titulo = COALESCE(?, titulo),
                    descricao = COALESCE(?, descricao),
                    stack = COALESCE(?, stack),
                    bolsa_tecnica = COALESCE(?, bolsa_tecnica),
                    instrucoes = COALESCE(?, instrucoes),
                    status = COALESCE(?, status)
                WHERE vaga_id = ?
            `).run(
                titulo ?? null,
                descricao ?? null,
                tipo ?? null,
                bolsa_tecnica ?? null,
                requisitos ?? null,
                status ?? null,
                id
            );
        } else if (vagaAtualizada.empresa_id) {
            db.prepare(`
                INSERT INTO desafios (empresa_id, vaga_id, titulo, descricao, stack, nivel, tempo_limite_h, bolsa_tecnica, status, instrucoes, criterios)
                VALUES (?, ?, ?, ?, ?, 'pleno', 4, ?, ?, ?, 'Qualidade do código, arquitetura, testes e corretude.')
            `).run(
                vagaAtualizada.empresa_id,
                vagaAtualizada.id,
                vagaAtualizada.titulo,
                vagaAtualizada.descricao || '',
                vagaAtualizada.tipo || 'Fullstack',
                vagaAtualizada.bolsa_tecnica || 0,
                vagaAtualizada.status || 'ativo',
                vagaAtualizada.requisitos || 'Resolva o desafio técnico com base no enunciado da vaga.'
            );
        }

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

        // Verificar se já possui submissões/candidaturas vinculadas
        const temCandidaturas = db.prepare(`
            SELECT COUNT(*) as count 
            FROM candidaturas_desafio cd
            JOIN desafios d ON cd.desafio_id = d.id
            WHERE d.vaga_id = ?
        `).get(id);

        if (temCandidaturas && temCandidaturas.count > 0) {
            // Soft delete: Apenas muda o status para inativa para preservar o histórico
            db.prepare("UPDATE vagas SET status = 'inativa', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
            db.prepare("UPDATE desafios SET status = 'inativo' WHERE vaga_id = ?").run(id);
            return res.status(200).json({ mensagem: 'Vaga possui candidaturas. Alterada para inativa para preservar histórico.' });
        }

        // Limpa referências em outras tabelas
        db.prepare('UPDATE desafios SET vaga_id = NULL WHERE vaga_id = ?').run(id);
        db.prepare('UPDATE pagamentos SET vaga_id = NULL WHERE vaga_id = ?').run(id);
        db.prepare('UPDATE metricas_empresa SET vaga_id = NULL WHERE vaga_id = ?').run(id);

        // Deleta a vaga fisicamente
        db.prepare('DELETE FROM vagas WHERE id = ?').run(id);
        res.status(200).json({ mensagem: 'Vaga excluída com sucesso' });
    } catch (err) {
        console.error('[VAGAS DELETE]', err);
        res.status(500).json({ erro: 'Erro ao excluir vaga' });
    }
};

module.exports = { listarVagas, criarVaga, atualizarVaga, excluirVaga };
