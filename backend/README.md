#  Trivio Backend - Documentação

##  Visão Geral

O **Trivio Backend** é a API que gerencia o sistema de vagas de emprego da plataforma Trivio. Ele permite que empresas postem vagas, candidatos busquem oportunidades, e oferece um sistema robusto de filtros e autenticação.

---

##  Como Rodar

### Pré-requisitos
- Node.js v20+
- npm ou yarn

### Instalação e Execução

```bash
# Instalar dependências
npm install

# Rodar o servidor em desenvolvimento
npm run dev

# O servidor estará disponível em http://localhost:3000
```

**Ou manualmente:**
```bash
cd backend
node servidor.js
```

---

##  Estrutura do Projeto

```
backend/
├── servidor.js                 # Arquivo principal (Express app)
├── userController.js           # Controlador de usuários
├── userRoutes.js              # Rotas de usuários
├── banco/
│   └── conexao.js             # Conexão com SQLite
├── controllers/
│   ├── vagaController.js      # Controlador de vagas ⭐
│   ├── authController.js      # Autenticação
│   ├── desafioController.js   # Desafios técnicos
│   └── pagamentoController.js # Pagamentos
├── rotas/
│   ├── vagas.js               # Rotas de vagas 
│   ├── autenticacao.js        # Rotas de auth
│   ├── desafios.js            # Rotas de desafios
│   ├── pagamentos.js          # Rotas de pagamentos
│   ├── telas.js               # Rotas de telas
│   └── usuario.js             # Rotas de usuários
├── middlewares/
│   └── verificarAutenticacao.js # Middleware de auth
├── database/
│   └── setup.js               # Setup do banco
└── package.json               # Dependências
```

---

##  Autenticação

### Como Funciona

A autenticação é feita via **headers HTTP**:

```
id-usuario: usuario123        # ID único do usuário
tipo-usuario: empresa         # Tipo: "empresa" ou "candidato"
```

### Exemplo de Cabeçalho

```bash
# Para empresas
curl -H "id-usuario: empresa123" \
     -H "tipo-usuario: empresa"

# Para candidatos
curl -H "id-usuario: candidato456" \
     -H "tipo-usuario: candidato"
```

---

##  Endpoints Principais

### 1️ VAGAS (Sistema Principal ⭐)

#### **GET** `/api/vagas` - Listar Vagas
Retorna lista de vagas ativas com filtros opcionais.

**Parâmetros de Query (Filtros):**
- `remoto` (true/false) - Vagas remotas ou presenciais
- `linguagem` (string) - Busca por tecnologia (ex: JavaScript)
- `tipo` (string) - Tipo de contrato (CLT, PJ, Estágio, Freelancer)
- `titulo` (string) - Busca parcial no título
- `localizacao` (string) - Busca por localização
- `empresa_id` (string) - Filtrar por empresa específica
- `page` (número) - Página (padrão: 1)
- `limit` (número) - Itens por página (padrão: 10, máx: 100)

**Exemplo:**
```bash
# Vagas remotas com JavaScript
curl "http://localhost:3000/api/vagas?remoto=true&linguagem=JavaScript"

# Vagas PJ em São Paulo, página 2
curl "http://localhost:3000/api/vagas?tipo=PJ&localizacao=SP&page=2&limit=5"
```

**Resposta Sucesso (200):**
```json
{
  "total": 15,
  "page": 1,
  "limit": 10,
  "totalPages": 2,
  "vagas": [
    {
      "id": 1,
      "titulo": "Dev Node.js",
      "descricao": "Vaga para desenvolvedor backend",
      "empresa_id": "empresa123",
      "empresa_nome": "Tech Corp",
      "linguagens": "JavaScript,Node.js,Express",
      "remoto": 1,
      "tipo": "CLT",
      "remuneracao": "R$ 6000",
      "localizacao": "São Paulo",
      "status": "ativa",
      "bolsa_tecnica": 1000,
      "created_at": "2026-04-11 20:37:04"
    }
  ]
}
```

---

#### **POST** `/api/vagas` - Criar Vaga
Cria uma nova vaga de emprego. **Requer autenticação como empresa.**

**Headers Obrigatórios:**
```
Content-Type: application/json
id-usuario: empresa123
tipo-usuario: empresa
```

**Body (JSON):**
```json
{
  "empresa_id": "empresa123",                      // Obrigatório
  "titulo": "Desenvolvedor React",                // Obrigatório
  "descricao": "Vaga para desenvolvedor frontend",
  "requisitos": "React, JavaScript, CSS, HTML",
  "remuneracao": "R$ 5000 - R$ 7000",
  "localizacao": "Rio de Janeiro",
  "tipo": "CLT",                                  // CLT, PJ, Estágio, Freelancer
  "bolsa_tecnica": 500,                           // Valor em reais
  "remoto": true,                                 // true/false/null
  "linguagens": "JavaScript,React,TypeScript"    // Compatível com filtros
}
```

