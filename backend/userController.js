const db = require('./banco/conexao');
const bcrypt = require('bcrypt');

const gerarIdUnico = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const cloudinary = require('cloudinary').v2;

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadParaCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'trivio' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    if (fileBuffer) {
        uploadStream.end(fileBuffer);
    } else {
        reject(new Error('Buffer vazio'));
    }
  });
};

const criarUsuario = async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    const arquivo = req.file;

    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, email e senha sao obrigatorios' });
    }

    const existe = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existe) {
      return res.status(409).json({ erro: 'Email ja cadastrado' });
    }

    let photo_url = null;
    if (arquivo) {
      try {
        photo_url = await uploadParaCloudinary(arquivo.buffer);
      } catch (uploadErr) {
        return res.status(500).json({ erro: 'Falha no upload da imagem' });
      }
    }

    const public_id = gerarIdUnico();
    const password_hash = await bcrypt.hash(senha, 10);

    db.prepare(`
      INSERT INTO users (public_id, name, email, password_hash, photo_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(public_id, nome, email, password_hash, photo_url);

    res.status(201).json({ public_id, nome, email, photo_url });

  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro interno ao criar usuario' });
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
    const { tipo, id } = req.params;
    const arquivo = req.file;

    if (!['candidato', 'empresa'].includes(tipo)) {
      return res.status(400).json({ erro: 'Tipo invalido' });
    }

    if (!arquivo) {
      return res.status(400).json({ erro: 'Nenhuma imagem enviada' });
    }

    const tabela = tipo === 'candidato' ? 'candidatos' : 'empresas';
    const campo_foto = tipo === 'candidato' ? 'foto_url' : 'logo_url';

    const usuario = db.prepare(`SELECT id FROM ${tabela} WHERE public_id = ?`).get(id);
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuario nao encontrado' });
    }

    const photo_url = await uploadParaCloudinary(arquivo.buffer);
    db.prepare(`UPDATE ${tabela} SET ${campo_foto} = ? WHERE public_id = ?`).run(photo_url, id);

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
      return res.status(400).json({ erro: 'Tipo invalido' });
    }

    const tabela = tipo === 'candidato' ? 'candidatos' : 'empresas';
    const usuario = db.prepare(`SELECT * FROM ${tabela} WHERE public_id = ?`).get(id);
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuario nao encontrado' });
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
    res.status(500).json({ erro: 'Erro ao buscar configuracoes' });
  }
};

const atualizarConfiguracoes = async (req, res) => {
  try {
    const { tipo, id } = req.params;
    const { configuracoes, dadosBasicos } = req.body;

    if (!['candidato', 'empresa'].includes(tipo)) {
      return res.status(400).json({ erro: 'Tipo invalido' });
    }

    const tabela = tipo === 'candidato' ? 'candidatos' : 'empresas';

    const usuario = db.prepare(`SELECT id FROM ${tabela} WHERE public_id = ?`).get(id);
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuario nao encontrado' });
    }

    if (configuracoes) {
      const configStr = JSON.stringify(configuracoes);
      db.prepare(`UPDATE ${tabela} SET configuracoes = ? WHERE public_id = ?`).run(configStr, id);
    }

    if (dadosBasicos) {
      if (dadosBasicos.nome) {
        db.prepare(`UPDATE ${tabela} SET nome = ? WHERE public_id = ?`).run(dadosBasicos.nome, id);
      }
      if (dadosBasicos.email) {
        db.prepare(`UPDATE ${tabela} SET email = ? WHERE public_id = ?`).run(dadosBasicos.email, id);
      }
    }

    res.status(200).json({ mensagem: 'Configuracoes atualizadas com sucesso' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar configuracoes' });
  }
};

module.exports = {
  criarUsuario,
  uploadImagemAvulsa,
  atualizarFotoPerfil,
  getConfiguracoes,
  atualizarConfiguracoes
};
