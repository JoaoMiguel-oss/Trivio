# INVENTÁRIO TÉCNICO — TRIVIO BACKEND
> Gerado em: 2026-05-22 | Stack: Node.js + Express + SQLite (better-sqlite3)
> **Leitura pura. Nenhum arquivo foi modificado.**

---

## 1. ENDPOINTS

### BASE URL
```
http://localhost:3001/api/v1
```

### Montagem de rotas em servidor.js
| Prefixo montado       | Arquivo de rotas            | Notas                          |
|-----------------------|-----------------------------|--------------------------------|
| `/api/v1`             | `userRoutes.js`             | Usuários, upload, vagas        |
| `/api/v1/auth`        | `rotas/auth.js`             | Login e cadastro               |
| `/api/v1/desafios`    | `rotas/desafios.js`         |                                |
| `/api/v1/pagamentos`  | `rotas/pagamentos.js`       |                                |
| `/api/v1/vagas`       | `rotas/vagas.js`            | ⚠️ SHADOWED por userRoutes     |
| `/api/v1/submissoes`  | `rotas/submissoes.js`       |                                |
| `/api/v1`             | `rotas/analyze.js`          |                                |
| `/api/v1`             | `rotas/casos_teste.js`      |                                |
| —                     | `rotas/telas.js`            | ❌ NÃO registrado em servidor.js |

---

### AUTH — `/api/v1/auth`
| # | Método | Rota          | Middleware | Controller                          |
|---|--------|---------------|------------|-------------------------------------|
| 1 | POST   | `/cadastro`   | —          | `authController.cadastrar`          |
| 2 | POST   | `/login`      | —          | `authController.login`              |
| 3 | GET    | `/remembered` | —          | `authController.obterUsuarioLembrado` |

**POST /cadastro**
- Body: `{ tipo: "candidato"|"empresa", nome, email, senha, cnpj? }`
- Response 201: `{ mensagem, usuario: { public_id, nome, email, tipo } }`
- Response 400: campo faltando | tipo inválido | senha < 6 chars | cnpj ausente (empresa)
- Response 409: email ou cnpj duplicado
- Response 500: erro interno
- Side effect: cria cookie `remember_key` (HttpOnly, 1 ano)

**POST /login**
- Body: `{ tipo, email, senha }`
- Response 200: `{ mensagem, token (JWT 24h), usuario: { public_id, nome, email, foto_url, tipo, configuracoes } }`
- Response 400: campos faltando
- Response 401: credenciais inválidas
- Side effect: atualiza/cria cookie `remember_key`

**GET /remembered**
- Lê cookie `remember_key`
- Response 200: `{ data: { email, tipo } | null }`

---

### USUÁRIOS — `/api/v1` (userRoutes.js)
| # | Método | Rota                          | Middleware              | Controller                              |
|---|--------|-------------------------------|-------------------------|-----------------------------------------|
| 4 | POST   | `/users`                      | multer (imagem)         | `userController.criarUsuario`           |
| 5 | POST   | `/upload`                     | multer (arquivo)        | `userController.uploadImagemAvulsa`     |
| 6 | PUT    | `/user/:tipo/:id/foto`        | multer (imagem)         | `userController.atualizarFotoPerfil`    |
| 7 | GET    | `/user/:tipo/:id/configuracoes` | —                     | `userController.getConfiguracoes`       |
| 8 | PUT    | `/user/:tipo/:id/configuracoes` | —                     | `userController.atualizarConfiguracoes` |
| 9 | GET    | `/verificar/:id`              | `verificarAutenticacao` | inline (query em `usuarios`)            |

> ⚠️ **BUG CRÍTICO:** rota `/verificar/:id` faz query em tabela `usuarios` que NÃO EXISTE.
> Qualquer chamada resulta em erro 500.

**POST /users**
- Content-Type: `multipart/form-data`
- Fields: `nome, email, senha`, file: `imagem` (opcional)
- Response 201: `{ public_id, nome, email, photo_url }`
- ⚠️ Usa tabela `users` (não `candidatos`). Tabela `users` não existe no schema atual → erro 500.

