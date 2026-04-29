// TRIVIO - CONTROLADOR DE USUÁRIOS
// Este arquivo contém todas as funções que lidam com usuários.
// É como o "departamento de RH" do sistema.
// O que cada função faz:
// - criarUsuario: Cadastra um novo usuário
// - uploadImagemAvulsa: Faz upload de imagem avulsa
// - atualizarFotoPerfil: Troca a foto do perfil
// - getConfiguracoes: Busca configurações do usuário
// - atualizarConfiguracoes: Salva novas configurações


// IMPORTAÇÕES
// Precisamos de duas bibliotecas principais:
// - db (conexão): É o banco de dados. Todas as operações
// de leitura e escrita passam por aqui.
// - bcrypt: É o "cofre" que guarda senhas de forma segura.
// Ele transforma senhas em códigos impossíveis
// de reverter. Segurança em primeiro lugar!

const db = require('./banco/conexao');       // Conexão com o banco de dados
const bcrypt = require('bcrypt');           // Biblioteca para criptografar senhas


// FUNÇÃO AUXILIAR: Gerador de ID único
// Cria um ID único para cada usuário. É como um "CPF" único
// que identifica cada pessoa no sistema.
// Como funciona:
// - Date.now(): Pega a data atual em milissegundos
// - Math.random(): Gera um número aleatório
// - Juntamos os dois para ter um ID único

const gerarIdUnico = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// CONFIGURAÇÃO DO CLOUDINARY
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


// CRIAR USUÁRIO
// Esta função é chamada quando alguém quer se cadastrar.
// É como preencher uma ficha de funcionário.
// Passo a passo:
// 1. Recebe nome, email e senha do formulário
// 2. Verifica se todos os campos estão preenchidos
// 3. Verifica se o email já não está em uso
// 4. Se tiver foto, faz upload para o Cloud (Cloudinary)
// 5. Criptografa a senha (nunca guardamos senha pura!)
// 6. Salva tudo no banco de dados
// 7. Retorna os dados do novo usuário

const criarUsuario = async (req, res) => {
  try {
    // Pega os dados que vieram do formulário
    const { nome, email, senha } = req.body;
    const arquivo = req.file;  // Foto enviada (se houver)

    // VALIDAÇÃO BÁSICA
    // Verifica se todos os campos obrigatórios estão preenchidos.
    // Se não estiverem, retorna erro 400 (requisição inválida).
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
    }

    // VERIFICAR SE EMAIL JÁ EXISTE
    // Antes de criar, verifica se esse email já está cadastrado.
    // Se estiver, retorna erro 409 (conflito).
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
    // - password_hash: Senha criptografada (nunca a senha pura!)
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
// Esta função permite fazer upload de uma imagem isolada.
// Útil para testar ou enviar imagens em outros contextos.

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
// Quando o usuário quer mudar sua foto de perfil.
// É como trocar a foto na carteirinha de identidade.
// Passo a passo:
// 1. Verifica se enviou alguma imagem
// 2. Verifica se o usuário existe
// 3. Faz upload da nova foto
// 4. Atualiza no banco de dados

const atualizarFotoPerfil = async (req, res) => {
  try {
    const { tipo, id } = req.params;     // Tipo e ID do usuário
    const arquivo = req.file;       // Nova foto

    // Valida o tipo
    if (!['candidato', 'empresa'].includes(tipo)) {
      return res.status(400).json({ erro: 'Tipo inválido' });
    }

    // Verifica se enviou imagem
    if (!arquivo) {
      return res.status(400).json({ erro: 'Nenhuma imagem enviada' });
    }

    const tabela = tipo === 'candidato' ? 'candidatos' : 'empresas';
    const campo_foto = tipo === 'candidato' ? 'foto_url' : 'logo_url';

    // Verifica se usuário existe
    const usuario = db.prepare(`SELECT id FROM ${tabela} WHERE public_id = ?`).get(id);
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    // Faz upload da nova foto
    const photo_url = await uploadParaCloudinary(arquivo.buffer);

    // Atualiza no banco
    const stmt = db.prepare(`UPDATE ${tabela} SET ${campo_foto} = ? WHERE public_id = ?`);
    stmt.run(photo_url, id);

    res.status(200).json({ photo_url });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar foto de perfil' });
  }
};


// BUSCAR CONFIGURAÇÕES
// Cada usuário (candidato ou empresa) tem suas configurações.
// Esta função busca essas configurações.
// O parâmetro :tipo pode ser "candidato" ou "empresa".
// O parâmetro :id é o identificador do usuário.

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
    // Precisamos transformar de volta para objeto.
    let configuracoes = {};
    if (usuario.configuracoes) {
      try {
        configuracoes = JSON.parse(usuario.configuracoes);
      } catch (e) {
        configuracoes = {};
      }
    }

    // Retorna as configurações e dados básicos
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
// Salva as novas configurações do usuário.
// Pode atualizar tanto as configurações quanto dados básicos (nome, email).

const atualizarConfiguracoes = async (req, res) => {
  try {
    const { tipo, id } = req.params;
    const { configuracoes, dadosBasicos } = req.body;

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

    // ATUALIZAR CONFIGURAÇÕES (JSON)
    // Se o usuário enviou novas configurações, salvamos.
    // Primeiro transformamos o objeto em texto (stringify).
    if (configuracoes) {
      const configStr = JSON.stringify(configuracoes);
      db.prepare(`UPDATE ${tabela} SET configuracoes = ? WHERE public_id = ?`).run(configStr, id);
    }

    // ATUALIZAR DADOS BÁSICOS
    // Se o usuário enviou nome ou email, atualizamos também.
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


// EXPORTAÇÃO DAS FUNÇÕES
// Precisamos exportar todas as funções para que other arquivos
// possam usá-las. É como colocar num cardápio para ser pedido.

module.exports = {
  criarUsuario,
  uploadImagemAvulsa,
  atualizarFotoPerfil,
  getConfiguracoes,
  atualizarConfiguracoes
};