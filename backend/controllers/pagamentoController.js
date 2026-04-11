const db = require('../banco/conexao');

// Constantes de preços
const TAXA_PLATAFORMA = 150.00; // Taxa por vaga publicada

// ─────────────────────────────────────────────────────────────────────────────
// PAGAMENTOS — Empresas pagam por vaga e bolsa técnica
// ─────────────────────────────────────────────────────────────────────────────

// Lista pagamentos de uma empresa
const listarPagamentos = async (req, res) => {
    try {
        const { empresa_id } = req.query;
        if (!empresa_id) return res.status(400).json({ erro: 'empresa_id é obrigatório' });

        const pagamentos = db.prepare(`
            SELECT p.*, v.titulo as vaga_titulo
            FROM pagamentos p
            LEFT JOIN vagas v ON p.vaga_id = v.id
            WHERE p.empresa_id = ?
            ORDER BY p.created_at DESC
        `).all(empresa_id);

        res.status(200).json(pagamentos);
    } catch (err) {
        console.error('[PAGAMENTOS LIST]', err);
        res.status(500).json({ erro: 'Erro ao listar pagamentos' });
    }
};

// Criar cobrança de taxa de plataforma ao criar vaga
const criarTaxaPlataforma = async (empresa_id, vaga_id, titulo_vaga) => {
    try {
        // Verifica se já existe taxa para esta vaga
        const existente = db.prepare(`
            SELECT id FROM pagamentos 
            WHERE empresa_id = ? AND vaga_id = ? AND tipo = 'taxa_plataforma'
        `).get(empresa_id, vaga_id);

        if (existente) return null;

        db.prepare(`
            INSERT INTO pagamentos (empresa_id, vaga_id, tipo, valor, status, descricao)
            VALUES (?, ?, 'taxa_plataforma', ?, 'pendente', ?)
        `).run(empresa_id, vaga_id, TAXA_PLATAFORMA, `Taxa de publicação: ${titulo_vaga}`);

        return TAXA_PLATAFORMA;
    } catch (err) {
        console.error('[CRIAR TAXA]', err);
        return null;
    }
};

// Criar cobrança de bolsa técnica (quando candidato aceita desafio)
const criarCobrancaBolsa = async (empresa_id, vaga_id, valor_bolsa, candidato_id) => {
    try {
        db.prepare(`
            INSERT INTO pagamentos (empresa_id, vaga_id, tipo, valor, status, descricao)
            VALUES (?, ?, 'bolsa_tecnica', ?, 'pendente', ?)
        `).run(
            empresa_id,
            vaga_id,
            valor_bolsa,
            `Bolsa técnica para desafio - Candidato: ${candidato_id}`
        );
        return true;
    } catch (err) {
        console.error('[CRIAR BOLSA]', err);
        return false;
    }
};