---

### VAGAS — Duplicidade crítica
> **PROBLEMA:** `userRoutes.js` (montado em `/api/v1`) define GET/POST/PUT/DELETE `/vagas` usando `vagaController`.
> `rotas/vagas.js` (montado em `/api/v1/vagas`) define os mesmos métodos usando `vagasController`.
> Como `userRoutes` é registrado **antes** de `vagasRoutes` em `servidor.js`, e ambos respondem sem chamar `next()`,
> **`vagasController` está completamente inacessível em produção.**

| # | Método | Rota         | Controller ativo em produção    | Controller inacessível   |
|---|--------|--------------|---------------------------------|--------------------------|
| 10| GET    | `/vagas`     | `vagaController.listarVagas`   | `vagasController.listarVagas`  |
| 11| POST   | `/vagas`     | `vagaController.criarVaga`     | `vagasController.criarVaga`    |
| 12| PUT    | `/vagas/:id` | `vagaController.atualizarVaga` | `vagasController.atualizarVaga`|
| 13| DELETE | `/vagas/:id` | `vagaController.excluirVaga`   | `vagasController.excluirVaga`  |

**Diferença comportamental relevante:**
- `vagaController.excluirVaga` → soft delete (status = 'inativa')
- `vagasController.excluirVaga` → hard delete + limpa FK em desafios/pagamentos/metricas

---

### DESAFIOS — `/api/v1/desafios`
| # | Método | Rota                              | Middleware | Controller                             |
|---|--------|-----------------------------------|------------|----------------------------------------|
| 14| GET    | `/`                               | —          | `desafioController.listarDesafios`     |
| 15| GET    | `/:id`                            | —          | `desafioController.obterDesafio`       |
| 16| POST   | `/`                               | —          | `desafioController.criarDesafio`       |
| 17| PUT    | `/:id`                            | —          | `desafioController.atualizarDesafio`   |
| 18| DELETE | `/:id`                            | —          | `desafioController.excluirDesafio`     |
| 19| POST   | `/:id/candidatar`                 | —          | `desafioController.candidatarDesafio`  |
| 20| GET    | `/:id/candidaturas`               | —          | `desafioController.listarCandidaturas` |
| 21| GET    | `/meus/:candidato_id`             | —          | `desafioController.meusDesafios`       |

> ⚠️ **BUG DE ROTEAMENTO:** `GET /meus/:candidato_id` é registrado APÓS `GET /:id`.
> Express tenta `/:id` primeiro → `/meus/abc` resolve com `id = "meus"`.
> `meusDesafios` nunca é alcançado. Bug em produção.

**Funções exportadas mas SEM ROTA (código morto):**
- `entregarSolucao` (deveria ser POST `/:id/entregar`)
- `avancarParaEntrevista`
- `listarMensagens`
- `enviarMensagem`
- `atualizarPerfilTecnico`
- `obterPerfilTecnico`

**GET /desafios** — Query params: `empresa_id`, `stack`, `nivel`
- Response 200: array de desafios com `empresa_nome`, `vaga_titulo`

**POST /desafios**
- Body: `{ empresa_id*, titulo*, descricao*, stack*, vaga_id?, nivel?, tempo_limite_h?, bolsa_tecnica?, instrucoes?, criterios? }`
- Response 201: desafio criado

**POST /desafios/:id/candidatar**
- Body: `{ candidato_id* }`
- Response 201: `{ mensagem, candidatura_id, desafio: { titulo, stack, tempo_limite_h, bolsa_tecnica } }`
- Response 409: já candidatado | já tem desafio para esta vaga

---

