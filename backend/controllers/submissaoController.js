const db = require('../banco/conexao');
const { analyzeCode } = require('../services/analyzeCodeService');

const criarSubmissao = async (req, res) => {
    try {
        const { desafio_id, candidato_id, codigo, linguagem, mensagem, solucao_url } = req.body;

        if (!desafio_id || !candidato_id || !codigo || !linguagem) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'desafio_id, candidato_id, codigo e linguagem sao obrigatorios'
            });
        }

        const desafio = db.prepare('SELECT * FROM desafios WHERE id = ? AND status = "ativo"').get(desafio_id);
        if (!desafio) {
            return res.status(404).json({ sucesso: false, mensagem: 'Desafio nao encontrado ou encerrado' });
        }

        const candidato = db.prepare('SELECT id, nome, email FROM candidatos WHERE public_id = ?').get(candidato_id);
        if (!candidato) {
            return res.status(404).json({ sucesso: false, mensagem: 'Candidato nao encontrado' });
        }

        let score_ia = null;
        let relatorio_ia = null;
        
        try {
            console.log(`[SUBMISSAO] Analisando codigo do candidato ${candidato_id}...`);
            const analiseResultado = await analyzeCode(codigo, linguagem);
            
            if (analiseResultado.success) {
                score_ia = Math.round(analiseResultado.overallScore);
                relatorio_ia = JSON.stringify({
                    score: analiseResultado.overallScore,
                    grade: analiseResultado.grade,
                    summary: analiseResultado.summary,
                    breakdown: analiseResultado.scoreBreakdown,
                    topSuggestions: analiseResultado.topSuggestions,
                    meta: analiseResultado.meta
                });
                console.log(`[SUBMISSAO] Analise concluida - Score: ${score_ia}/100`);
            } else {
                console.warn(`[SUBMISSAO] Analise falhou: ${analiseResultado.error}`);
            }
        } catch (errAnalise) {
            console.error('[SUBMISSAO] Erro durante analise automatica:', errAnalise);
        }

        const candidatura = db.prepare(
            'SELECT * FROM candidaturas_desafio WHERE desafio_id = ? AND candidato_id = ?'
        ).get(desafio_id, candidato_id);

        const agora = new Date().toISOString();

        if (candidatura) {
            db.prepare(`
                UPDATE candidaturas_desafio
                SET codigo = ?,
                    linguagem = ?,
                    mensagem_candidato = ?,
                    solucao_url = ?,
                    status = 'entregue',
                    entregue_em = ?,
                    score_ia = ?,
                    relatorio_ia = ?
                WHERE desafio_id = ? AND candidato_id = ?
            `).run(
                codigo, linguagem, mensagem || null, solucao_url || null,
                agora, score_ia, relatorio_ia, desafio_id, candidato_id
            );
        } else {
            db.prepare(`
                INSERT INTO candidaturas_desafio
                    (desafio_id, candidato_id, codigo, linguagem, mensagem_candidato, solucao_url, status, entregue_em, score_ia, relatorio_ia)
                VALUES (?, ?, ?, ?, ?, ?, 'entregue', ?, ?, ?)
            `).run(
                desafio_id, candidato_id, codigo, linguagem,
                mensagem || null, solucao_url || null, agora, score_ia, relatorio_ia
            );
        }

        try {
            db.prepare(`
                INSERT INTO historico_atividades (entidade_tipo, entidade_id, acao, detalhes, usuario_id)
                VALUES ('candidatura', ?, 'submissao_enviada', ?, ?)
            `).run(
                desafio_id,
                `Candidato ${candidato_id} enviou solucao em ${linguagem}${score_ia ? ` - Score IA: ${score_ia}/100` : ''}`,
                candidato_id
            );
        } catch (_) {}

        const submissaoSalva = db.prepare(
            'SELECT * FROM candidaturas_desafio WHERE desafio_id = ? AND candidato_id = ?'
        ).get(desafio_id, candidato_id);

        return res.status(201).json({ 
            sucesso: true, 
            submissao: submissaoSalva,
            analise: score_ia ? {
                score: score_ia,
                mensagem: `Codigo analisado automaticamente. Score: ${score_ia}/100`
            } : null
        });

    } catch (err) {
        console.error('[SUBMISSAO CREATE]', err);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao criar submissao' });
    }
};

