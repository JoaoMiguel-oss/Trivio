const db = require('./banco/conexao');
const bcrypt = require('bcrypt');

// Gerador de ID simples
const gerarIdUnico = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const criarUsuario = async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    const arquivo = req.file;

    // Validação básica
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
    }

    // Verifica se email já existe
    const existe = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existe) {
      return res.status(409).json({ erro: 'Email já cadastrado' });
    }

    // Upload da imagem (opcional)
    let photo_url = null;
    if (arquivo) {
      try {
        photo_url = await uploadParaCloudinary(arquivo.buffer);
      } catch (uploadErr) {
        return res.status(500).json({ erro: 'Falha no upload da imagem' });
      }
    }

    // Preparação dos dados
    const public_id = gerarIdUnico();
    const password_hash = await bcrypt.hash(senha, 10);

    // Inserção no banco
    const stmt = db.prepare(`
      INSERT INTO users (public_id, name, email, password_hash, photo_url)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(public_id, nome, email, password_hash, photo_url);

    // Retorno (MVP)
    res.status(201).json({
      public_id,
      nome,
      email,
      photo_url
    });

  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro interno ao criar usuário' });
  }
};

const uploadImagemAvulsa = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
    }

    const url = await uploadParaCloudinary(req.file.buffer);
    res.status(200).json({ url });

  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao fazer upload' });
  }
};

const atualizarFotoPerfil = async (req, res) => {
  try {
    const { id } = req.params; // Espera o public_id
    const arquivo = req.file;

    if (!arquivo) {
      return res.status(400).json({ erro: 'Nenhuma imagem enviada' });
    }

    // Verifica se usuário existe (busca pelo public_id)
    const usuario = db.prepare('SELECT id FROM users WHERE public_id = ?').get(id);
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    const photo_url = await uploadParaCloudinary(arquivo.buffer);

    const stmt = db.prepare('UPDATE users SET photo_url = ? WHERE public_id = ?');
    stmt.run(photo_url, id);

    res.status(200).json({ photo_url });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar foto de perfil' });
  }
};

const getConfiguracoes = async (req, res) => {
  try {
    const { tipo, id } = req.params;
    if (!['candidato', 'empresa'].includes(tipo)) {
      return res.status(400).json({ erro: 'Tipo inválido' });
    }
    const tabela = tipo === 'candidato' ? 'candidatos' : 'empresas';

    // As tabelas usam 'public_id' como identificador no frontend
    const usuario = db.prepare(`SELECT * FROM ${tabela} WHERE public_id = ?`).get(id);
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    let configuracoes = {};
    if (usuario.configuracoes) {
      try {
        configuracoes = JSON.parse(usuario.configuracoes);
      } catch (e) {
        configuracoes = {};
      }
    }

    res.status(200).json({
      configuracoes,
      dadosBasicos: {
        nome: usuario.nome,
        email: usuario.email,
        foto_url: usuario.foto_url || usuario.logo_url
      }
    });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar configurações' });
  }
};

const atualizarConfiguracoes = async (req, res) => {
  try {
    const { tipo, id } = req.params;
    const { configuracoes, dadosBasicos } = req.body;

    if (!['candidato', 'empresa'].includes(tipo)) {
      return res.status(400).json({ erro: 'Tipo inválido' });
    }
    const tabela = tipo === 'candidato' ? 'candidatos' : 'empresas';

    const usuario = db.prepare(`SELECT id FROM ${tabela} WHERE public_id = ?`).get(id);
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    // Atualiza configurações JSON
    if (configuracoes) {
      const configStr = JSON.stringify(configuracoes);
      db.prepare(`UPDATE ${tabela} SET configuracoes = ? WHERE public_id = ?`).run(configStr, id);
    }

    // Atualiza dados básicos se fornecido (Nome, Email)
    if (dadosBasicos) {
      if (dadosBasicos.nome) {
        db.prepare(`UPDATE ${tabela} SET nome = ? WHERE public_id = ?`).run(dadosBasicos.nome, id);
      }
      if (dadosBasicos.email) {
        db.prepare(`UPDATE ${tabela} SET email = ? WHERE public_id = ?`).run(dadosBasicos.email, id);
      }
    }

    res.status(200).json({ mensagem: 'Configurações atualizadas com sucesso' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar configurações' });
  }
};

module.exports = {
  criarUsuario,
  uploadImagemAvulsa,
  atualizarFotoPerfil,
  getConfiguracoes,
  atualizarConfiguracoes
};