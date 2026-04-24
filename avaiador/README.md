# Trivio Evaluator — Microserviço de Avaliação de Código

Microserviço REST que executa código de candidatos em ambiente **sandboxed**, roda casos de teste e retorna resultado estruturado. Projetado para integração com o backend principal do Trivio.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Node.js + Express |
| Sandbox JS | `isolated-vm` (V8 Isolate separado — zero acesso ao host) |
| Sandbox Python | `child_process` com timeout SIGKILL + bloqueio de imports |
| Timeout | 2 segundos por caso de teste (configurável via env) |

---

## Segurança

### JavaScript (isolated-vm)
- Executa em um **V8 Isolate separado** — sem acesso ao `process`, `require`, `fs`, `net`, `os`
- Memória limitada a **32 MB**
- Timeout de **2 segundos** via API do V8 (mata a thread do isolate, não o processo)
- Somente `console.log` e uma função `input()` simulada são injetados

### Python (subprocess)
- Processo filho com `env` limpo (sem variáveis sensíveis)
- **Import hook** que bloqueia: `socket`, `http`, `urllib`, `requests`, `httpx`, `subprocess`, `threading`, `ctypes` e outros
- **`open()` substituído** para bloquear acesso ao sistema de arquivos
- Timeout via `SIGKILL` após 2 segundos

> **Nota de produção**: para máxima segurança, execute este serviço dentro de um container Docker sem acesso à rede externa e com `--read-only` filesystem. O `docker-compose.yml` abaixo já configura isso.

---

## Pré-requisitos

- Node.js **18+**
- Python **3.8+**
- npm

---

## Instalação e execução

```bash
# 1. Instalar dependências
npm install

# 2. Rodar em desenvolvimento (com hot-reload)
npm run dev

# 3. Rodar em produção
npm start
```

O serviço sobe em `http://localhost:3333` por padrão.

Para mudar a porta:
```bash
PORT=4000 npm start
```

---

## Configuração com Docker (recomendado para produção)

```dockerfile
# Dockerfile
FROM node:20-alpine

RUN apk add --no-cache python3

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/

EXPOSE 3333
USER node
CMD ["node", "src/server.js"]
```

```yaml
# docker-compose.yml
version: '3.9'
services:
  evaluator:
    build: .
    ports:
      - "3333:3333"
    environment:
      - PORT=3333
    read_only: true
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    networks:
      - backend
    mem_limit: 256m
    cpus: '0.5'

networks:
  backend:
    internal: true
```

---

## API

### `GET /health`

Retorna status do serviço e linguagens suportadas.

**Resposta:**
```json
{
  "status": "ok",
  "supportedLanguages": ["javascript", "python"]
}
```

---

### `POST /evaluate`

Avalia o código do candidato contra os casos de teste fornecidos.

#### Request

```
POST /evaluate
Content-Type: application/json
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `language` | string | ✅ | `"python"` ou `"javascript"` |
| `code` | string | ✅ | Código-fonte do candidato |
| `tests` | array | ✅ | Array de casos de teste (máx. 20) |
| `tests[].input` | string | ✅ | Input a ser enviado via stdin / `input()` |
| `tests[].expected_output` | string | ✅ | Saída esperada |

#### Response (200 OK)

```json
{
  "success": true,
  "results": [
    {
      "input": "hello",
      "expected_output": "hello",
      "actual_output": "hello",
      "passed": true
    }
  ]
}
```

#### Response com falha em caso de teste

```json
{
  "success": false,
  "results": [
    {
      "input": "5",
      "expected_output": "25",
      "actual_output": "10",
      "passed": false
    }
  ]
}
```

#### Response com erro de execução

```json
{
  "success": false,
  "results": [
    {
      "input": "",
      "expected_output": "ok",
      "actual_output": null,
      "passed": false,
      "error": "Tempo limite excedido (2s)"
    }
  ]
}
```

#### Erros de validação (400)

```json
{ "error": "Linguagem \"ruby\" não suportada. Suportadas: javascript, python." }
```

---

## Exemplos com curl

### Python — echo simples
```bash
curl -X POST http://localhost:3333/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "print(input())",
    "tests": [
      { "input": "hello", "expected_output": "hello" },
      { "input": "trivio", "expected_output": "trivio" }
    ]
  }'
```

### Python — FizzBuzz
```bash
curl -X POST http://localhost:3333/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "n=int(input())\nfor i in range(1,n+1):\n  if i%15==0: print(\"FizzBuzz\")\n  elif i%3==0: print(\"Fizz\")\n  elif i%5==0: print(\"Buzz\")\n  else: print(i)",
    "tests": [
      { "input": "5",  "expected_output": "1\n2\nFizz\n4\nBuzz" },
      { "input": "15", "expected_output": "1\n2\nFizz\n4\nBuzz\n6\n7\n8\nFizz\n10\n11\nFizz\n13\n14\nFizzBuzz" }
    ]
  }'
```

### JavaScript — soma de dois números
```bash
curl -X POST http://localhost:3333/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "language": "javascript",
    "code": "const [a, b] = input().split(\" \").map(Number);\nconsole.log(a + b);",
    "tests": [
      { "input": "3 5",   "expected_output": "8" },
      { "input": "10 20", "expected_output": "30" }
    ]
  }'
```

### Teste de timeout (loop infinito)
```bash
curl -X POST http://localhost:3333/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "while True: pass",
    "tests": [
      { "input": "", "expected_output": "" }
    ]
  }'
```

### Teste de bloqueio de rede
```bash
curl -X POST http://localhost:3333/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "import socket\nprint(\"ok\")",
    "tests": [
      { "input": "", "expected_output": "ok" }
    ]
  }'
```

---

## Integração com o Trivio backend

No `desafioController.js`, ao receber a submissão do candidato, chame o evaluator:

```javascript
// controllers/desafioController.js

async function avaliarSubmissao(req, res) {
  const { codigo, linguagem } = req.body;
  const desafio = await buscarDesafio(req.params.id);

  const response = await fetch('http://localhost:3333/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: linguagem,
      code: codigo,
      tests: desafio.casos_de_teste, // [{ input, expected_output }]
    }),
  });

  const avaliacao = await response.json();

  // Salva no banco
  await salvarResultado(candidatoId, desafioId, avaliacao);

  return res.json(avaliacao);
}
```

---

## Normalização de saída

O comparador normaliza automaticamente antes de comparar:
- Remove espaços/newlines no início e fim
- Normaliza `\r\n` → `\n`
- Remove trailing whitespace em cada linha

Isso evita falsos negativos por diferenças de formatação entre sistemas operacionais.

---

## Estrutura do projeto

```
trivio-evaluator/
├── src/
│   ├── server.js      # Express + rotas + validação
│   └── evaluator.js   # Sandboxes JS e Python + orquestrador
├── package.json
└── README.md
```