**Exemplo:**
```bash
curl -X POST http://localhost:3000/api/vagas \
  -H "Content-Type: application/json" \
  -H "id-usuario: empresa123" \
  -H "tipo-usuario: empresa" \
  -d '{
    "empresa_id": "empresa123",
    "titulo": "Dev React Senior",
    "descricao": "Vaga remota",
    "linguagens": "React,JavaScript,Node.js",
    "remoto": true,
    "tipo": "CLT",
    "remuneracao": "R$ 8000"
  }'
```

**Resposta Sucesso (201):**
```json
{
  "id": 42,
  "empresa_id": "empresa123",
  "titulo": "Dev React Senior",
  "descricao": "Vaga remota",
  "linguagens": "React,JavaScript,Node.js",
  "remoto": 1,
  "tipo": "CLT",
  "remuneracao": "R$ 8000",
  "status": "ativa",
  "created_at": "2026-04-11 21:15:30",
  "updated_at": "2026-04-11 21:15:30"
}
```

**Erros:**
```json
// 401 - Sem autenticação
{"sucesso": false, "mensagem": "Usuário não autenticado"}

// 403 - Não é empresa
{"erro": "Apenas empresas podem criar/editar vagas"}

// 400 - Campo obrigatório faltando
{"erro": "Título é obrigatório"}
```

---

#### **PUT** `/api/vagas/:id` - Atualizar Vaga
Atualiza uma vaga existente. **Requer autenticação como empresa.**

**Parâmetro de URL:**
- `id` (número) - ID da vaga a atualizar

**Headers:**
```
Content-Type: application/json
id-usuario: empresa123
tipo-usuario: empresa
```

**Body (todos opcionais):**
```json
{
  "titulo": "Dev React Master",
  "remuneracao": "R$ 10000",
  "linguagens": "React,JavaScript,Node.js,TypeScript",
  "remoto": false
}
```

**Exemplo:**
```bash
curl -X PUT http://localhost:3000/api/vagas/42 \
  -H "Content-Type: application/json" \
  -H "id-usuario: empresa123" \
  -H "tipo-usuario: empresa" \
  -d '{"titulo": "Dev React Pleno", "remuneracao": "R$ 9000"}'
```

**Resposta Sucesso (200):**
```json
{
  "id": 42,
  "titulo": "Dev React Pleno",
  "remuneracao": "R$ 9000",
  ...
}
```

---

#### **DELETE** `/api/vagas/:id` - Deletar Vaga
Deleta uma vaga (soft delete - muda status para inativa). **Requer autenticação como empresa.**

**Headers:**
```
id-usuario: empresa123
tipo-usuario: empresa
```

**Exemplo:**
```bash
curl -X DELETE http://localhost:3000/api/vagas/42 \
  -H "id-usuario: empresa123" \
  -H "tipo-usuario: empresa"
```

**Resposta Sucesso (200):**
```json
{"mensagem": "Vaga excluída com sucesso"}
```

---

##  Banco de Dados

### Tabela: `vagas`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | INTEGER | ID único (PK) |
| `empresa_id` | TEXT | ID da empresa que criou |
| `titulo` | TEXT | Título da vaga |
| `descricao` | TEXT | Descrição detalhada |
| `requisitos` | TEXT | Requisitos técnicos |
| `remuneracao` | TEXT | Faixa salarial |
| `localizacao` | TEXT | Local de trabalho |
| `tipo` | TEXT | CLT, PJ, Estágio, Freelancer |
| `remoto` | INTEGER | 1=sim, 0=não, NULL=ambos |
| `linguagens` | TEXT | Tecnologias (ex: "JavaScript,Node.js") |
| `status` | TEXT | "ativa" ou "inativa" |
| `bolsa_tecnica` | REAL | Valor extra em reais |
| `created_at` | DATETIME | Data de criação |
| `updated_at` | DATETIME | Última atualização |

---

##  Sistema de Filtros

### Filtros Disponíveis

| Filtro | Tipo | Descrição | Exemplo |
|--------|------|-----------|---------|
| `remoto` | boolean | Vagas remotas | `?remoto=true` |
| `linguagem` | string | Busca por tecnologia | `?linguagem=Python` |
| `tipo` | string | Tipo de contrato | `?tipo=PJ` |
| `titulo` | string | Busca no título | `?titulo=dev` |
| `localizacao` | string | Busca por local | `?localizacao=SP` |
| `empresa_id` | string | Filtrar por empresa | `?empresa_id=emp123` |
| `page` | número | Página | `?page=2` |
| `limit` | número | Itens por página | `?limit=20` |

### Combinando Filtros

```bash
# Vagas remotas, Python, PJ e na página 1 (5 por página)
curl "http://localhost:3000/api/vagas?remoto=true&linguagem=Python&tipo=PJ&page=1&limit=5"
```

---