### SUBMISSÕES — `/api/v1/submissoes`
| # | Método | Rota                    | Middleware              | Controller                                |
|---|--------|-------------------------|-------------------------|-------------------------------------------|
| 22| POST   | `/`                     | `verificarAutenticacao` | `submissaoController.criarSubmissao`      |
| 23| GET    | `/usuario`              | `verificarAutenticacao` | `submissaoController.listarSubmissoesUsuario` |
| 24| GET    | `/desafio/:desafio_id`  | `verificarAutenticacao` | `submissaoController.listarSubmissoesDesafio` |
| 25| PATCH  | `/:id/status`           | `verificarAutenticacao` | `submissaoController.atualizarStatus`     |
| 26| GET    | `/:id`                  | `verificarAutenticacao` | `submissaoController.obterSubmissao`      |

**POST /submissoes**
- Header: `Authorization: Bearer <token>` ou `id-usuario: <candidato_id>` (legado)
- Body: `{ desafio_id*, candidato_id*, codigo*, linguagem*, mensagem?, solucao_url? }`
- Response 201: `{ sucesso: true, submissao: {...} }`
- Side effect: dispara `corrigirSubmissao()` em background (fire-and-forget)

**PATCH /submissoes/:id/status**
- Body: `{ status: "aprovado"|"rejeitado"|"em_revisao", feedback? }`
- Header: `id-usuario` (empresa_id)
- Valida que o desafio pertence à empresa

---

### PAGAMENTOS — `/api/v1/pagamentos`
| # | Método | Rota                       | Middleware       | Controller                             |
|---|--------|----------------------------|------------------|----------------------------------------|
| 27| POST   | `/webhook`                 | express.raw()    | `pagamentoController.receberWebhook`   |
| 28| GET    | `/`                        | —                | `pagamentoController.listarPagamentos` |
| 29| GET    | `/metricas`                | —                | `pagamentoController.obterMetricas`    |
| 30| GET    | `/vaga/:vaga_id/metricas`  | —                | `pagamentoController.obterMetricasVaga`|
| 31| GET    | `/:pagamento_id/link`      | —                | `pagamentoController.obterLinkPagamento`|

> ⚠️ Endpoints de pagamento não têm `verificarAutenticacao`. Qualquer request não autenticado pode listar pagamentos passando `?empresa_id=`.

---

### ANÁLISE DE CÓDIGO — `/api/v1/analyze`
| # | Método | Rota       | Middleware | Controller        |
|---|--------|------------|------------|-------------------|
| 32| POST   | `/analyze` | —          | inline (async)    |

- Body: `{ code: string, language?: "javascript" }`
- Limite: 100KB
- Response 200: `{ success, meta, overallScore, grade, summary, scoreBreakdown, quality, bugs, security, performance, style, testability, suggestions, topSuggestions }`
- Response 400/413/422/500

---

### CASOS DE TESTE — `/api/v1/desafios/:id/casos-teste`
| # | Método | Rota                              | Middleware | Controller                              |
|---|--------|-----------------------------------|------------|-----------------------------------------|
| 33| POST   | `/desafios/:id/casos-teste`       | —          | `casosTesteController.criarCasoTeste`   |
| 34| GET    | `/desafios/:id/casos-teste`       | —          | `casosTesteController.listarCasosTeste` |
| 35| PUT    | `/desafios/:id/casos-teste/:caso_id` | —       | `casosTesteController.atualizarCasoTeste`|
| 36| DELETE | `/desafios/:id/casos-teste/:caso_id` | —       | `casosTesteController.deletarCasoTeste` |

- Valida `id-usuario` (empresa_id) contra `desafios.empresa_id`
- ⚠️ Sem `verificarAutenticacao` — usa apenas header `id-usuario`

---

## 2. BANCO DE DADOS

