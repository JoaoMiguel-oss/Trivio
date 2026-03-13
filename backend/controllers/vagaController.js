const db = require('../banco/conexao');

const listarVagas = async (req, res) => {
  try {
    const vagas = db.prepare(`
      SELECT * FROM vagas 
      WHERE status = 'ativa' 
      ORDER BY created_at DESC
    `).all();
    
    res.status(200).json(vagas);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar vagas' });
  }
};

const criarVaga = async (req, res) => {
  try {
    const { empresa_id, titulo, descricao, requisitos, remuneracao, localizacao, tipo } = req.body;

    if (!titulo) {
      return res.status(400).json({ erro: 'Título é obrigatório' });
    }

    const stmt = db.prepare(`
      INSERT INTO vagas (empresa_id, titulo, descricao, requisitos, remuneracao, localizacao, tipo)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      empresa_id || null,
      titulo,
      descricao || '',
      requisitos || '',
      remuneracao || '',
      localizacao || '',
      tipo || 'CLT'
    );

    const novaVaga = db.prepare('SELECT * FROM vagas WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(novaVaga);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao criar vaga' });
  }
};

const atualizarVaga = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descricao, requisitos, remuneracao, localizacao, tipo, status } = req.body;

    const vaga = db.prepare('SELECT * FROM vagas WHERE id = ?').get(id);
    if (!vaga) {
      return res.status(404).json({ erro: 'Vaga não encontrada' });
    }

    const stmt = db.prepare(`
      UPDATE vagas 
      SET titulo = ?, descricao = ?, requisitos = ?, remuneracao = ?, 
          localizacao = ?, tipo = ?, status = ?, updated_at = CURRENT_TIMESTAMP
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
