const db = require('../banco/conexao');
const pagamentoController = require('./pagamentoController');

const listarVagas = async (req, res) => {
  try {
    const { empresa_id } = req.query;

    let query = `
      SELECT v.*, COALESCE(e.nome, 'Empresa Parceira') as empresa_nome
      FROM vagas v
      LEFT JOIN empresas e ON v.empresa_id = e.public_id
      WHERE v.status = 'ativa'
    `;
    const params = [];

    if (empresa_id) {
      query += ` AND v.empresa_id = ?`;
      params.push(empresa_id);
    }

    query += ` ORDER BY v.created_at DESC`;

    const vagas = db.prepare(query).all(...params);
    res.status(200).json(vagas);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar vagas' });
  }
};

const criarVaga = async (req, res) => {
  try {
    const { empresa_id, titulo, descricao, requisitos, remuneracao, localizacao, tipo, bolsa_tecnica } = req.body;

    if (!titulo) {
      return res.status(400).json({ erro: 'Título é obrigatório' });
    }

    const stmt = db.prepare(`
      INSERT INTO vagas (empresa_id, titulo, descricao, requisitos, remuneracao, localizacao, tipo, bolsa_tecnica)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      empresa_id || null,
      titulo,
      descricao || '',
      requisitos || '',
      remuneracao || '',
      localizacao || '',
      tipo || 'CLT',
      bolsa_tecnica || 0
    );

    const novaVaga = db.prepare('SELECT * FROM vagas WHERE id = ?').get(result.lastInsertRowid);

    // Criar cobrança da taxa de plataforma
    if (empresa_id) {
      pagamentoController.criarTaxaPlataforma(empresa_id, novaVaga.id, titulo);
    }

    res.status(201).json(novaVaga);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar vaga' });
  }
};

const atualizarVaga = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descricao, requisitos, remuneracao, localizacao, tipo, status, bolsa_tecnica } = req.body;

    const vaga = db.prepare('SELECT * FROM vagas WHERE id = ?').get(id);
    if (!vaga) {
      return res.status(404).json({ erro: 'Vaga não encontrada' });
    }

    const stmt = db.prepare(`
      UPDATE vagas 
      SET titulo = ?, descricao = ?, requisitos = ?, remuneracao = ?, 
          localizacao = ?, tipo = ?, status = ?, bolsa_tecnica = ?, updated_at = CURRENT_TIMESTAMP
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
      id
    );

    const vagaAtualizada = db.prepare('SELECT * FROM vagas WHERE id = ?').get(id);

    res.status(200).json(vagaAtualizada);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar vaga' });
  }
};

const excluirVaga = async (req, res) => {
  try {
    const { id } = req.params;

    const vaga = db.prepare('SELECT * FROM vagas WHERE id = ?').get(id);
    if (!vaga) {
      return res.status(404).json({ erro: 'Vaga não encontrada' });
    }

    // Soft delete - change status to 'inativa'
    db.prepare('UPDATE vagas SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('inativa', id);

    res.status(200).json({ mensagem: 'Vaga excluída com sucesso' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao excluir vaga' });
  }
};

module.exports = {
  listarVagas,
  criarVaga,
  atualizarVaga,
  excluirVaga
};
