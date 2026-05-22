const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'trivio_dev_secret';

const verificarAutenticacao = (req, res, next) => {
  // TEMPORÁRIO: Compatibilidade com frontend antigo (remover após migração)
  const idUsuarioLegacy = req.headers['id-usuario'];
  
  // Novo padrão: Authorization: Bearer <token>
  const authHeader = req.headers['authorization'];
  
  // Se tem token JWT, usa o padrão novo
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      
      req.usuario = {
        public_id: payload.public_id,
        tipo: payload.tipo,
        email: payload.email
      };
      
      return next();
    } catch (erro) {
      return res.status(401).json({ 
        sucesso: false,
        mensagem: 'Token inválido ou expirado' 
      });
    }
  }
  
  // TEMPORÁRIO: Fallback para header antigo
  if (idUsuarioLegacy) {
    req.usuario = {
      public_id: idUsuarioLegacy,
      tipo: 'desconhecido',
      email: null
    };
    return next();
  }
  
  return res.status(401).json({ 
    sucesso: false,
    mensagem: 'Usuário não autenticado' 
  });
};

module.exports = verificarAutenticacao;