const listarSubmissoesUsuario = (req, res) => {
    try {
        const candidato_id = req.headers['id-usuario'] || req.query.candidato_id;

        if (!candidato_id) {
            return res.status(401).json({ sucesso: false, mensagem: 'candidato_id e obrigatorio' });
        }

        const submissoes = db.prepare(`
            SELECT
                cd.*,
                d.titulo          AS desafio_titulo,
                d.stack           AS desafio_stack,
                d.nivel           AS desafio_nivel,
                d.bolsa_tecnica   AS desafio_bolsa,
                COALESCE(e.nome, 'Empresa Parceira') AS empresa_nome
            FROM candidaturas_desafio cd
            JOIN desafios d ON cd.desafio_id = d.id
            LEFT JOIN empresas e ON d.empresa_id = e.public_id
            WHERE cd.candidato_id = ?
              AND cd.codigo IS NOT NULL
            ORDER BY cd.entregue_em DESC
        `).all(candidato_id);

        const lista = submissoes.map(s => ({
            ...s,
            codigo: s.codigo ? s.codigo.substring(0, 200) + (s.codigo.length > 200 ? '...' : '') : null
        }));

        return res.status(200).json({ sucesso: true, submissoes: lista, total: lista.length });

    } catch (err) {
        console.error('[SUBMISSAO USER LIST]', err);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar submissoes' });
    }
};

const obterSubmissao = (req, res) => {
    try {
        const { id } = req.params;
        const requesterId = req.headers['id-usuario'];

        const submissao = db.prepare(`
            SELECT
                cd.*,
                d.titulo          AS desafio_titulo,
                d.descricao       AS desafio_descricao,
                d.stack           AS desafio_stack,
                d.nivel           AS desafio_nivel,
                d.empresa_id,
                c.nome            AS candidato_nome,
                c.email           AS candidato_email,
                c.github_url      AS candidato_github,
                COALESCE(e.nome, 'Empresa') AS empresa_nome
            FROM candidaturas_desafio cd
            JOIN desafios d ON cd.desafio_id = d.id
            LEFT JOIN candidatos c ON cd.candidato_id = c.public_id
            LEFT JOIN empresas e ON d.empresa_id = e.public_id
            WHERE cd.id = ?
        `).get(id);

        if (!submissao) {
            return res.status(404).json({ sucesso: false, mensagem: 'Submissao nao encontrada' });
        }

        if (requesterId) {
            const eCandidato = submissao.candidato_id === requesterId;
            const eEmpresa = submissao.empresa_id === requesterId;
            if (!eCandidato && !eEmpresa) {
                return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado' });
            }
        }

        return res.status(200).json({ sucesso: true, submissao });

    } catch (err) {
        console.error('[SUBMISSAO GET]', err);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar submissao' });
    }
};

const atualizarStatus = (req, res) => {
    try {
        const { id } = req.params;
        const empresa_id = req.headers['id-usuario'];
        const { status, feedback } = req.body;

        if (!empresa_id) {
            return res.status(401).json({ sucesso: false, mensagem: 'Autenticacao necessaria' });
        }

        const statusPermitidos = ['aprovado', 'rejeitado', 'em_revisao'];
        if (!status || !statusPermitidos.includes(status)) {
            return res.status(400).json({
                sucesso: false,
                mensagem: `Status invalido. Use: ${statusPermitidos.join(', ')}`
            });
        }

        const submissao = db.prepare(`
            SELECT cd.*, d.empresa_id
            FROM candidaturas_desafio cd
            JOIN desafios d ON cd.desafio_id = d.id
            WHERE cd.id = ?
        `).get(id);

        if (!submissao) {
            return res.status(404).json({ sucesso: false, mensagem: 'Submissao nao encontrada' });
        }

        if (submissao.empresa_id !== empresa_id) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Voce nao tem permissao para avaliar esta submissao'
            });
        }

        db.prepare(`
            UPDATE candidaturas_desafio
            SET status = ?,
                feedback_empresa = ?,
                avancou_entrevista = ?
            WHERE id = ?
        `).run(status, feedback || null, status === 'aprovado' ? 1 : 0, id);

        try {
            db.prepare(`
                INSERT INTO historico_atividades (entidade_tipo, entidade_id, acao, detalhes, usuario_id)
                VALUES ('candidatura', ?, ?, ?, ?)
            `).run(id, `status_${status}`, `Empresa ${empresa_id} marcou como ${status}`, empresa_id);
        } catch (_) {}

        const atualizada = db.prepare('SELECT * FROM candidaturas_desafio WHERE id = ?').get(id);
        return res.status(200).json({ sucesso: true, submissao: atualizada });

    } catch (err) {
        console.error('[SUBMISSAO STATUS]', err);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao atualizar status' });
    }
};

