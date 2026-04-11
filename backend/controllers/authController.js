// ============================================================
// TRIVIO - CONTROLADOR DE AUTENTICAÇÃO
// ============================================================
// Este arquivo é o "porteiro" do sistema. Ele controla quem
// pode entrar e quem não pode.
//
// Duas funções principais:
// 1. cadastrar: Cria novas contas (candidatos ou empresas)
// 2. login: Verifica se o usuário pode entrar no sistema
// ============================================================


// ============================================================
// IMPORTAÇÕES
// ============================================================
// - db: O banco de dados com todas as informações
// - bcrypt: Para criptografar e verificar senhas
// ============================================================

const db = require('../banco/conexao');
const bcrypt = require('bcrypt');


// ============================================================
// GERADOR DE ID ÚNICO
// ============================================================
// Cria um ID diferente para cada usuário. É como gerar
// uma "impressão digital" digital.
// ============================================================

const gerarIdUnico = () => Date.now().toString(36) + Math.random().toString(36).substr(2);


// ============================================================
// CADASTRAR NOVO USUÁRIO
// ============================================================
// Esta função é chamada quando alguém quer criar uma conta nova.
// Pode ser um candidato (pessoa procurando emprego) ou
// uma empresa (que vai contratar pessoas).
//
// O que vamos fazer:
// 1. Verificar se recebeu todos os dados necessários
// 2. Validar o tipo (só aceita candidato ou empresa)
// 3. Verificar se a senha tem pelo menos 6 caracteres
// 4. Verificar se o email já não está em uso
// 5. Se for empresa, verificar se o CNPJ é válido
// 6. Criar o ID único e criptografar a senha
// 7. Salvar no banco de dados
// ============================================================

const cadastrar = async (req, res) => {
    try {
        // Pega os dados do formulário
        const { tipo, nome, email, senha, cnpj } = req.body;

        // ============================================================
        // VALIDAÇÃO BÁSICA
        // ============================================================
        // Verifica se todos os campos obrigatórios estão preenchidos.
        if (!tipo || !nome || !email || !senha) {
            return res.status(400).json({ erro: 'Tipo, nome, email e senha são obrigatórios' });
        }

        // Só aceita candidato ou empresa
        if (!['candidato', 'empresa'].includes(tipo)) {
            return res.status(400).json({ erro: 'Tipo deve ser "candidato" ou "empresa"' });
        }

        // Senha deve ter pelo menos 6 caracteres (segurança básica)
        if (senha.length < 6) {
            return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres' });
        }

        // Escolhe a tabela correta baseado no tipo
        const tabela = tipo === 'candidato' ? 'candidatos' : 'empresas';

        // ============================================================
        // VERIFICAR SE EMAIL JÁ EXISTE
        // ============================================================
        // Não pode ter dois usuários com mesmo email.
        const emailExiste = db.prepare(`SELECT id FROM ${tabela} WHERE email = ?`).get(email);
        if (emailExiste) {
            return res.status(409).json({ erro: 'Este e-mail já está cadastrado' });
        }

        // ============================================================
        // VERIFICAR CNPJ (só para empresas)
        // ============================================================
        // Empresas precisam ter CNPJ válido.
        if (tipo === 'empresa') {
            if (!cnpj) {
                return res.status(400).json({ erro: 'CNPJ é obrigatório para empresas' });
            }
            const cnpjExiste = db.prepare('SELECT id FROM empresas WHERE cnpj = ?').get(cnpj);
            if (cnpjExiste) {
                return res.status(409).json({ erro: 'Este CNPJ já está cadastrado' });
            }
        }

        // ============================================================
        // CRIAR USUÁRIO
        // ============================================================
        // Gera ID único e criptografa a senha
        const public_id = gerarIdUnico();
        const senha_hash = await bcrypt.hash(senha, 10);

        // Insere no banco de dados
        if (tipo === 'candidato') {
            // Para candidatos: public_id, nome, email, senha
            db.prepare(`
        INSERT INTO candidatos (public_id, nome, email, senha_hash)
        VALUES (?, ?, ?, ?)
      `).run(public_id, nome, email, senha_hash);
        } else {
            // Para empresas: public_id, nome, CNPJ, email, senha
            db.prepare(`
        INSERT INTO empresas (public_id, nome, cnpj, email, senha_hash)
        VALUES (?, ?, ?, ?, ?)
      `).run(public_id, nome, cnpj, email, senha_hash);
        }

        // Retorna sucesso
        return res.status(201).json({
            mensagem: 'Conta criada com sucesso',
            usuario: { public_id, nome, email, tipo }
        });

    } catch (erro) {
        console.error('[CADASTRO ERROR]', erro);
        return res.status(500).json({ erro: 'Erro interno ao criar conta' });
    }
};


// ============================================================
// LOGIN (ENTRAR NO SISTEMA)
// ============================================================
// Esta função verifica se o usuário pode entrar.
// É como a catraca do metrô: só passa quem tem passagem válida.
//
// Passo a passo:
// 1. Verifica se recebeu tipo, email e senha
// 2. Busca o usuário no banco pelo email
// 3. Compara a senha enviada com a senha guardada
// 4. Se tudo OK, retorna os dados do usuário
// ============================================================

const login = async (req, res) => {
    try {
        // Pega os dados do formulário de login
        const { tipo, email, senha } = req.body;

        // ============================================================
        // VALIDAÇÃO BÁSICA
        // ============================================================
        if (!tipo || !email || !senha) {
            return res.status(400).json({ erro: 'Tipo, email e senha são obrigatórios' });
        }
        if (!['candidato', 'empresa'].includes(tipo)) {
            return res.status(400).json({ erro: 'Tipo deve ser "candidato" ou "empresa"' });
        }

        const tabela = tipo === 'candidato' ? 'candidatos' : 'empresas';

        // ============================================================
        // BUSCAR USUÁRIO NO BANCO
        // ============================================================
        const usuario = db.prepare(`SELECT * FROM ${tabela} WHERE email = ?`).get(email);

        // Se não encontrou ninguém com esse email
        if (!usuario) {
            return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
        }

        // ============================================================
        // VERIFICAR SENHA
        // ============================================================
        // bcrypt.compare() compara a senha digitada com a
        // senha criptografada que está no banco.
        const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);

        // Se a senha estiver errada
        if (!senhaCorreta) {
            return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
        }

        // ============================================================
        // LOGIN COM SUCESSO!
        // ============================================================
        // Retorna os dados do usuário (NUNCA retorna a senha!)
        return res.status(200).json({
            mensagem: 'Login realizado com sucesso',
            usuario: {
                public_id: usuario.public_id,
                nome: usuario.nome,
                email: usuario.email,
                foto_url: usuario.foto_url || usuario.logo_url || null,
                tipo
            }
        });

    } catch (erro) {
        console.error('[LOGIN ERROR]', erro);
        return res.status(500).json({ erro: 'Erro interno ao fazer login' });
    }
};


// ============================================================
// EXPORTAÇÃO
// ============================================================
// Exporta as duas funções para que possam ser usadas
// nas rotas de autenticação.
// ============================================================

module.exports = { cadastrar, login };
