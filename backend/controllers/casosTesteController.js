// TRIVIO - CONTROLLER DE CASOS DE TESTE
// CRUD de casos de teste vinculados a desafios.
// Apenas a empresa dona do desafio pode criar/editar/deletar casos.
// Candidatos não têm acesso a este endpoint (inputs/outputs são privados).

const db = require('../banco/conexao');

// POST /api/v1/desafios/:id/casos-teste
const criarCasoTeste = (req, res) => {
    try {
        const desafio_id = parseInt(req.params.id, 10);
        const empresa_id = req.headers['id-usuario'];
        const { input, output_esperado, peso, descricao } = req.body;

        if (!output_esperado) {
            return res.status(400).json({ sucesso: false, mensagem: 'output_esperado é obrigatório' });
        }

        // Verifica que o desafio existe e pertence a esta empresa
        const desafio = db.prepare('SELECT * FROM desafios WHERE id = ?').get(desafio_id);
        if (!desafio) {
            return res.status(404).json({ sucesso: false, mensagem: 'Desafio não encontrado' });
        }
        if (empresa_id && desafio.empresa_id !== empresa_id) {
            return res.status(403).json({ sucesso: false, mensagem: 'Você não tem permissão para este desafio' });
        }

        const resultado = db.prepare(`
            INSERT INTO casos_teste (desafio_id, input, output_esperado, peso, descricao)
            VALUES (?, ?, ?, ?, ?)
        `).run(desafio_id, input || '', output_esperado, peso || 1, descricao || null);

        const criado = db.prepare('SELECT * FROM casos_teste WHERE id = ?').get(resultado.lastInsertRowid);
        return res.status(201).json({ sucesso: true, caso_teste: criado });

    } catch (err) {
        console.error('[CASOS TESTE CREATE]', err);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao criar caso de teste' });
    }
};

// GET /api/v1/desafios/:id/casos-teste
const listarCasosTeste = (req, res) => {
    try {
        const desafio_id = parseInt(req.params.id, 10);
        const empresa_id = req.headers['id-usuario'];

        const desafio = db.prepare('SELECT * FROM desafios WHERE id = ?').get(desafio_id);
        if (!desafio) {
            return res.status(404).json({ sucesso: false, mensagem: 'Desafio não encontrado' });
        }
        if (empresa_id && desafio.empresa_id !== empresa_id) {
            return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado' });
        }

        const casos = db.prepare(
            'SELECT * FROM casos_teste WHERE desafio_id = ? ORDER BY id ASC'
        ).all(desafio_id);

        return res.status(200).json({ sucesso: true, casos_teste: casos, total: casos.length });

    } catch (err) {
        console.error('[CASOS TESTE LIST]', err);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar casos de teste' });
    }
};

// PUT /api/v1/desafios/:id/casos-teste/:caso_id
const atualizarCasoTeste = (req, res) => {
    try {
        const desafio_id = parseInt(req.params.id, 10);
        const caso_id = parseInt(req.params.caso_id, 10);
        const empresa_id = req.headers['id-usuario'];
        const { input, output_esperado, peso, descricao } = req.body;

        const desafio = db.prepare('SELECT * FROM desafios WHERE id = ?').get(desafio_id);
        if (!desafio) {
            return res.status(404).json({ sucesso: false, mensagem: 'Desafio não encontrado' });
        }
        if (empresa_id && desafio.empresa_id !== empresa_id) {
            return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado' });
        }

        const caso = db.prepare('SELECT * FROM casos_teste WHERE id = ? AND desafio_id = ?').get(caso_id, desafio_id);
        if (!caso) {
            return res.status(404).json({ sucesso: false, mensagem: 'Caso de teste não encontrado' });
        }

        db.prepare(`
            UPDATE casos_teste
            SET input           = COALESCE(?, input),
                output_esperado = COALESCE(?, output_esperado),
                peso            = COALESCE(?, peso),
                descricao       = COALESCE(?, descricao)
            WHERE id = ?
        `).run(
            input !== undefined ? input : null,
            output_esperado || null,
            peso || null,
            descricao !== undefined ? descricao : null,
            caso_id
        );

        const atualizado = db.prepare('SELECT * FROM casos_teste WHERE id = ?').get(caso_id);
        return res.status(200).json({ sucesso: true, caso_teste: atualizado });

    } catch (err) {
        console.error('[CASOS TESTE UPDATE]', err);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar caso de teste' });
    }
};

// DELETE /api/v1/desafios/:id/casos-teste/:caso_id
const deletarCasoTeste = (req, res) => {
    try {
        const desafio_id = parseInt(req.params.id, 10);
        const caso_id = parseInt(req.params.caso_id, 10);
        const empresa_id = req.headers['id-usuario'];

        const desafio = db.prepare('SELECT * FROM desafios WHERE id = ?').get(desafio_id);
        if (!desafio) {
            return res.status(404).json({ sucesso: false, mensagem: 'Desafio não encontrado' });
        }
        if (empresa_id && desafio.empresa_id !== empresa_id) {
            return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado' });
        }

        const caso = db.prepare('SELECT * FROM casos_teste WHERE id = ? AND desafio_id = ?').get(caso_id, desafio_id);
        if (!caso) {
            return res.status(404).json({ sucesso: false, mensagem: 'Caso de teste não encontrado' });
        }

        db.prepare('DELETE FROM casos_teste WHERE id = ?').run(caso_id);
        return res.status(200).json({ sucesso: true, mensagem: 'Caso de teste removido' });

    } catch (err) {
        console.error('[CASOS TESTE DELETE]', err);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao deletar caso de teste' });
    }
};

module.exports = { criarCasoTeste, listarCasosTeste, atualizarCasoTeste, deletarCasoTeste };