// Simular pagamento (em MVP, apenas marca como pago)
const confirmarPagamento = async (req, res) => {
    try {
        const { pagamento_id } = req.params;
        const { empresa_id } = req.body;

        const pagamento = db.prepare(`
            SELECT * FROM pagamentos WHERE id = ? AND empresa_id = ?
        `).get(pagamento_id, empresa_id);

        if (!pagamento) {
            return res.status(404).json({ erro: 'Pagamento não encontrado' });
        }

        db.prepare(`
            UPDATE pagamentos SET status = 'pago', paid_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(pagamento_id);

        res.status(200).json({
            mensagem: 'Pagamento confirmado com sucesso',
            status: 'pago'
        });
    } catch (err) {
        console.error('[CONFIRMAR PAGAMENTO]', err);
        res.status(500).json({ erro: 'Erro ao confirmar pagamento' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// MÉTRICAS — Dashboard da empresa
// ─────────────────────────────────────────────────────────────────────────────

// Obter métricas gerais da empresa
const obterMetricas = async (req, res) => {
    try {
        const { empresa_id } = req.query;
        if (!empresa_id) return res.status(400).json({ erro: 'empresa_id é obrigatório' });

        // Total de vagas ativas
        const vagasAtivas = db.prepare(`
            SELECT COUNT(*) as total FROM vagas 
            WHERE empresa_id = ? AND status = 'ativa'
        `).get(empresa_id);

        // Total de desafios ativos
        const desafiosAtivos = db.prepare(`
            SELECT COUNT(*) as total FROM desafios 
            WHERE empresa_id = ? AND status = 'ativo'
        `).get(empresa_id);

        // Total de candidaturas
        const totalCandidaturas = db.prepare(`
            SELECT COUNT(cd.id) as total
            FROM candidaturas_desafio cd
            JOIN desafios d ON cd.desafio_id = d.id
            WHERE d.empresa_id = ?
        `).get(empresa_id);

        // Candidaturas em andamento
        const emAndamento = db.prepare(`
            SELECT COUNT(*) as total
            FROM candidaturas_desafio cd
            JOIN desafios d ON cd.desafio_id = d.id
            WHERE d.empresa_id = ? AND cd.status = 'em_andamento'
        `).get(empresa_id);

        // Desafios entregues (avaliados)
        const entregues = db.prepare(`
            SELECT COUNT(*) as total
            FROM candidaturas_desafio cd
            JOIN desafios d ON cd.desafio_id = d.id
            WHERE d.empresa_id = ? AND cd.status = 'entregue'
        `).get(empresa_id);

        // Avançados para entrevista
        const avanzados = db.prepare(`
            SELECT COUNT(*) as total
            FROM candidaturas_desafio cd
            JOIN desafios d ON cd.desafio_id = d.id
            WHERE d.empresa_id = ? AND cd.avancou_entrevista = 1
        `).get(empresa_id);

        // Taxa de conversão
        const taxaConversao = totalCandidaturas.total > 0
            ? Math.round((avanzados.total / totalCandidaturas.total) * 100)
            : 0;

        // Total pago em bolsas técnicas
        const totalBolsaPago = db.prepare(`
            SELECT COALESCE(SUM(valor), 0) as total
            FROM pagamentos
            WHERE empresa_id = ? AND tipo = 'bolsa_tecnica' AND status = 'pago'
        `).get(empresa_id);

        // Pendências financeiras
        const pendencias = db.prepare(`
            SELECT COALESCE(SUM(valor), 0) as total
            FROM pagamentos
            WHERE empresa_id = ? AND status = 'pendente'
        `).get(empresa_id);

        res.status(200).json({
            vagas_ativas: vagasAtivas.total,
            desafios_ativos: desafiosAtivos.total,
            candidaturas_total: totalCandidaturas.total,
            candidaturas_andamento: emAndamento.total,
            desafios_entregues: entregues.total,
            avanzados_entrevista: avanzados.total,
            taxa_conversao_percent: taxaConversao,
            total_bolsa_pago: totalBolsaPago.total,
            pendencias_valor: pendencias.total
        });
    } catch (err) {
        console.error('[METRICAS]', err);
        res.status(500).json({ erro: 'Erro ao obter métricas' });
    }
};

// Obter métricas por vaga específica
const obterMetricasVaga = async (req, res) => {
    try {
        const { vaga_id } = req.params;
        const { empresa_id } = req.query;

        const vaga = db.prepare(`
            SELECT * FROM vagas WHERE id = ? AND empresa_id = ?
        `).get(vaga_id, empresa_id);

        if (!vaga) {
            return res.status(404).json({ erro: 'Vaga não encontrada' });
        }

        // Desafios desta vaga
        const desafios = db.prepare(`
            SELECT id FROM desafios WHERE vaga_id = ?
        `).all(vaga_id);

        const desafioIds = desafios.map(d => d.id);

        if (desafioIds.length === 0) {
            return res.status(200).json({
                vaga: vaga,
                metricas: {
                    desafios: 0,
                    candidaturas: 0,
                    entregados: 0,
                    avanzados: 0
                }
            });
        }

        const placeholders = desafioIds.map(() => '?').join(',');

        const metricas = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'em_andamento' THEN 1 ELSE 0 END) as andamento,
                SUM(CASE WHEN status = 'entregue' THEN 1 ELSE 0 END) as entregues,
                SUM(CASE WHEN avancou_entrevista = 1 THEN 1 ELSE 0 END) as avanzados
            FROM candidaturas_desafio
            WHERE desafio_id IN (${placeholders})
        `).get(...desafioIds);

        res.status(200).json({
            vaga: vaga,
            metricas: {
                desafios: desafios.length,
                candidaturas: metricas.total || 0,
                andamento: metricas.andamento || 0,
                entregados: metricas.entregues || 0,
                avanzados: metricas.avanzados || 0
            }
        });
    } catch (err) {
        console.error('[METRICAS VAGA]', err);
        res.status(500).json({ erro: 'Erro ao obter métricas da vaga' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// HISTÓRICO DE ATIVIDADES
// ─────────────────────────────────────────────────────────────────────────────

const registrarAtividade = (entidade_tipo, entidade_id, acao, detalhes, usuario_id) => {
    try {
        db.prepare(`
            INSERT INTO historico_atividades (entidade_tipo, entidade_id, acao, detalhes, usuario_id)
            VALUES (?, ?, ?, ?, ?)
        `).run(entidade_tipo, entidade_id, acao, JSON.stringify(detalhes), usuario_id);
    } catch (err) {
        console.error('[REGISTRAR ATIVIDADE]', err);
    }
};

const listarAtividades = async (req, res) => {
    try {
        const { empresa_id } = req.query;

        const atividades = db.prepare(`
            SELECT ha.*, v.titulo as vaga_titulo
            FROM historico_atividades ha
            LEFT JOIN vagas v ON ha.entidade_tipo = 'vaga' AND ha.entidade_id = v.id
            WHERE ha.usuario_id = ? OR ha.entidade_type = 'desafio'
            ORDER BY ha.created_at DESC
            LIMIT 50
        `).all(empresa_id);

        res.status(200).json(atividades);
    } catch (err) {
        console.error('[LISTAR ATIVIDADES]', err);
        res.status(500).json({ erro: 'Erro ao listar atividades' });
    }
};

module.exports = {
    listarPagamentos,
    criarTaxaPlataforma,
    criarCobrancaBolsa,
    confirmarPagamento,
    obterMetricas,
    obterMetricasVaga,
    registrarAtividade,
    listarAtividades
};
