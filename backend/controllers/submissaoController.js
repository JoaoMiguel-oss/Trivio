// ============================================================
// TRIVIO - CONTROLLER DE SUBMISSÕES DE CÓDIGO
// ============================================================
// Gerencia o envio e avaliação de soluções dos candidatos.
//
// DECISÃO DE ARQUITETURA:
// A tabela candidaturas_desafio já existe e tem campos para
// solucao_url e solucao_descricao. Este controller ESTENDE
// essa tabela com novos campos (code, language, mensagem)
// via migration no database/setup.js — sem quebrar nada.
//
// Fluxo:
//   1. Candidato aceita desafio → candidaturas_desafio criada
//   2. Candidato submete solução → preenche campos de submissão
//   3. Empresa revisa → aprova ou rejeita (status)
// ============================================================

const db = require('../banco/conexao');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/submissoes
// Candidato envia a solução de um desafio
// ─────────────────────────────────────────────────────────────────────────────
const criarSubmissao = (req, res) => {
    try {
        const { desafio_id, candidato_id, codigo, linguagem, mensagem, solucao_url } = req.body;

        // Validação dos campos obrigatórios
        if (!desafio_id || !candidato_id || !codigo || !linguagem) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'desafio_id, candidato_id, codigo e linguagem são obrigatórios'
            });
        }

        // Verifica se o desafio existe e está ativo
        const desafio = db.prepare('SELECT * FROM desafios WHERE id = ? AND status = "ativo"').get(desafio_id);
        if (!desafio) {
            return res.status(404).json({ sucesso: false, mensagem: 'Desafio não encontrado ou encerrado' });
        }

        // Verifica se o candidato existe
        const candidato = db.prepare('SELECT id, nome, email FROM candidatos WHERE public_id = ?').get(candidato_id);
        if (!candidato) {
            return res.status(404).json({ sucesso: false, mensagem: 'Candidato não encontrado' });
        }

        // Verifica se já existe candidatura para este desafio+candidato
        const candidatura = db.prepare(
            'SELECT * FROM candidaturas_desafio WHERE desafio_id = ? AND candidato_id = ?'
        ).get(desafio_id, candidato_id);

        const agora = new Date().toISOString();

        if (candidatura) {
            // Candidatura existe → atualiza com a submissão de código
            db.prepare(`
                UPDATE candidaturas_desafio
                SET codigo = ?,
                    linguagem = ?,
                    mensagem_candidato = ?,
                    solucao_url = ?,
                    status = 'entregue',
                    entregue_em = ?
                WHERE desafio_id = ? AND candidato_id = ?
            `).run(
                codigo,
                linguagem,
                mensagem || null,
                solucao_url || null,
                agora,
                desafio_id,
                candidato_id
            );
        } else {
            // Ainda não se candidatou → cria candidatura + submissão em um passo
            db.prepare(`
                INSERT INTO candidaturas_desafio
                    (desafio_id, candidato_id, codigo, linguagem, mensagem_candidato, solucao_url, status, entregue_em)
                VALUES (?, ?, ?, ?, ?, ?, 'entregue', ?)
            `).run(desafio_id, candidato_id, codigo, linguagem, mensagem || null, solucao_url || null, agora);
        }

        // Registra no histórico de atividades (padrão existente do projeto)
        try {
            db.prepare(`
                INSERT INTO historico_atividades (entidade_tipo, entidade_id, acao, detalhes, usuario_id)
                VALUES ('candidatura', ?, 'submissao_enviada', ?, ?)
            `).run(desafio_id, `Candidato ${candidato_id} enviou solução em ${linguagem}`, candidato_id);
        } catch (_) { /* histórico é melhor esforço */ }

        const submissaoSalva = db.prepare(
            'SELECT * FROM candidaturas_desafio WHERE desafio_id = ? AND candidato_id = ?'
        ).get(desafio_id, candidato_id);

        return res.status(201).json({ sucesso: true, submissao: submissaoSalva });

    } catch (err) {
        console.error('[SUBMISSAO CREATE]', err);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao criar submissão' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/submissoes/usuario?candidato_id=xxx
// Candidato lista suas próprias submissões
// ─────────────────────────────────────────────────────────────────────────────
const listarSubmissoesUsuario = (req, res) => {
    try {
        // ID do candidato pode vir do header (auth) ou query param
        const candidato_id = req.headers['id-usuario'] || req.query.candidato_id;

        if (!candidato_id) {
            return res.status(401).json({ sucesso: false, mensagem: 'candidato_id é obrigatório' });
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

        // Esconde o código completo na listagem (para não sobrecarregar o response)
        const lista = submissoes.map(s => ({
            ...s,
            codigo: s.codigo ? s.codigo.substring(0, 200) + (s.codigo.length > 200 ? '...' : '') : null
        }));

        return res.status(200).json({ sucesso: true, submissoes: lista, total: lista.length });

    } catch (err) {
        console.error('[SUBMISSAO USER LIST]', err);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar submissões' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/submissoes/:id
// Detalhe completo de uma submissão (candidato vê a própria, empresa vê as do desafio dela)
// ─────────────────────────────────────────────────────────────────────────────
const obterSubmissao = (req, res) => {
    try {
        const { id } = req.params;
        const requesterId = req.headers['id-usuario'];
        const tipoUsuario = req.headers['tipo-usuario']; // 'candidato' ou 'empresa'

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
            return res.status(404).json({ sucesso: false, mensagem: 'Submissão não encontrada' });
        }

        // Controle de acesso:
        // - Candidato só vê a própria submissão
        // - Empresa só vê submissões dos seus desafios
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
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao buscar submissão' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/submissoes/:id/status
// Empresa aprova ou rejeita uma submissão
// Apenas empresas podem usar este endpoint (validado pela presença do empresa_id nos headers)
// ─────────────────────────────────────────────────────────────────────────────
const atualizarStatus = (req, res) => {
    try {
        const { id } = req.params;
        const empresa_id = req.headers['id-usuario'];
        const { status, feedback } = req.body;

        // Só empresas podem aprovar/rejeitar
        if (!empresa_id) {
            return res.status(401).json({ sucesso: false, mensagem: 'Autenticação necessária' });
        }

        // Status permitidos
        const statusPermitidos = ['aprovado', 'rejeitado', 'em_revisao'];
        if (!status || !statusPermitidos.includes(status)) {
            return res.status(400).json({
                sucesso: false,
                mensagem: `Status inválido. Use: ${statusPermitidos.join(', ')}`
            });
        }

        // Busca a submissão e verifica se pertence a um desafio desta empresa
        const submissao = db.prepare(`
            SELECT cd.*, d.empresa_id
            FROM candidaturas_desafio cd
            JOIN desafios d ON cd.desafio_id = d.id
            WHERE cd.id = ?
        `).get(id);

        if (!submissao) {
            return res.status(404).json({ sucesso: false, mensagem: 'Submissão não encontrada' });
        }

        // Garante que a empresa só mexe nos seus próprios desafios
        if (submissao.empresa_id !== empresa_id) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Você não tem permissão para avaliar esta submissão'
            });
        }

        // Atualiza status + feedback (empresa pode deixar comentário)
        db.prepare(`
            UPDATE candidaturas_desafio
            SET status = ?,
                feedback_empresa = ?,
                avancou_entrevista = ?
            WHERE id = ?
        `).run(
            status,
            feedback || null,
            status === 'aprovado' ? 1 : 0,
            id
        );

        // Registra no histórico
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/submissoes/desafio/:desafio_id
// Empresa lista todas as submissões de um desafio seu
// ─────────────────────────────────────────────────────────────────────────────
const listarSubmissoesDesafio = (req, res) => {
    try {
        const { desafio_id } = req.params;
        const empresa_id = req.headers['id-usuario'];

        // Verifica que o desafio pertence à empresa
        const desafio = db.prepare('SELECT * FROM desafios WHERE id = ?').get(desafio_id);
        if (!desafio) {
            return res.status(404).json({ sucesso: false, mensagem: 'Desafio não encontrado' });
        }

        if (empresa_id && desafio.empresa_id !== empresa_id) {
            return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado' });
        }

        const submissoes = db.prepare(`
            SELECT
                cd.id,
                cd.candidato_id,
                cd.status,
                cd.linguagem,
                cd.mensagem_candidato,
                cd.solucao_url,
                cd.entregue_em,
                cd.avancou_entrevista,
                cd.feedback_empresa,
                cd.score_ia,
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
        return res.status(500).json({ sucesso: false, mensagem: 'Erro ao listar submissões do desafio' });
    }
};

module.exports = {
    criarSubmissao,
    listarSubmissoesUsuario,
    obterSubmissao,
    atualizarStatus,
    listarSubmissoesDesafio
};
