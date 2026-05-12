# Trivio — Backend

API REST em Node.js + Express + SQLite para a plataforma Trivio, que conecta empresas a candidatos técnicos via desafios de código.

---

## Stack

- **Runtime**: Node.js
- **Framework**: Express
- **Banco de dados**: SQLite via `better-sqlite3`
- **Autenticação**: JWT (`jsonwebtoken`) + bcrypt
- **Pagamentos**: Pagar.me API v5
- **Upload de imagens**: Cloudinary
- **Análise de código**: Analisador estático próprio (`/analyzer`)

---

## Estrutura de pastas

```
backend/
├── servidor.js                  Ponto de entrada da aplicação
├── userController.js            CRUD de usuários genéricos
├── userRoutes.js                Rotas de usuários e vagas (legado)
│
├── banco/
│   └── conexao.js               Conexão SQLite e criação de tabelas base
│
├── database/
│   └── setup.js                 Inicialização e migrations
│
├── controllers/
│   ├── authController.js        Cadastro e login (candidato/empresa)
│   ├── desafioController.js     CRUD de desafios, candidaturas, canal privado
│   ├── pagamentoController.js   Integração Pagar.me, webhooks, métricas
│   ├── submissaoController.js   Envio e análise de código dos candidatos
│   ├── vagaController.js        CRUD de vagas com cobrança automática
│   └── vagasController.js       CRUD de vagas simplificado (sem cobrança)
│
├── rotas/
│   ├── auth.js                  POST /api/v1/auth/cadastro|login
│   ├── desafios.js              CRUD + candidaturas + canal
│   ├── pagamentos.js            Webhook + listagem + métricas
│   ├── submissoes.js            Envio e revisão de código
│   ├── vagas.js                 CRUD básico de vagas
│   └── analyze.js               POST /api/v1/analyze
│
├── middlewares/
│   └── verificarAutenticacao.js Verifica header `id-usuario`
│
├── services/
│   └── analyzeCodeService.js    Orquestra os módulos de análise
│
└── analyzer/
    ├── parser.js                Parse AST (Babel)
    ├── bugs.js                  Detecção de bugs
    ├── quality.js               Qualidade de código
    ├── security.js              Vulnerabilidades
    ├── performance.js           Gargalos de performance
    ├── style.js                 Estilo e consistência
    ├── testability.js           Testabilidade
    ├── score.js                 Cálculo do score final
    └── suggestions.js           Geração de sugestões
```

---

## Rotas da API

### Autenticação — `/api/v1/auth`

| Método | Rota        | Descrição                                |
|--------|-------------|------------------------------------------|
| POST   | `/cadastro` | Cria conta de candidato ou empresa       |
| POST   | `/login`    | Autentica e retorna JWT + dados do usuário |

**Body de cadastro:**
```json
{
  "tipo": "empresa",
  "nome": "Acme Corp",
  "email": "rh@acme.com",
  "senha": "minimo6",
  "cnpj": "00.000.000/0001-00"
}
```

**Resposta de login:**
```json
{
  "token": "eyJ...",
  "usuario": {
    "public_id": "abc123",
    "nome": "Acme Corp",
    "email": "rh@acme.com",
    "tipo": "empresa"
  }
}
```

---

### Desafios — `/api/v1/desafios`

| Método | Rota                                      | Descrição                              |
|--------|-------------------------------------------|----------------------------------------|
| GET    | `/`                                       | Lista desafios ativos (filtros: empresa_id, stack, nivel) |
| GET    | `/:id`                                    | Detalhe de um desafio                  |
| POST   | `/`                                       | Empresa cria desafio                   |
| PUT    | `/:id`                                    | Atualiza desafio                       |
| DELETE | `/:id`                                    | Encerra desafio (soft delete)          |
| POST   | `/:id/candidatar`                         | Candidato aceita o desafio             |
| GET    | `/:id/candidaturas`                       | Empresa lista candidatos do desafio    |
| POST   | `/:id/candidatos/:candidato_id/avancar`   | Avança candidato para entrevista       |
| GET    | `/meus/:candidato_id`                     | Candidato lista seus desafios          |

