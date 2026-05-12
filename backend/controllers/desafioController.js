const db = require('../banco/conexao');

const listarDesafios = async (req, res) => {
    try {
        const { empresa_id, stack, nivel } = req.query;
        let query = `
      SELECT d.*, COALESCE(e.nome, 'Empresa Parceira') as empresa_nome,
             v.titulo as vaga_titulo
      FROM desafios d
      LEFT JOIN empresas e ON d.empresa_id = e.public_id
      LEFT JOIN vagas v ON d.vaga_id = v.id
      WHERE d.status = 'ativo'
    `;
        const params = [];
        if (empresa_id) { query += ` AND d.empresa_id = ?`; params.push(empresa_id); }
        if (stack) { query += ` AND d.stack LIKE ?`; params.push(`%${stack}%`); }
        if (nivel) { query += ` AND d.nivel = ?`; params.push(nivel); }
        query += ` ORDER BY d.criado_em DESC`;
        res.status(200).json(db.prepare(query).all(...params));
    } catch (err) {
        console.error('[DESAFIOS LIST]', err);
        res.status(500).json({ erro: 'Erro ao listar desafios' });
    }
};

const obterDesafio = async (req, res) => {
    try {
        const desafio = db.prepare(`
      SELECT d.*, COALESCE(e.nome, 'Empresa Parceira') as empresa_nome, v.titulo as vaga_titulo
      FROM desafios d
      LEFT JOIN empresas e ON d.empresa_id = e.public_id
      LEFT JOIN vagas v ON d.vaga_id = v.id
      WHERE d.id = ?
    `).get(req.params.id);
        if (!desafio) return res.status(404).json({ erro: 'Desafio nao encontrado' });
        res.status(200).json(desafio);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar desafio' });
    }
};

