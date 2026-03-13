const db = require('../banco/conexao');
const bcrypt = require('bcrypt');

// Gera um ID público único
const gerarIdUnico = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// ─────────────────────────────────────────────
// POST /api/v1/auth/cadastro
// Body: { tipo: 'candidato'|'empresa', nome, email, senha, cnpj? }
// ─────────────────────────────────────────────
const cadastrar = async (req, res) => {
    try {
        const { tipo, nome, email, senha, cnpj } = req.body;

        // Validação básica
        if (!tipo || !nome || !email || !senha) {
            return res.status(400).json({ erro: 'Tipo, nome, email e senha são obrigatórios' });
        }
        if (!['candidato', 'empresa'].includes(tipo)) {
            return res.status(400).json({ erro: 'Tipo deve ser "candidato" ou "empresa"' });
        }
        if (senha.length < 6) {
            return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres' });
        }

        const tabela = tipo === 'candidato' ? 'candidatos' : 'empresas';

        // Verifica duplicidade de email
        const emailExiste = db.prepare(`SELECT id FROM ${tabela} WHERE email = ?`).get(email);
        if (emailExiste) {
            return res.status(409).json({ erro: 'Este e-mail já está cadastrado' });
        }

        // Para empresa, CNPJ é obrigatório e único
        if (tipo === 'empresa') {
            if (!cnpj) {
                return res.status(400).json({ erro: 'CNPJ é obrigatório para empresas' });
            }
            const cnpjExiste = db.prepare('SELECT id FROM empresas WHERE cnpj = ?').get(cnpj);
            if (cnpjExiste) {
                return res.status(409).json({ erro: 'Este CNPJ já está cadastrado' });
            }
        }

        const public_id = gerarIdUnico();
        const senha_hash = await bcrypt.hash(senha, 10);

        if (tipo === 'candidato') {
            db.prepare(`
        INSERT INTO candidatos (public_id, nome, email, senha_hash)
        VALUES (?, ?, ?, ?)
      `).run(public_id, nome, email, senha_hash);
        } else {
            db.prepare(`
        INSERT INTO empresas (public_id, nome, cnpj, email, senha_hash)
        VALUES (?, ?, ?, ?, ?)
      `).run(public_id, nome, cnpj, email, senha_hash);
        }

        return res.status(201).json({
            mensagem: 'Conta criada com sucesso',
            usuario: { public_id, nome, email, tipo }
        });

    } catch (erro) {
        console.error('[CADASTRO ERROR]', erro);
        return res.status(500).json({ erro: 'Erro interno ao criar conta' });
    }
};

// ─────────────────────────────────────────────
// POST /api/v1/auth/login
// Body: { tipo: 'candidato'|'empresa', email, senha }
// ─────────────────────────────────────────────
const login = async (req, res) => {
    try {
        const { tipo, email, senha } = req.body;

        if (!tipo || !email || !senha) {
            return res.status(400).json({ erro: 'Tipo, email e senha são obrigatórios' });
        }
        if (!['candidato', 'empresa'].includes(tipo)) {
            return res.status(400).json({ erro: 'Tipo deve ser "candidato" ou "empresa"' });
        }

        const tabela = tipo === 'candidato' ? 'candidatos' : 'empresas';

        const usuario = db.prepare(`SELECT * FROM ${tabela} WHERE email = ?`).get(email);
        if (!usuario) {
            return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
        }

        const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
        if (!senhaCorreta) {
            return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
        }

        // Retorna dados do usuário (sem a senha!)
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

module.exports = { cadastrar, login };