---

### Submissões — `/api/v1/submissoes`

Requer header `id-usuario` em todas as rotas.

| Método | Rota                      | Descrição                                     |
|--------|---------------------------|-----------------------------------------------|
| POST   | `/`                       | Candidato envia código (análise automática)   |
| GET    | `/usuario`                | Candidato lista suas submissões               |
| GET    | `/desafio/:desafio_id`    | Empresa lista submissões de um desafio        |
| GET    | `/:id`                    | Detalhe de uma submissão                      |
| GET    | `/:id/analise`            | Relatório completo de análise de IA           |
| PATCH  | `/:id/status`             | Empresa aprova/rejeita submissão              |

---

### Pagamentos — `/api/v1/pagamentos`

| Método | Rota                        | Descrição                                     |
|--------|-----------------------------|-----------------------------------------------|
| POST   | `/webhook`                  | Recebe eventos do Pagar.me (HMAC verificado)  |
| GET    | `/`                         | Lista pagamentos da empresa (`?empresa_id=`)  |
| GET    | `/metricas`                 | Métricas gerais da empresa                    |
| GET    | `/vaga/:vaga_id/metricas`   | Métricas de uma vaga específica               |
| GET    | `/:pagamento_id/link`       | Retorna ou gera link de checkout              |

---

### Análise de código — `/api/v1/analyze`

| Método | Rota       | Descrição                                          |
|--------|------------|----------------------------------------------------|
| POST   | `/analyze` | Analisa código JS/TS e retorna score + relatório   |

**Body:**
```json
{ "code": "function soma(a, b) { return a + b; }", "language": "javascript" }
```

---

## Banco de dados

O SQLite (`banco/trivio.db`) é criado automaticamente na primeira execução. Tabelas principais:

| Tabela                   | Descrição                                      |
|--------------------------|------------------------------------------------|
| `candidatos`             | Usuários candidatos                            |
| `empresas`               | Usuários empresas                              |
| `vagas`                  | Vagas de emprego publicadas                    |
| `desafios`               | Desafios técnicos vinculados a vagas           |
| `candidaturas_desafio`   | Candidatos x desafios + código + score IA      |
| `mensagens_canal`        | Canal privado pós-aprovação                    |
| `pagamentos`             | Taxas de plataforma e bolsas técnicas          |
| `metricas_empresa`       | Métricas do funil por empresa                  |
| `historico_atividades`   | Log de ações do sistema                        |

---

## Fluxo de pagamento (Pagar.me)

1. Empresa cria uma vaga → `criarTaxaPlataforma()` é chamado automaticamente
2. Uma ordem é criada na API do Pagar.me e o link de checkout é salvo no banco
3. Empresa acessa o link e paga (cartão, boleto ou Pix)
4. Pagar.me chama `POST /api/v1/pagamentos/webhook` com o evento
5. O webhook verifica a assinatura HMAC-SHA256 e atualiza o status no banco

Configure o endpoint no dashboard do Pagar.me: `https://seu-dominio.com/api/v1/pagamentos/webhook`

---

## Autenticação

O middleware `verificarAutenticacao` exige o header `id-usuario` com o `public_id` do usuário. O sistema **ainda não usa o JWT nas rotas protegidas** — o token é gerado no login mas não é validado nos endpoints. Isso é um débito técnico a resolver.

---

## Como rodar

```bash
cd backend
cp .env.example .env
# preencha o .env
npm install
node servidor.js
```

Servidor sobe em `http://localhost:3001` por padrão.

---

## Observações importantes

- `vagaController.js` e `vagasController.js` são **duplicatas** com comportamentos ligeiramente diferentes. O `vagaController.js` dispara cobrança ao criar vaga; o `vagasController.js` não. A unificação está pendente.
- A análise de IA em `desafioController.js` (`avaliarComIA`) é **simulada** com scores aleatórios. A análise real usa o `analyzeCodeService.js` via `submissaoController.js`.
- Migrações são aplicadas via `ALTER TABLE IF NOT EXISTS` (safe), então rodar com banco existente não quebra nada.