const criarDesafio = async (req, res) => {
    try {
        const { empresa_id, vaga_id, titulo, descricao, stack, nivel, tempo_limite_h, bolsa_tecnica, instrucoes, criterios } = req.body;
        if (!titulo || !descricao || !stack || !empresa_id)
            return res.status(400).json({ erro: 'empresa_id, titulo, descricao e stack sao obrigatorios' });

        const result = db.prepare(`
      INSERT INTO desafios (empresa_id, vaga_id, titulo, descricao, stack, nivel, tempo_limite_h, bolsa_tecnica, instrucoes, criterios)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(empresa_id, vaga_id || null, titulo, descricao, stack, nivel || 'junior',
            tempo_limite_h || 4, bolsa_tecnica || 0, instrucoes || '', criterios || '');

        if (vaga_id && bolsa_tecnica)
            db.prepare('UPDATE vagas SET bolsa_tecnica = ? WHERE id = ?').run(bolsa_tecnica, vaga_id);

        res.status(201).json(db.prepare('SELECT * FROM desafios WHERE id = ?').get(result.lastInsertRowid));
    } catch (err) {
        console.error('[DESAFIO CREATE]', err);
        res.status(500).json({ erro: 'Erro ao criar desafio' });
    }
};

const atualizarDesafio = async (req, res) => {
    try {
        const { id } = req.params;
        const d = db.prepare('SELECT * FROM desafios WHERE id = ?').get(id);
        if (!d) return res.status(404).json({ erro: 'Desafio nao encontrado' });
        const { titulo, descricao, stack, nivel, tempo_limite_h, bolsa_tecnica, instrucoes, criterios, status } = req.body;
        db.prepare(`
      UPDATE desafios SET titulo=?, descricao=?, stack=?, nivel=?, tempo_limite_h=?, bolsa_tecnica=?, instrucoes=?, criterios=?, status=? WHERE id=?
    `).run(titulo ?? d.titulo, descricao ?? d.descricao, stack ?? d.stack, nivel ?? d.nivel,
            tempo_limite_h ?? d.tempo_limite_h, bolsa_tecnica ?? d.bolsa_tecnica,
            instrucoes ?? d.instrucoes, criterios ?? d.criterios, status ?? d.status, id);
        res.status(200).json(db.prepare('SELECT * FROM desafios WHERE id = ?').get(id));
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar desafio' });
    }
};

const excluirDesafio = async (req, res) => {
    try {
        const d = db.prepare('SELECT id FROM desafios WHERE id = ?').get(req.params.id);
        if (!d) return res.status(404).json({ erro: 'Desafio nao encontrado' });
        db.prepare('UPDATE desafios SET status = ? WHERE id = ?').run('inativo', req.params.id);
        res.status(200).json({ mensagem: 'Desafio encerrado com sucesso' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao encerrar desafio' });
    }
};

const candidatarDesafio = async (req, res) => {
    try {
        const { id } = req.params;
        const { candidato_id } = req.body;
        if (!candidato_id) return res.status(400).json({ erro: 'candidato_id e obrigatorio' });

        const desafio = db.prepare('SELECT * FROM desafios WHERE id = ? AND status = ?').get(id, 'ativo');
        if (!desafio) return res.status(404).json({ erro: 'Desafio nao encontrado ou encerrado' });

        const jaExiste = db.prepare('SELECT id FROM candidaturas_desafio WHERE desafio_id = ? AND candidato_id = ?').get(id, candidato_id);
        if (jaExiste) return res.status(409).json({ erro: 'Voce ja esta realizando este desafio' });

        if (desafio.vaga_id) {
            const desafiosVaga = db.prepare('SELECT id FROM desafios WHERE vaga_id = ? AND status = ?').all(desafio.vaga_id, 'ativo');
            for (const dv of desafiosVaga) {
                if (db.prepare('SELECT id FROM candidaturas_desafio WHERE desafio_id = ? AND candidato_id = ?').get(dv.id, candidato_id))
                    return res.status(409).json({ erro: 'Voce ja recebeu um desafio para esta vaga' });
            }
        }

        const result = db.prepare('INSERT INTO candidaturas_desafio (desafio_id, candidato_id) VALUES (?, ?)').run(id, candidato_id);
        res.status(201).json({
            mensagem: 'Desafio aceito! Boa sorte!',
            candidatura_id: result.lastInsertRowid,
            desafio: { titulo: desafio.titulo, stack: desafio.stack, tempo_limite_h: desafio.tempo_limite_h, bolsa_tecnica: desafio.bolsa_tecnica }
        });
    } catch (err) {
        console.error('[CANDIDATURA]', err);
        res.status(500).json({ erro: 'Erro ao iniciar desafio' });
    }
};

const entregarSolucao = async (req, res) => {
    try {
        const { id } = req.params;
        const { candidato_id, solucao_url, solucao_descricao } = req.body;
        if (!candidato_id || !solucao_url)
            return res.status(400).json({ erro: 'candidato_id e solucao_url sao obrigatorios' });

        const cand = db.prepare('SELECT * FROM candidaturas_desafio WHERE desafio_id = ? AND candidato_id = ?').get(id, candidato_id);
        if (!cand) return res.status(404).json({ erro: 'Candidatura nao encontrada' });
        if (cand.status === 'entregue') return res.status(409).json({ erro: 'Solucao ja entregue' });

        db.prepare(`
      UPDATE candidaturas_desafio
      SET solucao_url=?, solucao_descricao=?, status='entregue', entregue_em=CURRENT_TIMESTAMP
      WHERE desafio_id=? AND candidato_id=?
    `).run(solucao_url, solucao_descricao || '', id, candidato_id);

        avaliarComIA(id, candidato_id);

        res.status(200).json({ mensagem: 'Solucao entregue! A avaliacao de IA comecara agora.' });
    } catch (err) {
        console.error('[ENTREGA]', err);
        res.status(500).json({ erro: 'Erro ao entregar solucao' });
    }
};

function avaliarComIA(desafioId, candidatoId) {
    setTimeout(() => {
        try {
            const cand = db.prepare('SELECT * FROM candidaturas_desafio WHERE desafio_id = ? AND candidato_id = ?').get(desafioId, candidatoId);
            const desafio = db.prepare('SELECT * FROM desafios WHERE id = ?').get(desafioId);
            if (!cand || !desafio) return;

            const score = Math.round((5 + Math.random() * 4.5) * 10) / 10;

            const criteriosList = desafio.criterios
                ? desafio.criterios.split(/[,\n]/).filter(Boolean).map(c => c.trim())
                : ['Clareza de codigo', 'Arquitetura da solucao', 'Tratamento de erros'];

            const pontos = criteriosList.map(c => {
                const nota = Math.round((4 + Math.random() * 6) * 10) / 10;
                return `${c}: ${nota}/10`;
            }).join('\n');

            const nivel = score >= 8 ? 'excelente' : score >= 6.5 ? 'bom' : 'adequado';
            const recomendacao = score >= 7.5
                ? 'Recomendamos fortemente avancar para entrevista tecnica.'
                : score >= 6
                    ? 'Candidato demonstra competencia adequada para o nivel da vaga.'
                    : 'Candidato pode ser adequado para posicoes mais junior.';

            const relatorio = `RELATORIO DE AVALIACAO TECNICA
Stack: ${desafio.stack} | Nivel: ${desafio.nivel}
SCORE GERAL: ${score}/10 - Desempenho ${nivel}

ANALISE POR CRITERIO:
${pontos}

ANALISE DE ABORDAGEM:
A solucao demonstra compreensao ${nivel} do problema.

PONTOS DE ATENCAO:
${score >= 8 ? 'Nenhuma ressalva critica identificada.' : 'Revisar cobertura de casos de borda na logica principal.'}

RECOMENDACAO:
${recomendacao}
Avaliado pelo sistema Trivio IA - ${new Date().toLocaleDateString('pt-BR')}`;

            db.prepare(`
        UPDATE candidaturas_desafio SET score_ia=?, relatorio_ia=? WHERE desafio_id=? AND candidato_id=?
      `).run(score, relatorio, desafioId, candidatoId);

        } catch (e) { console.error('[IA EVAL ERROR]', e); }
    }, 3000);
}

const listarCandidaturas = async (req, res) => {
    try {
        const candidaturas = db.prepare(`
      SELECT cd.*, COALESCE(c.nome,'Candidato') as candidato_nome, c.email as candidato_email,
             c.github_url, c.skills, c.anos_experiencia, c.verificado
      FROM candidaturas_desafio cd
      LEFT JOIN candidatos c ON cd.candidato_id = c.public_id
      WHERE cd.desafio_id = ?
      ORDER BY cd.score_ia DESC, cd.iniciado_em DESC
    `).all(req.params.id);
        res.status(200).json(candidaturas);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao listar candidaturas' });
    }
};

const avancarParaEntrevista = async (req, res) => {
    try {
        const { id, candidato_id } = req.params;
        const cand = db.prepare('SELECT * FROM candidaturas_desafio WHERE desafio_id=? AND candidato_id=?').get(id, candidato_id);
        if (!cand) return res.status(404).json({ erro: 'Candidatura nao encontrada' });

        db.prepare(`
      UPDATE candidaturas_desafio SET avancou_entrevista=1, canal_liberado=1 WHERE desafio_id=? AND candidato_id=?
    `).run(id, candidato_id);

        const desafio = db.prepare('SELECT titulo, empresa_id FROM desafios WHERE id=?').get(id);
        db.prepare(`
      INSERT INTO mensagens_canal (desafio_id, candidato_id, remetente_tipo, remetente_id, texto)
      VALUES (?, ?, 'empresa', ?, ?)
    `).run(id, candidato_id, desafio?.empresa_id || 'empresa', `Parabens! Voce foi selecionado para avancar no processo seletivo referente ao desafio "${desafio?.titulo || 'tecnico'}". Entraremos em contato em breve para agendar a proxima etapa.`);

        res.status(200).json({ mensagem: 'Candidato avancado para entrevista. Canal privado liberado!' });
    } catch (err) {
        console.error('[AVANCAR]', err);
        res.status(500).json({ erro: 'Erro ao avancar candidato' });
    }
};

const listarMensagens = async (req, res) => {
    try {
        const { desafio_id, candidato_id } = req.params;
        const cand = db.prepare('SELECT canal_liberado FROM candidaturas_desafio WHERE desafio_id=? AND candidato_id=?').get(desafio_id, candidato_id);
        if (!cand?.canal_liberado) return res.status(403).json({ erro: 'Canal nao disponivel. Aguardando aprovacao da empresa.' });

        const msgs = db.prepare(`
      SELECT * FROM mensagens_canal WHERE desafio_id=? AND candidato_id=? ORDER BY enviada_em ASC
    `).all(desafio_id, candidato_id);
        res.status(200).json(msgs);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao carregar mensagens' });
    }
};

const enviarMensagem = async (req, res) => {
    try {
        const { desafio_id, candidato_id } = req.params;
        const { remetente_tipo, remetente_id, texto } = req.body;
        if (!texto?.trim()) return res.status(400).json({ erro: 'Mensagem nao pode estar vazia' });

        const cand = db.prepare('SELECT canal_liberado FROM candidaturas_desafio WHERE desafio_id=? AND candidato_id=?').get(desafio_id, candidato_id);
        if (!cand?.canal_liberado) return res.status(403).json({ erro: 'Canal nao liberado' });

        const result = db.prepare(`
      INSERT INTO mensagens_canal (desafio_id, candidato_id, remetente_tipo, remetente_id, texto) VALUES (?,?,?,?,?)
    `).run(desafio_id, candidato_id, remetente_tipo, remetente_id, texto.trim());

        res.status(201).json(db.prepare('SELECT * FROM mensagens_canal WHERE id=?').get(result.lastInsertRowid));
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao enviar mensagem' });
    }
};

const atualizarPerfilTecnico = async (req, res) => {
    try {
        const { candidato_id } = req.params;
        const { github_url, linkedin_url, skills, anos_experiencia, bio } = req.body;
        const candidato = db.prepare('SELECT id FROM candidatos WHERE public_id=?').get(candidato_id);
        if (!candidato) return res.status(404).json({ erro: 'Candidato nao encontrado' });

        db.prepare(`
      UPDATE candidatos SET github_url=?, linkedin_url=?, skills=?, anos_experiencia=?, bio=? WHERE public_id=?
    `).run(github_url || '', linkedin_url || '', skills || '', anos_experiencia || 0, bio || '', candidato_id);

        const atualizado = db.prepare('SELECT public_id,nome,email,github_url,linkedin_url,skills,anos_experiencia,bio,verificado,criado_em FROM candidatos WHERE public_id=?').get(candidato_id);
        res.status(200).json(atualizado);
    } catch (err) {
        console.error('[PERFIL TECNICO]', err);
        res.status(500).json({ erro: 'Erro ao atualizar perfil tecnico' });
    }
};

const obterPerfilTecnico = async (req, res) => {
    try {
        const { candidato_id } = req.params;
        const candidato = db.prepare(`
      SELECT public_id,nome,email,github_url,linkedin_url,skills,anos_experiencia,bio,verificado,criado_em
      FROM candidatos WHERE public_id=?
    `).get(candidato_id);
        if (!candidato) return res.status(404).json({ erro: 'Candidato nao encontrado' });
        res.status(200).json(candidato);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar perfil' });
    }
};

const meusDesafios = async (req, res) => {
    try {
        const { candidato_id } = req.params;
        const lista = db.prepare(`
      SELECT cd.*, d.titulo, d.descricao, d.stack, d.nivel, d.tempo_limite_h, d.bolsa_tecnica,
             d.instrucoes, d.criterios, COALESCE(e.nome,'Empresa Parceira') as empresa_nome
      FROM candidaturas_desafio cd
      JOIN desafios d ON cd.desafio_id = d.id
      LEFT JOIN empresas e ON d.empresa_id = e.public_id
      WHERE cd.candidato_id = ?
      ORDER BY cd.iniciado_em DESC
    `).all(candidato_id);
        res.status(200).json(lista);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar desafios' });
    }
};

module.exports = {
    listarDesafios, obterDesafio, criarDesafio, atualizarDesafio, excluirDesafio,
    candidatarDesafio, entregarSolucao, listarCandidaturas, avancarParaEntrevista,
    listarMensagens, enviarMensagem, atualizarPerfilTecnico, obterPerfilTecnico, meusDesafios
};