### Tabela: `candidatos`
| Coluna           | Tipo     | Default            | Constraint     |
|------------------|----------|--------------------|----------------|
| id               | INTEGER  | AUTOINCREMENT      | PK             |
| public_id        | TEXT     | —                  | UNIQUE NOT NULL|
| nome             | TEXT     | —                  | NOT NULL       |
| email            | TEXT     | —                  | UNIQUE NOT NULL|
| senha_hash       | TEXT     | —                  | NOT NULL       |
| foto_url         | TEXT     | NULL               |                |
| github_url       | TEXT     | NULL               | (migration)    |
| linkedin_url     | TEXT     | NULL               | (migration)    |
| skills           | TEXT     | NULL               | (migration)    |
| anos_experiencia | INTEGER  | 0                  | (migration)    |
| bio              | TEXT     | NULL               | (migration)    |
| verificado       | INTEGER  | 0                  | (migration)    |
| configuracoes    | TEXT     | '{}'               | (migration)    |
| criado_em        | DATETIME | CURRENT_TIMESTAMP  |                |

### Tabela: `empresas`
| Coluna        | Tipo     | Default           | Constraint      |
|---------------|----------|-------------------|-----------------|
| id            | INTEGER  | AUTOINCREMENT     | PK              |
| public_id     | TEXT     | —                 | UNIQUE NOT NULL |
| nome          | TEXT     | —                 | NOT NULL        |
| cnpj          | TEXT     | NULL              | UNIQUE          |
| email         | TEXT     | —                 | UNIQUE NOT NULL |
| senha_hash    | TEXT     | —                 | NOT NULL        |
| logo_url      | TEXT     | NULL              |                 |
| configuracoes | TEXT     | '{}'              | (migration)     |
| criado_em     | DATETIME | CURRENT_TIMESTAMP |                 |

### Tabela: `desafios`
| Coluna        | Tipo     | Default           | Constraint  |
|---------------|----------|-------------------|-------------|
| id            | INTEGER  | AUTOINCREMENT     | PK          |
| empresa_id    | TEXT     | —                 | NOT NULL    |
| vaga_id       | INTEGER  | NULL              |             |
| titulo        | TEXT     | —                 | NOT NULL    |
| descricao     | TEXT     | —                 | NOT NULL    |
| stack         | TEXT     | —                 | NOT NULL    |
| nivel         | TEXT     | 'junior'          |             |
| tempo_limite_h| INTEGER  | 4                 |             |
| bolsa_tecnica | REAL     | 0                 |             |
| status        | TEXT     | 'ativo'           |             |
| instrucoes    | TEXT     | NULL              |             |
| criterios     | TEXT     | NULL              |             |
| criado_em     | DATETIME | CURRENT_TIMESTAMP |             |

> FK lógica: `empresa_id → empresas.public_id`, `vaga_id → vagas.id` (sem FK declarada no SQLite)

### Tabela: `candidaturas_desafio`
| Coluna              | Tipo     | Default           | Constraint                         |
|---------------------|----------|-------------------|------------------------------------|
| id                  | INTEGER  | AUTOINCREMENT     | PK                                 |
| desafio_id          | INTEGER  | —                 | NOT NULL                           |
| candidato_id        | TEXT     | —                 | NOT NULL                           |
| status              | TEXT     | 'em_andamento'    |                                    |
| iniciado_em         | DATETIME | CURRENT_TIMESTAMP |                                    |
| entregue_em         | DATETIME | NULL              |                                    |
| solucao_url         | TEXT     | NULL              | (migration)                        |
| solucao_descricao   | TEXT     | NULL              | (migration)                        |
| score_ia            | REAL     | NULL              |                                    |
| relatorio_ia        | TEXT     | NULL              |                                    |
| avancou_entrevista  | INTEGER  | 0                 |                                    |
| canal_liberado      | INTEGER  | 0                 | (migration)                        |
| codigo              | TEXT     | NULL              | (migration)                        |
| linguagem           | TEXT     | NULL              | (migration)                        |
| mensagem_candidato  | TEXT     | NULL              | (migration)                        |
| feedback_empresa    | TEXT     | NULL              | (migration)                        |
| testes_passados     | INTEGER  | 0                 | (migration — novo)                 |
| total_testes        | INTEGER  | 0                 | (migration — novo)                 |
| resultado_execucao  | TEXT     | NULL              | (migration — novo, JSON)           |
|                     |          |                   | UNIQUE(desafio_id, candidato_id)   |

