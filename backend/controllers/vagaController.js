// ============================================================
// TRIVIO - CONTROLADOR DE VAGAS
// ============================================================
// Este arquivo gerencia todas as operações relacionadas a vagas
// de emprego. É como o "departamento de recrutamento" do sistema.
//
// Funções disponíveis:
// - listarVagas: Mostra todas as vagas disponíveis
// - criarVaga: Cria uma nova vaga (empresas fazem isso)
// - atualizarVaga: Altera informações de uma vaga
// - excluirVaga: Remove uma vaga (soft delete)
// ============================================================


// ============================================================
// IMPORTAÇÕES
// ============================================================
// - db: Conexão com o banco de dados
// - pagamentoController: Para criar cobranças quando uma
//                       empresa cria uma vaga
// ============================================================

const db = require('../banco/conexao');
const pagamentoController = require('./pagamentoController');


// ============================================================
// LISTAR VAGAS
// ============================================================
// Esta função busca todas as vagas ativas no sistema.
// É como uma lista de empregos disponíveis.
//
// Você pode filtrar por empresa usando ?empresa_id=xxx
// Exemplo: GET /api/v1/vagas?empresa_id=abc123
//
// O sistema retorna:
// - Todas as vagas ativas
// - O nome da empresa que criou cada vaga
// - Ordenado do mais recente para o mais antigo
// ============================================================

const listarVagas = async (req, res) => {
  try {
    // Pega parâmetros de filtro da URL
    const { empresa_id, remoto, linguagem, tipo, titulo, localizacao, page = 1, limit = 10 } = req.query;

    // Começa a construir a query (consulta SQL)
    let query = `
      SELECT v.*, COALESCE(e.nome, 'Empresa Parceira') as empresa_nome
      FROM vagas v
      LEFT JOIN empresas e ON v.empresa_id = e.public_id
      WHERE v.status = 'ativa'
    `;
    const params = [];

    // Filtro por empresa
    if (empresa_id) {
      query += ` AND v.empresa_id = ?`;
      params.push(empresa_id);
    }

    // Filtro por remoto (1=sim, 0=não)
    if (remoto !== undefined && remoto !== null && remoto !== '') {
      query += ` AND v.remoto = ?`;
      params.push(remoto === 'true' || remoto === '1' ? 1 : 0);
    }

    // Filtro por linguagem (busca dentro da string/JSON)
    if (linguagem) {
      query += ` AND v.linguagens LIKE ?`;
      params.push(`%${linguagem}%`);
    }

    // Filtro por tipo de contrato (CLT, PJ, Estágio, Freelancer)
    if (tipo) {
      query += ` AND v.tipo = ?`;
      params.push(tipo);
    }

    // Filtro por título (busca parcial)
    if (titulo) {
      query += ` AND v.titulo LIKE ?`;
      params.push(`%${titulo}%`);
    }

    // Filtro por localização (busca parcial)
    if (localizacao) {
      query += ` AND v.localizacao LIKE ?`;
      params.push(`%${localizacao}%`);
    }

    // Ordena do mais recente para o mais antigo
    query += ` ORDER BY v.created_at DESC`;

    // Paginação
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const offset = (pageNum - 1) * limitNum;
    query += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);

    // Executa a query e retorna as vagas
    const vagas = db.prepare(query).all(...params);
    
    // Conta total de vagas (sem paginação) para informar ao cliente
    let countQuery = `SELECT COUNT(*) as total FROM vagas v WHERE v.status = 'ativa'`;
    const countParams = [];
    if (empresa_id) { countQuery += ` AND v.empresa_id = ?`; countParams.push(empresa_id); }
    if (remoto !== undefined && remoto !== null && remoto !== '') { countQuery += ` AND v.remoto = ?`; countParams.push(remoto === 'true' || remoto === '1' ? 1 : 0); }
    if (linguagem) { countQuery += ` AND v.linguagens LIKE ?`; countParams.push(`%${linguagem}%`); }
    if (tipo) { countQuery += ` AND v.tipo = ?`; countParams.push(tipo); }
    if (titulo) { countQuery += ` AND v.titulo LIKE ?`; countParams.push(`%${titulo}%`); }
    if (localizacao) { countQuery += ` AND v.localizacao LIKE ?`; countParams.push(`%${localizacao}%`); }
    const { total } = db.prepare(countQuery).get(...countParams);

    res.status(200).json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      vagas
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar vagas' });
  }
};


// ============================================================
// CRIAR VAGA
// ============================================================
// Quando uma empresa quer publicar uma vaga de emprego.
// É como colar um anúncio de emprego no mural.
//
// Dados necessários:
// - empresa_id: ID da empresa (opcional para vagas_anônimas)
// - titulo: Nome da vaga (OBRIGATÓRIO)
// - descricao: Descrição do trabalho
// - requisitos: O que o candidato precisa ter
// - remuneracao: Salário offered
// - localizacao: Onde é o trabalho
// - tipo: CLT, PJ, Estágio, etc
// - bolsa_tecnica: Valor extra para desafios técnicos
//
// Quando criada, automaticamente gera uma cobrança
// de taxa de plataforma para a empresa.
// ============================================================

