

const db = require('./banco/conexao');       // Conexão com o banco de dados
const bcrypt = require('bcrypt');           // Biblioteca para criptografar senhas




const gerarIdUnico = () => Date.now().toString(36) + Math.random().toString(36).substr(2);


// CRIAR USUÁRIO
// ============================================================
// Esta função é chamada quando alguém quer se cadastrar.
// É como preencher uma ficha de funcionário.
//
// Passo a passo:
// 1. Recebe nome, email e senha do formulário
// 2. Verifica se todos os campos estão preenchidos
// 3. Verifica se o email já não está em uso
// 4. Se tiver foto, faz upload para o Cloud (Cloudinary)
// 5. Criptografa a senha (nunca guardamos senha pura!)
// 6. Salva tudo no banco de dados
// 7. Retorna os dados do novo usuário
// ============================================================

const criarUsuario = async (req, res) => {
  try {
    // Pega os dados que vieram do formulário
    const { nome, email, senha } = req.body;
    const arquivo = req.file;  

    // VALIDAÇÃO BÁSICA
    // Verifica se todos os campos obrigatórios estão preenchidos.
    // Se não estiverem, retorna erro 400 (requisição inválida).
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
    }

    // VERIFICAR SE EMAIL JÁ EXISTE
    const existe = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existe) {
      return res.status(409).json({ erro: 'Email já cadastrado' });
    }

    // UPLOAD DA FOTO (Opcional)
    // Se o usuário enviou uma foto, mandamos para o Cloud.
    // O Cloudinary é como um "álbum online" para fotos.
    // Se der errado, informamos o erro.
    let photo_url = null;
    if (arquivo) {
      try {
        // Envia a foto para o Cloudinary
        photo_url = await uploadParaCloudinary(arquivo.buffer);
      } catch (uploadErr) {
        return res.status(500).json({ erro: 'Falha no upload da imagem' });
      }
    }

    // PREPARAR DADOS PARA SALVAR
    // - public_id: ID único do usuário
    // - password_hash: Senha criptografada
    const public_id = gerarIdUnico();
    const password_hash = await bcrypt.hash(senha, 10);  // Criptografa a senha

    // SALVAR NO BANCO DE DADOS
    // Insert é o comando para criar um novo registro.
    const stmt = db.prepare(`
      INSERT INTO users (public_id, name, email, password_hash, photo_url)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(public_id, nome, email, password_hash, photo_url);

    // RETORNO (Sucesso!)
    // Retorna 201 (criado) com os dados do novo usuário.
    // A senha NÃO é retornada por segurança.
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


// UPLOAD DE IMAGEM AVULSA


const uploadImagemAvulsa = async (req, res) => {
  try {
    // Verifica se veio algum arquivo
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
    }

    // Envia para o Cloudinary e retorna a URL
    const url = await uploadParaCloudinary(req.file.buffer);
    res.status(200).json({ url });

  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao fazer upload' });
  }
};


// ATUALIZAR FOTO DE PERFIL

const atualizarFotoPerfil = async (req, res) => {
  try {
    const { id } = req.params;     // ID do usuário
    const arquivo = req.file;       // Nova foto

    // Verifica se enviou imagem
    if (!arquivo) {
      return res.status(400).json({ erro: 'Nenhuma imagem enviada' });
    }

    // Verifica se usuário existe
    const usuario = db.prepare('SELECT id FROM users WHERE public_id = ?').get(id);
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    // Faz upload da nova foto
    const photo_url = await uploadParaCloudinary(arquivo.buffer);

    // Atualiza no banco
    const stmt = db.prepare('UPDATE users SET photo_url = ? WHERE public_id = ?');
    stmt.run(photo_url, id);

    res.status(200).json({ photo_url });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar foto de perfil' });
  }
};


// BUSCAR CONFIGURAÇÕES


const getConfiguracoes = async (req, res) => {
  try {
    const { tipo, id } = req.params;

    // Valida o tipo (só aceita candidato ou empresa)
    if (!['candidato', 'empresa'].includes(tipo)) {
      return res.status(400).json({ erro: 'Tipo inválido' });
    }

    // Escolhe a tabela correta baseado no tipo
    const tabela = tipo === 'candidato' ? 'candidatos' : 'empresas';

    // Busca o usuário no banco
    const usuario = db.prepare(`SELECT * FROM ${tabela} WHERE public_id = ?`).get(id);
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    // As configurações são guardadas como JSON (texto).
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


// ATUALIZAR CONFIGURAÇÕES



const atualizarConfiguracoes = async (req, res) => {
  try {
    const { tipo, id } = req.params;
    const { configuracoes, dadosBasicos } = req.body;

    console.log('Atualizando configurações:', { tipo, id, configuracoes, dadosBasicos });

    // Valida o tipo
    if (!['candidato', 'empresa'].includes(tipo)) {
      return res.status(400).json({ erro: 'Tipo inválido' });
    }

    const tabela = tipo === 'candidato' ? 'candidatos' : 'empresas';

    // Verifica se usuário existe
    const usuario = db.prepare(`SELECT id FROM ${tabela} WHERE public_id = ?`).get(id);
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

  
    if (configuracoes) {
      const configStr = JSON.stringify(configuracoes);
      db.prepare(`UPDATE ${tabela} SET configuracoes = ? WHERE public_id = ?`).run(configStr, id);
    }

    // ATUALIZAR DADOS 

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