const listarSubmissoesDesafio = (req, res) => {
    try {
        const { desafio_id } = req.params;
        const empresa_id = req.headers['id-usuario'];

        const desafio = db.prepare('SELECT * FROM desafios WHERE id = ?').get(desafio_id);
        if (!desafio) {
            return res.status(404).json({ sucesso: false, mensagem: 'Desafio nao encontrado' });
        }

        if (empresa_id && desafio.empresa_id !== empresa_id) {
            return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado' });
        }

        const submissoes = db.prepare(`
            SELECT
                cd.id, cd.candidato_id, cd.status, cd.linguagem,
                cd.mensagem_candidato, cd.solucao_url, cd.entregue_em,
                cd.avancou_entrevista, cd.feedback_empresa, cd.score_ia,
                c.nome   AS candidato_nome,
                c.email  AS candidato_email,
                c.github_url AS candidato_github,
                c.linkedin_url AS candidato_linkedin
            FROM candidaturas_desafio cd
            LEFT JOIN candidatos c ON cd.candidato_id = c.public_id
            WHERE cd.desafio_id = ?
              AND cd.codigo IS NOT NULL
            ORDER BY cd.entregue_em DESC
        `).all(desafio_id);

        return res.status(200).json({
            sucesso: true,
            desafio: { id: desafio.id, titulo: desafio.titulo, nivel: desafio.nivel },
            submissoes,
            total: submissoes.length
        });

    } catch (err) {
        console.error('[SUBMISSAO DESAFIO LIST]', err);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar submissoes do desafio' });
    }
};

const obterAnaliseIA = (req, res) => {
    try {
        const { id } = req.params;
        const empresa_id = req.headers['id-usuario'];

        const submissao = db.prepare(`
            SELECT 
                cd.id, cd.candidato_id, cd.desafio_id, cd.codigo,
                cd.linguagem, cd.score_ia, cd.relatorio_ia, cd.entregue_em,
                d.empresa_id, d.titulo AS desafio_titulo,
                c.nome AS candidato_nome
            FROM candidaturas_desafio cd
            JOIN desafios d ON cd.desafio_id = d.id
            LEFT JOIN candidatos c ON cd.candidato_id = c.public_id
            WHERE cd.id = ?
        `).get(id);

        if (!submissao) {
            return res.status(404).json({ sucesso: false, mensagem: 'Submissao nao encontrada' });
        }

        if (empresa_id && submissao.empresa_id !== empresa_id) {
            return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado' });
        }

        if (!submissao.relatorio_ia) {
            return res.status(404).json({ 
                sucesso: false, 
                mensagem: 'Esta submissao nao possui analise de IA disponivel' 
            });
        }

        let relatorio;
        try {
            relatorio = JSON.parse(submissao.relatorio_ia);
        } catch (parseErr) {
            console.error('[ANALISE IA] Erro ao fazer parse do relatorio:', parseErr);
            return res.status(500).json({ 
                sucesso: false, 
                mensagem: 'Erro ao processar relatorio de analise' 
            });
        }

        return res.status(200).json({
            sucesso: true,
            submissao: {
                id: submissao.id,
                candidato_nome: submissao.candidato_nome,
                desafio_titulo: submissao.desafio_titulo,
                linguagem: submissao.linguagem,
                entregue_em: submissao.entregue_em,
                linhas_codigo: submissao.codigo ? submissao.codigo.split('\n').length : 0
            },
            analise: {
                score: submissao.score_ia,
                ...relatorio
            }
        });

    } catch (err) {
        console.error('[SUBMISSAO ANALISE IA]', err);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao obter analise de IA' });
    }
};

module.exports = {
    criarSubmissao,
    listarSubmissoesUsuario,
    obterSubmissao,
    atualizarStatus,
    listarSubmissoesDesafio,
    obterAnaliseIA
};