const criarVaga = async (req, res) => {
  try {
    // Pega os dados do corpo da requisição
    const { empresa_id, titulo, descricao, requisitos, remuneracao, localizacao, tipo, bolsa_tecnica, remoto, linguagens } = req.body;

    // Validação: título é obrigatório
    if (!titulo) {
      return res.status(400).json({ erro: 'Título é obrigatório' });
    }

    // ============================================================
    // INSERIR NO BANCO
    // ============================================================
    const stmt = db.prepare(`
      INSERT INTO vagas (empresa_id, titulo, descricao, requisitos, remuneracao, localizacao, tipo, bolsa_tecnica, remoto, linguagens)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      empresa_id || null,      // pode ser nulo para vagas anônimas
      titulo,                  // obrigatório
      descricao || '',         // se não enviou, usa texto vazio
      requisitos || '',
      remuneracao || '',
      localizacao || '',
      tipo || 'CLT',           // padrão é CLT
      bolsa_tecnica || 0,      // padrão é zero
      remoto !== undefined ? (remoto ? 1 : 0) : null,  // 1=sim, 0=não, null=ambos
      linguagens || null       // ex: "JavaScript,Node.js,Express" ou JSON array
    );

    // Busca a vaga que acabou de ser criada
    const novaVaga = db.prepare('SELECT * FROM vagas WHERE id = ?').get(result.lastInsertRowid);

    // ============================================================
    // CRIAR COBRANÇA
    // ============================================================
    // Se tem empresa, cria a taxa de plataforma
    if (empresa_id) {
      pagamentoController.criarTaxaPlataforma(empresa_id, novaVaga.id, titulo);
    }

    // Retorna a vaga criada com sucesso
    res.status(201).json(novaVaga);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar vaga' });
  }
};


// ============================================================
// ATUALIZAR VAGA
// ============================================================
// Altera informações de uma vaga já existente.
// Pode alterar qualquer campo.
//
// Parâmetro: :id (ID da vaga)
// Dados no corpo: qualquer campo que quiser alterar
//
// O sistema mantém os valores antigos se não forem enviados
// campos novos (usando operador ?? do JavaScript).
// ============================================================

const atualizarVaga = async (req, res) => {
  try {
    const { id } = req.params;  // ID da vaga na URL
    const { titulo, descricao, requisitos, remuneracao, localizacao, tipo, status, bolsa_tecnica, remoto, linguagens } = req.body;

    // Primeiro, verifica se a vaga existe
    const vaga = db.prepare('SELECT * FROM vagas WHERE id = ?').get(id);
    if (!vaga) {
      return res.status(404).json({ erro: 'Vaga não encontrada' });
    }

    // ============================================================
    // ATUALIZAR OS CAMPOS
    // ============================================================
    // O operador || usa o valor novo ou o antigo
    // O operador ?? usa o valor novo ou mantém o null/antigo
    const stmt = db.prepare(`
      UPDATE vagas 
      SET titulo = ?, descricao = ?, requisitos = ?, remuneracao = ?, 
          localizacao = ?, tipo = ?, status = ?, bolsa_tecnica = ?, remoto = ?, linguagens = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      titulo || vaga.titulo,
      descricao ?? vaga.descricao,
      requisitos ?? vaga.requisitos,
      remuneracao ?? vaga.remuneracao,
      localizacao ?? vaga.localizacao,
      tipo || vaga.tipo,
      status || vaga.status,
      bolsa_tecnica ?? vaga.bolsa_tecnica ?? 0,
      remoto !== undefined ? (remoto ? 1 : 0) : vaga.remoto,
      linguagens ?? vaga.linguagens,
      id
    );

    // Retorna a vaga atualizada
    const vagaAtualizada = db.prepare('SELECT * FROM vagas WHERE id = ?').get(id);
    res.status(200).json(vagaAtualizada);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar vaga' });
  }
};


// ============================================================
// EXCLUIR VAGA
// ============================================================
// Remove uma vaga do sistema.
// Usa "soft delete" - não apaga do banco, apenas muda
// o status para 'inativa'. Assim mantém o histórico.
//
// Parâmetro: :id (ID da vaga)
// ============================================================

const excluirVaga = async (req, res) => {
  try {
    const { id } = req.params;

    // Verifica se a vaga existe
    const vaga = db.prepare('SELECT * FROM vagas WHERE id = ?').get(id);
    if (!vaga) {
      return res.status(404).json({ erro: 'Vaga não encontrada' });
    }

    // Soft delete: muda status para inativa
    db.prepare('UPDATE vagas SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('inativa', id);

    res.status(200).json({ mensagem: 'Vaga excluída com sucesso' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao excluir vaga' });
  }
};


// ============================================================
// EXPORTAÇÃO
// ============================================================
// Exporta todas as funções para uso nas rotas.
// ============================================================

module.exports = {
  listarVagas,
  criarVaga,
  atualizarVaga,
  excluirVaga
};
