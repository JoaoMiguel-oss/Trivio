const db = require('../banco/conexao');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'trivio_dev_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const gerarIdUnico = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const parseCookies = (req) => {
    const header = req.headers.cookie || '';
    return header.split(';').map(cookie => cookie.trim()).filter(Boolean).reduce((acc, cookie) => {
        const [name, ...value] = cookie.split('=');
        acc[name] = decodeURIComponent(value.join('='));
        return acc;
    }, {});
};

const salvarUsuarioLembrado = (email, tipo, remember_key = null) => {
    if (!remember_key) remember_key = gerarIdUnico();

    const now = new Date().toISOString();
    const existe = db.prepare('SELECT id FROM remembered_users WHERE remember_key = ?').get(remember_key);

    if (existe) {
        db.prepare('UPDATE remembered_users SET email = ?, tipo = ?, updated_at = ? WHERE remember_key = ?')
            .run(email, tipo, now, remember_key);
    } else {
        db.prepare(`
            INSERT INTO remembered_users (remember_key, email, tipo, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(remember_key, email, tipo, now, now);
    }

    return remember_key;
};

const setRememberCookie = (res, remember_key) => {
    res.setHeader('Set-Cookie', `remember_key=${remember_key}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`);
};

const obterUsuarioLembrado = (req, res) => {
    try {
        const cookies = parseCookies(req);
        if (!cookies.remember_key) {
            return res.status(200).json({ data: null });
        }

        const usuario = db.prepare('SELECT email, tipo FROM remembered_users WHERE remember_key = ?').get(cookies.remember_key);
        return res.status(200).json({ data: usuario || null });
    } catch (erro) {
        console.error('[OBTER USUARIO LEMBRADO]', erro);
        return res.status(500).json({ erro: 'Erro interno ao buscar usuário lembrado' });
    }
};

// CADASTRO
const cadastrar = async (req, res) => {
    try {
        const { tipo, nome, email, senha, cnpj } = req.body;

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

        const emailExiste = db.prepare(`SELECT id FROM ${tabela} WHERE email = ?`).get(email);
        if (emailExiste) {
            return res.status(409).json({ erro: 'Este e-mail já está cadastrado' });
        }

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

        // Busca o usuário criado para retornar dados completos
        const usuario = db.prepare(`SELECT * FROM ${tabela} WHERE public_id = ?`).get(public_id);
        
        const remember_key = salvarUsuarioLembrado(email, tipo, parseCookies(req).remember_key);
        setRememberCookie(res, remember_key);

        return res.status(201).json({
            mensagem: 'Conta criada com sucesso',
            usuario: {
                public_id: usuario.public_id,
                nome: usuario.nome,
                email: usuario.email,
                foto_url: usuario.foto_url || usuario.logo_url || null,
                tipo,
                configuracoes: usuario.configuracoes ? JSON.parse(usuario.configuracoes) : {}
            }
        });

    } catch (erro) {
        console.error('[CADASTRO ERROR]', erro);
        return res.status(500).json({ erro: 'Erro interno ao criar conta' });
    }
};

// LOGIN
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

        const payload = {
            public_id: usuario.public_id,
            tipo,
            email: usuario.email
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        let configuracoes = {};
        if (usuario.configuracoes) {
            try { configuracoes = JSON.parse(usuario.configuracoes); } catch (_) {}
        }

        const remember_key = salvarUsuarioLembrado(email, tipo, parseCookies(req).remember_key);
        setRememberCookie(res, remember_key);

        return res.status(200).json({
            mensagem: 'Login realizado com sucesso',
            token,
            usuario: {
                public_id: usuario.public_id,
                nome: usuario.nome,
                email: usuario.email,
                foto_url: usuario.foto_url || usuario.logo_url || null,
                tipo,
                configuracoes
            }
        });

    } catch (erro) {
        console.error('[LOGIN ERROR]', erro);
        return res.status(500).json({ erro: 'Erro interno ao fazer login' });
    }
};

module.exports = { cadastrar, login, obterUsuarioLembrado };