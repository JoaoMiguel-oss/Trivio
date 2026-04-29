// TRIVIO - CONTROLLER DE PAGAMENTOS (Pagar.me)
// Integração real com a API do Pagar.me v5.
// Fluxo:
// 1. Empresa cria uma vaga → backend chama criarOrdemPagarme()
// que gera um link de checkout no Pagar.me.
// 2. Empresa acessa o link e paga (cartão, boleto ou Pix).
// 3. Pagar.me chama o nosso webhook automaticamente.
// 4. O webhook verifica a assinatura e atualiza o banco.
// Variáveis de ambiente necessárias (.env):
// PAGARME_SECRET_KEY  → sk_test_XXXXXXXX  (sandbox)
// PAGARME_PUBLIC_KEY  → pk_test_XXXXXXXX  (sandbox)
// PAGARME_WEBHOOK_SECRET → string aleatória gerada por você
// BASE_URL            → http://localhost:3001 (ou domínio em produção)

const db     = require('../banco/conexao');
const crypto = require('crypto');

// CONSTANTES

const TAXA_PLATAFORMA = 150.00; // R$ 150 por vaga publicada
const PAGARME_API     = 'https://api.pagar.me/core/v5';

// HELPER: Chamada autenticada na API do Pagar.me

async function pagarmeRequest(method, endpoint, body = null) {
  const secretKey = process.env.PAGARME_SECRET_KEY;

  if (!secretKey) {
    throw new Error('PAGARME_SECRET_KEY não configurada no .env');
  }

  // O Pagar.me usa Basic Auth: a chave secreta é o "usuário",
  // a senha fica vazia. O Base64 fica: "sk_test_XXX:"
  const basicAuth = Buffer.from(`${secretKey}:`).toString('base64');

  const options = {
    method,
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type':  'application/json',
    },
  };

  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${PAGARME_API}${endpoint}`, options);
  const data     = await response.json();

  if (!response.ok) {
    console.error('[PAGARME ERROR]', data);
    throw new Error(data.message || 'Erro na API do Pagar.me');
  }

  return data;
}

// HELPER: Verificar assinatura do webhook
// O Pagar.me assina cada webhook com HMAC-SHA256 usando o
// PAGARME_WEBHOOK_SECRET que você configura no dashboard.
// NUNCA processe webhooks sem verificar esta assinatura.

function verificarAssinaturaWebhook(payload, assinaturaRecebida) {
  const secret = process.env.PAGARME_WEBHOOK_SECRET;

  if (!secret) {
    console.warn('[WEBHOOK] PAGARME_WEBHOOK_SECRET não configurado — verificação pulada');
    return true; // Em desenvolvimento pode aceitar, em produção nunca!
  }

  const assinaturaEsperada = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Comparação segura para evitar timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(assinaturaEsperada, 'hex'),
    Buffer.from(assinaturaRecebida.replace('sha256=', ''), 'hex')
  );
}

// CRIAR ORDEM NO PAGAR.ME E LINK DE CHECKOUT
// Chama a API do Pagar.me, cria um pedido com os 3 métodos
// de pagamento habilitados e devolve o link de checkout.

async function criarOrdemPagarme({ valor, descricao, empresa_id, vaga_id, tipo }) {
  const valorEmCentavos = Math.round(valor * 100); // Pagar.me trabalha em centavos
  const baseUrl         = process.env.BASE_URL || 'http://localhost:3001';

  const payload = {
    // Identificador interno seu (útil para reconciliar no webhook)
    code: `trivio_${tipo}_emp${empresa_id}_vag${vaga_id}_${Date.now()}`,

    items: [
      {
        amount:      valorEmCentavos,
        description: descricao,
        quantity:    1,
        code:        `item_${vaga_id}`,
      },
    ],

    // Pagamentos aceitos: cartão de crédito, boleto e Pix
    payments: [
      {
        payment_method: 'credit_card',
        credit_card: {
          installments:    1,
          statement_descriptor: 'TRIVIO',
          // O card virá do frontend via Pagar.me.js (tokenizado)
          // Aqui habilitamos o método para o checkout hosted
        },
      },
      {
        payment_method: 'boleto',
        boleto: {
          instructions:  `Pagamento referente a: ${descricao}`,
          due_at:        new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 dias
        },
      },
      {
        payment_method: 'pix',
        pix: {
          expires_in: 3600, // 1 hora para o Pix expirar
        },
      },
    ],

    // Metadados extras — aparecem no dashboard do Pagar.me
    metadata: {
      empresa_id: String(empresa_id),
      vaga_id:    String(vaga_id),
      tipo,
    },
  };

  const ordem = await pagarmeRequest('POST', '/orders', payload);
  return ordem;
}

// CRIAR TAXA DE PLATAFORMA (chamada ao criar uma vaga)

const criarTaxaPlataforma = async (empresa_id, vaga_id, titulo_vaga) => {
  try {
    // Evitar duplicatas
    const existente = db.prepare(`
      SELECT id FROM pagamentos
      WHERE empresa_id = ? AND vaga_id = ? AND tipo = 'taxa_plataforma'
    `).get(empresa_id, vaga_id);

    if (existente) return null;

    const descricao = `Taxa de publicação: ${titulo_vaga}`;

    // Cria a ordem no Pagar.me
    const ordem = await criarOrdemPagarme({
      valor:      TAXA_PLATAFORMA,
      descricao,
      empresa_id,
      vaga_id,
      tipo:       'taxa_plataforma',
    });

    // Salva no banco com o ID e o link de checkout do Pagar.me
    db.prepare(`
      INSERT INTO pagamentos
        (empresa_id, vaga_id, tipo, valor, status, descricao, pagarme_order_id, checkout_url)
      VALUES (?, ?, 'taxa_plataforma', ?, 'pendente', ?, ?, ?)
    `).run(
      empresa_id,
      vaga_id,
      TAXA_PLATAFORMA,
      descricao,
      ordem.id,
      ordem.checkouts?.[0]?.payment_url || null
    );

    return {
      valor:        TAXA_PLATAFORMA,
      checkout_url: ordem.checkouts?.[0]?.payment_url,
      order_id:     ordem.id,
    };
  } catch (err) {
    console.error('[CRIAR TAXA PLATAFORMA]', err.message);
    return null;
  }
};

// CRIAR COBRANÇA DE BOLSA TÉCNICA

const criarCobrancaBolsa = async (empresa_id, vaga_id, valor_bolsa, candidato_id) => {
  try {
    const descricao = `Bolsa técnica - Candidato: ${candidato_id}`;

    const ordem = await criarOrdemPagarme({
      valor:      valor_bolsa,
      descricao,
      empresa_id,
      vaga_id,
      tipo:       'bolsa_tecnica',
    });

    db.prepare(`
      INSERT INTO pagamentos
        (empresa_id, vaga_id, tipo, valor, status, descricao, pagarme_order_id, checkout_url)
      VALUES (?, ?, 'bolsa_tecnica', ?, 'pendente', ?, ?, ?)
    `).run(
      empresa_id,
      vaga_id,
      valor_bolsa,
      descricao,
      ordem.id,
      ordem.checkouts?.[0]?.payment_url || null
    );

    return {
      checkout_url: ordem.checkouts?.[0]?.payment_url,
      order_id:     ordem.id,
    };
  } catch (err) {
    console.error('[CRIAR BOLSA]', err.message);
    return null;
  }
};

// WEBHOOK — Recebe confirmações automáticas do Pagar.me
// Configure este endpoint no dashboard do Pagar.me:
// POST https://seu-dominio.com/api/v1/pagamentos/webhook
// Eventos tratados:
// order.paid       → pagamento aprovado (cartão ou Pix)
// order.payment_failed → pagamento recusado
// charge.paid      → boleto compensado

const receberWebhook = async (req, res) => {
  try {
    // 1. Verificar a assinatura antes de qualquer coisa
    const assinatura = req.headers['x-hub-signature'] || '';
    const rawBody    = JSON.stringify(req.body); // Precisa do body raw para validar

    if (!verificarAssinaturaWebhook(rawBody, assinatura)) {
      console.warn('[WEBHOOK] Assinatura inválida — requisição rejeitada');
      return res.status(401).json({ erro: 'Assinatura inválida' });
    }

    const { type, data } = req.body;
    console.log(`[WEBHOOK] Evento recebido: ${type}`, data?.id);

    // 2. Tratar os eventos relevantes
    if (type === 'order.paid' || type === 'charge.paid') {
      const orderId = data?.order_id || data?.id;

      if (!orderId) {
        return res.status(400).json({ erro: 'order_id não encontrado no evento' });
      }

      // Atualiza o pagamento correspondente no banco
      const resultado = db.prepare(`
        UPDATE pagamentos
        SET status = 'pago', paid_at = CURRENT_TIMESTAMP
        WHERE pagarme_order_id = ? AND status = 'pendente'
      `).run(orderId);

      if (resultado.changes > 0) {
        console.log(`[WEBHOOK] Pagamento confirmado para order: ${orderId}`);
      } else {
        console.warn(`[WEBHOOK] Nenhum pagamento pendente encontrado para order: ${orderId}`);
      }
    }

    if (type === 'order.payment_failed') {
      const orderId = data?.id;

      db.prepare(`
        UPDATE pagamentos
        SET status = 'falhou'
        WHERE pagarme_order_id = ? AND status = 'pendente'
      `).run(orderId);

      console.log(`[WEBHOOK] Pagamento falhou para order: ${orderId}`);
    }

    // Sempre responder 200 ao Pagar.me, senão ele reenvia o evento
    res.status(200).json({ recebido: true });

  } catch (err) {
    console.error('[WEBHOOK ERROR]', err.message);
    // Mesmo com erro interno, retorne 200 para não gerar loop de reenvios
    res.status(200).json({ recebido: true });
  }
};

// LISTAR PAGAMENTOS DA EMPRESA

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

// OBTER LINK DE CHECKOUT DE UM PAGAMENTO PENDENTE
// Útil para reexibir o link caso a empresa não tenha pago ainda.

const obterLinkPagamento = async (req, res) => {
  try {
    const { pagamento_id } = req.params;
    const { empresa_id }   = req.query;

    const pagamento = db.prepare(`
      SELECT * FROM pagamentos WHERE id = ? AND empresa_id = ?
    `).get(pagamento_id, empresa_id);

    if (!pagamento) {
      return res.status(404).json({ erro: 'Pagamento não encontrado' });
    }

    if (pagamento.status === 'pago') {
      return res.status(200).json({ status: 'pago', mensagem: 'Este pagamento já foi realizado.' });
    }

    // Se não tem checkout_url ainda, cria uma nova ordem no Pagar.me
    if (!pagamento.checkout_url) {
      const ordem = await criarOrdemPagarme({
        valor:      pagamento.valor,
        descricao:  pagamento.descricao,
        empresa_id: pagamento.empresa_id,
        vaga_id:    pagamento.vaga_id,
        tipo:       pagamento.tipo,
      });

      const checkout_url = ordem.checkouts?.[0]?.payment_url || null;

      db.prepare(`
        UPDATE pagamentos SET pagarme_order_id = ?, checkout_url = ? WHERE id = ?
      `).run(ordem.id, checkout_url, pagamento_id);

      return res.status(200).json({ checkout_url, order_id: ordem.id });
    }

    res.status(200).json({
      checkout_url:  pagamento.checkout_url,
      order_id:      pagamento.pagarme_order_id,
      status:        pagamento.status,
    });
  } catch (err) {
    console.error('[OBTER LINK]', err.message);
    res.status(500).json({ erro: 'Erro ao obter link de pagamento' });
  }
};

// MÉTRICAS DA EMPRESA (sem alteração na lógica)

const obterMetricas = async (req, res) => {
  try {
    const { empresa_id } = req.query;
    if (!empresa_id) return res.status(400).json({ erro: 'empresa_id é obrigatório' });

    const vagasAtivas = db.prepare(`
      SELECT COUNT(*) as total FROM vagas WHERE empresa_id = ? AND status = 'ativa'
    `).get(empresa_id);

    const desafiosAtivos = db.prepare(`
      SELECT COUNT(*) as total FROM desafios WHERE empresa_id = ? AND status = 'ativo'
    `).get(empresa_id);

    const totalCandidaturas = db.prepare(`
      SELECT COUNT(cd.id) as total
      FROM candidaturas_desafio cd
      JOIN desafios d ON cd.desafio_id = d.id
      WHERE d.empresa_id = ?
    `).get(empresa_id);

    const avanzados = db.prepare(`
      SELECT COUNT(*) as total
      FROM candidaturas_desafio cd
      JOIN desafios d ON cd.desafio_id = d.id
      WHERE d.empresa_id = ? AND cd.avancou_entrevista = 1
    `).get(empresa_id);

    const taxaConversao = totalCandidaturas.total > 0
      ? Math.round((avanzados.total / totalCandidaturas.total) * 100)
      : 0;

    const totalBolsaPago = db.prepare(`
      SELECT COALESCE(SUM(valor), 0) as total
      FROM pagamentos
      WHERE empresa_id = ? AND tipo = 'bolsa_tecnica' AND status = 'pago'
    `).get(empresa_id);

    const pendencias = db.prepare(`
      SELECT COALESCE(SUM(valor), 0) as total
      FROM pagamentos
      WHERE empresa_id = ? AND status = 'pendente'
    `).get(empresa_id);

    res.status(200).json({
      vagas_ativas:          vagasAtivas.total,
      desafios_ativos:       desafiosAtivos.total,
      candidaturas_total:    totalCandidaturas.total,
      avanzados_entrevista:  avanzados.total,
      taxa_conversao_percent: taxaConversao,
      total_bolsa_pago:      totalBolsaPago.total,
      pendencias_valor:      pendencias.total,
    });
  } catch (err) {
    console.error('[METRICAS]', err);
    res.status(500).json({ erro: 'Erro ao obter métricas' });
  }
};

const obterMetricasVaga = async (req, res) => {
  try {
    const { vaga_id }    = req.params;
    const { empresa_id } = req.query;

    const vaga = db.prepare(`
      SELECT * FROM vagas WHERE id = ? AND empresa_id = ?
    `).get(vaga_id, empresa_id);

    if (!vaga) return res.status(404).json({ erro: 'Vaga não encontrada' });

    const desafios    = db.prepare(`SELECT id FROM desafios WHERE vaga_id = ?`).all(vaga_id);
    const desafioIds  = desafios.map(d => d.id);

    if (desafioIds.length === 0) {
      return res.status(200).json({ vaga, metricas: { desafios: 0, candidaturas: 0, entregados: 0, avanzados: 0 } });
    }

    const placeholders = desafioIds.map(() => '?').join(',');
    const metricas = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'em_andamento' THEN 1 ELSE 0 END) as andamento,
        SUM(CASE WHEN status = 'entregue'     THEN 1 ELSE 0 END) as entregues,
        SUM(CASE WHEN avancou_entrevista = 1  THEN 1 ELSE 0 END) as avanzados
      FROM candidaturas_desafio
      WHERE desafio_id IN (${placeholders})
    `).get(...desafioIds);

    res.status(200).json({
      vaga,
      metricas: {
        desafios:     desafios.length,
        candidaturas: metricas.total    || 0,
        andamento:    metricas.andamento || 0,
        entregados:   metricas.entregues || 0,
        avanzados:    metricas.avanzados || 0,
      },
    });
  } catch (err) {
    console.error('[METRICAS VAGA]', err);
    res.status(500).json({ erro: 'Erro ao obter métricas da vaga' });
  }
};

// HISTÓRICO DE ATIVIDADES (mantido do original)

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
      WHERE ha.usuario_id = ?
      ORDER BY ha.created_at DESC
      LIMIT 50
    `).all(empresa_id);

    res.status(200).json(atividades);
  } catch (err) {
    console.error('[LISTAR ATIVIDADES]', err);
    res.status(500).json({ erro: 'Erro ao listar atividades' });
  }
};

// EXPORTS

module.exports = {
  listarPagamentos,
  obterLinkPagamento,
  criarTaxaPlataforma,
  criarCobrancaBolsa,
  receberWebhook,
  obterMetricas,
  obterMetricasVaga,
  registrarAtividade,
  listarAtividades,
};