### Tabela: `casos_teste` (nova)
| Coluna          | Tipo     | Default           | Constraint  |
|-----------------|----------|-------------------|-------------|
| id              | INTEGER  | AUTOINCREMENT     | PK          |
| desafio_id      | INTEGER  | —                 | NOT NULL    |
| input           | TEXT     | NULL              |             |
| output_esperado | TEXT     | —                 | NOT NULL    |
| peso            | INTEGER  | 1                 |             |
| descricao       | TEXT     | NULL              |             |
| criado_em       | DATETIME | CURRENT_TIMESTAMP |             |

### Tabela: `vagas`
| Coluna        | Tipo     | Default           | Constraint  |
|---------------|----------|-------------------|-------------|
| id            | INTEGER  | AUTOINCREMENT     | PK          |
| empresa_id    | TEXT     | NULL              |             |
| titulo        | TEXT     | —                 | NOT NULL    |
| descricao     | TEXT     | NULL              |             |
| requisitos    | TEXT     | NULL              |             |
| remuneracao   | TEXT     | NULL              |             |
| localizacao   | TEXT     | NULL              |             |
| tipo          | TEXT     | 'CLT'             |             |
| status        | TEXT     | 'ativa'           |             |
| bolsa_tecnica | REAL     | 0                 | (migration) |
| created_at    | DATETIME | CURRENT_TIMESTAMP |             |
| updated_at    | DATETIME | CURRENT_TIMESTAMP |             |

### Tabela: `pagamentos`
| Coluna           | Tipo     | Default           | Constraint  |
|------------------|----------|-------------------|-------------|
| id               | INTEGER  | AUTOINCREMENT     | PK          |
| empresa_id       | TEXT     | —                 | NOT NULL    |
| vaga_id          | INTEGER  | NULL              |             |
| tipo             | TEXT     | —                 | NOT NULL    |
| valor            | REAL     | —                 | NOT NULL    |
| status           | TEXT     | 'pendente'        |             |
| descricao        | TEXT     | NULL              |             |
| created_at       | DATETIME | CURRENT_TIMESTAMP |             |
| paid_at          | DATETIME | NULL              |             |
| pagarme_order_id | TEXT     | NULL              | (migration) |
| checkout_url     | TEXT     | NULL              | (migration) |

Índice: `idx_pagamentos_pagarme_order_id ON pagamentos(pagarme_order_id)`

### Tabelas auxiliares
| Tabela                | Colunas principais                                              |
|-----------------------|-----------------------------------------------------------------|
| `mensagens_canal`     | id, desafio_id, candidato_id, remetente_tipo, remetente_id, texto, lida, enviada_em |
| `metricas_empresa`    | id, empresa_id, vaga_id, candidatos_total, desafios_iniciados, desafios_entregues, entrevistas_agendadas, tempo_medio_shortlist_minutos |
| `historico_atividades`| id, entidade_tipo, entidade_id, acao, detalhes, usuario_id, created_at |
| `remembered_users`    | id, remember_key (UNIQUE), email, tipo, created_at, updated_at |

> ⚠️ **Tabela `users` NÃO existe** — referenciada em `userController.criarUsuario` e `rotas/usuario.js`.

---

## 3. FLUXOS CRÍTICOS

### Fluxo 1 — Cadastro e Login
```
POST /auth/cadastro
  → valida tipo/email/cnpj
  → bcrypt.hash(senha, 10)
  → INSERT candidatos|empresas
  → salvarUsuarioLembrado (remembered_users)
  → Set-Cookie remember_key

POST /auth/login
  → SELECT candidatos|empresas WHERE email
  → bcrypt.compare(senha, hash)
  → jwt.sign({ public_id, tipo, email }, JWT_SECRET, 24h)
  → resposta com token
```