##  Proteção de Rotas

### Rotas Públicas (sem autenticação)
- `GET /api/vagas` - Listar vagas

### Rotas Protegidas (apenas empresa autenticada)
- `POST /api/vagas` - Criar vaga
- `PUT /api/vagas/:id` - Atualizar vaga
- `DELETE /api/vagas/:id` - Deletar vaga

### Erros de Autenticação

```json
// 401 - Não autenticado
{"sucesso": false, "mensagem": "Usuário não autenticado"}

// 403 - Não autorizado (não é empresa)
{"erro": "Apenas empresas podem criar/editar vagas"}
```

---

##  Migrações do Banco

O sistema executa automaticamente as seguintes migrações ao iniciar:

```sql
-- Campos de vagas
ALTER TABLE vagas ADD COLUMN remoto INTEGER;
ALTER TABLE vagas ADD COLUMN linguagens TEXT;

-- Perfil técnico de candidatos
ALTER TABLE candidatos ADD COLUMN github_url TEXT;
ALTER TABLE candidatos ADD COLUMN linkedin_url TEXT;
ALTER TABLE candidatos ADD COLUMN skills TEXT;
ALTER TABLE candidatos ADD COLUMN anos_experiencia INTEGER DEFAULT 0;
ALTER TABLE candidatos ADD COLUMN bio TEXT;
ALTER TABLE candidatos ADD COLUMN verificado INTEGER DEFAULT 0;

-- Configurações
ALTER TABLE candidatos ADD COLUMN configuracoes TEXT DEFAULT '{}';
ALTER TABLE empresas ADD COLUMN configuracoes TEXT DEFAULT '{}';

-- Desafios
ALTER TABLE candidaturas_desafio ADD COLUMN solucao_url TEXT;
ALTER TABLE candidaturas_desafio ADD COLUMN solucao_descricao TEXT;
ALTER TABLE candidaturas_desafio ADD COLUMN canal_liberado INTEGER DEFAULT 0;
```

---

##  Tipos de Contrato (Vaga vs Trabalho à Parte)

| Tipo | Categoria | Descrição |
|------|-----------|-----------|
| **CLT** | Vaga | Emprego permanente com benefícios |
| **Estágio** | Vaga | Vaga para estudante/estagiário |
| **PJ** | Trabalho à Parte | Contratação como pessoa jurídica |
| **Freelancer** | Trabalho à Parte | Trabalho pontual/projeto |

---

##  Testes Rápidos

### 1. Listar vagas (público)
```bash
curl http://localhost:3000/api/vagas
```

### 2. Criar vaga como empresa
```bash
curl -X POST http://localhost:3000/api/vagas \
  -H "Content-Type: application/json" \
  -H "id-usuario: empresa123" \
  -H "tipo-usuario: empresa" \
  -d '{"empresa_id":"empresa123","titulo":"Dev Node","descricao":"Backend","linguagens":"JavaScript,Node.js","remoto":true,"tipo":"CLT","remuneracao":"R$ 6000"}'
```

### 3. Tentar criar como candidato (deve falhar)
```bash
curl -X POST http://localhost:3000/api/vagas \
  -H "Content-Type: application/json" \
  -H "id-usuario: candidato123" \
  -H "tipo-usuario: candidato" \
  -d '{"empresa_id":"emp","titulo":"Teste"}'
```

### 4. Filtrar vagas remotas
```bash
curl "http://localhost:3000/api/vagas?remoto=true"
```

### 5. Filtrar vagas com JavaScript
```bash
curl "http://localhost:3000/api/vagas?linguagem=JavaScript"
```

---

##  Configuração Avançada

### Variáveis de Ambiente (.env)

```
PORT=3000                 # Porta do servidor
NODE_ENV=development      # Ambiente (development/production)
```

---

##  Troubleshooting

### Erro: "EADDRINUSE: address already in use :::3000"
A porta 3000 já está em uso. Mate o processo:
```bash
killall -9 node
# Ou especifique outra porta
PORT=3001 npm run dev
```

### Erro: "Cannot find module 'express'"
Reinstale dependências:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Banco de dados não inicializa
Verifique pode escrever em `backend/banco/trivio.db`:
```bash
ls -la backend/banco/
```

---

## Próximas Melhorias

- [ ] Validação com Joi
- [ ] Rate limiting
- [ ] Cache de vagas
- [ ] Busca full-text
- [ ] Notificações em tempo real
- [ ] Upload de documentos

---

##  Desenvolvido com

- **Node.js** - Runtime
- **Express.js** - Framework web
- **SQLite** - Banco de dados
- **Better-sqlite3** - Driver SQLite
- **Bcrypt** - Hash de senhas
- **Cors** - Cross-origin requests
- **Morgan** - Logger HTTP

---

##  Suport
Para dúvidas ou bugs, abra uma issue no repositório.

---

**Última atualização:** 11 de abril de 2026