### Fluxo 2 — Submissão de código (caminho principal)
```
POST /submissoes
  → verificarAutenticacao (JWT ou header legado id-usuario)
  → valida desafio_id, candidato_id, codigo, linguagem
  → verifica desafio ativo
  → verifica candidato existe
  → INSERT ou UPDATE candidaturas_desafio
  → INSERT historico_atividades (best-effort)
  → corrigirSubmissao(id) [background, fire-and-forget]
  → resposta 201

corrigirSubmissao(candidaturaId) [async background]:
  → SELECT candidaturas_desafio WHERE id
  → SELECT casos_teste WHERE desafio_id ORDER BY id
  → para cada caso: executarCodigo(codigo, linguagem, input, 5000ms)
    → spawn(python3|node, [arquivo_temp])
    → captura stdout, compara com output_esperado
  → UPDATE candidaturas_desafio SET score_ia, testes_passados, total_testes, resultado_execucao
```

### Fluxo 3 — Avaliação IA simulada (fluxo legado via desafios)
```
POST /desafios/:id/entregar [ROTA NÃO REGISTRADA — código morto]
  → UPDATE candidaturas_desafio SET status='entregue'
  → avaliarComIA(desafioId, candidatoId) [setTimeout 3000ms]
    → score aleatório 5.0–9.5
    → UPDATE candidaturas_desafio SET score_ia, relatorio_ia
```

### Fluxo 4 — Criação de desafio + pagamento
```
POST /vagas (via vagaController.criarVaga)
  → INSERT vagas
  → pagamentoController.criarTaxaPlataforma(empresa_id, vaga_id, titulo)
    → criarOrdemPagarme(R$150)  [Pagar.me API]
    → INSERT pagamentos

POST /desafios
  → INSERT desafios
  → se vaga_id e bolsa_tecnica: UPDATE vagas SET bolsa_tecnica
```

### Fluxo 5 — Autenticação (middleware)
```
verificarAutenticacao:
  1. Tenta Authorization: Bearer <jwt>
     → jwt.verify(token, JWT_SECRET)
     → req.usuario = { public_id, tipo, email }
  2. Fallback: header id-usuario (legado)
     → req.usuario = { public_id, tipo:'desconhecido', email:null }
  3. Sem nenhum → 401
```

---

## 4. DEPENDÊNCIAS

### Rotas → Controllers → Services → Banco
```
servidor.js
├── userRoutes.js
│   ├── userController.js → banco/conexao.js (tabela users ← NÃO EXISTE)
│   └── controllers/vagaController.js → banco/conexao.js + pagamentoController.js
├── rotas/auth.js → controllers/authController.js → banco/conexao.js
├── rotas/desafios.js → controllers/desafioController.js → banco/conexao.js
├── rotas/pagamentos.js → controllers/pagamentoController.js → banco/conexao.js + fetch(pagar.me)
├── rotas/vagas.js → controllers/vagasController.js → banco/conexao.js  [SHADOWED]
├── rotas/submissoes.js → controllers/submissaoController.js
│   ├── banco/conexao.js
│   └── services/autoCorrector.js
│       ├── banco/conexao.js
│       └── services/codeRunner.js → child_process.spawn + fs + os
├── rotas/analyze.js → services/analyzeCodeService.js → analyzer/*.js (@babel/parser)
├── rotas/casos_teste.js → controllers/casosTesteController.js → banco/conexao.js
└── banco/conexao.js → better-sqlite3 → trivio.db

middlewares/verificarAutenticacao.js → jsonwebtoken
```

### Arquivos críticos (falha = sistema cai)
| Arquivo                    | Impacto se remover/quebrar                |
|----------------------------|-------------------------------------------|
| `banco/conexao.js`         | Todo o sistema para                       |
| `banco/trivio.db`          | Perda total de dados                      |
| `servidor.js`              | Servidor não sobe                         |
| `database/setup.js`        | Migrations não rodam no startup           |
| `middlewares/verificarAutenticacao.js` | Todas as rotas protegidas quebram |
| `controllers/authController.js` | Login/cadastro param                 |
| `services/codeRunner.js`   | Auto-correção para (não afeta submissão)  |
