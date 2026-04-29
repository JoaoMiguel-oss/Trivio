/**
 * analyzer/parser.js
 *
 * Responsável por transformar o código-fonte bruto em uma
 * Abstract Syntax Tree (AST). Todos os outros módulos dependem
 * do que esse aqui retorna.
 *
 * Por que AST e não regex?
 * Regex trata código como texto. AST entende a ESTRUTURA do código.
 * Com AST, você sabe que "function foo() {}" é uma FunctionDeclaration,
 * que tem um Identifier "foo" e um BlockStatement vazio. Isso permite
 * análises que regex jamais conseguiria fazer de forma confiável.
 */

const babelParser = require('@babel/parser');

// Mapa de linguagens suportadas → configurações do parser
// Para adicionar uma nova linguagem no futuro, basta adicionar aqui.
const LANGUAGE_CONFIGS = {
  javascript: {
    sourceType: 'module',
    plugins: [
      'jsx',
      'asyncGenerators',
      'classProperties',
      'dynamicImport',
      'objectRestSpread',
      'optionalChaining',
      'nullishCoalescingOperator',
      'decorators-legacy',
    ],
  },
  typescript: {
    sourceType: 'module',
    plugins: [
      'typescript',
      'jsx',
      'asyncGenerators',
      'classProperties',
      'dynamicImport',
      'objectRestSpread',
      'optionalChaining',
      'nullishCoalescingOperator',
      'decorators-legacy',
    ],
  },
};

/**
 * Faz o parse do código e retorna o resultado.
 *
 * @param {string} code - Código-fonte como string
 * @param {string} language - Linguagem ('javascript' | 'typescript')
 * @returns {{ ast: object|null, error: string|null, language: string, lines: number }}
 */
function parseCode(code, language = 'javascript') {
  // Normaliza a linguagem para minúsculo
  const lang = language.toLowerCase();

  // Verifica se a linguagem é suportada
  if (!LANGUAGE_CONFIGS[lang]) {
    return {
      ast: null,
      error: `Linguagem "${language}" não suportada. Linguagens disponíveis: ${Object.keys(LANGUAGE_CONFIGS).join(', ')}`,
      language: lang,
      lines: 0,
    };
  }

  // Garante que o código é uma string não vazia
  if (typeof code !== 'string' || code.trim().length === 0) {
    return {
      ast: null,
      error: 'Código vazio ou inválido.',
      language: lang,
      lines: 0,
    };
  }

  try {
    const config = LANGUAGE_CONFIGS[lang];
    const ast = babelParser.parse(code, {
      ...config,
      // errorRecovery: true faz o parser tentar continuar mesmo com erros de sintaxe,
      // retornando uma AST parcial. Útil para dar feedback mesmo em código quebrado.
      errorRecovery: true,
    });

    const lines = code.split('\n').length;

    return {
      ast,
      error: null,
      language: lang,
      lines,
      // Expõe os erros de sintaxe que o parser encontrou (mas tolerou)
      syntaxErrors: ast.errors || [],
    };
  } catch (err) {
    // Erro fatal de parse (o errorRecovery não conseguiu salvar)
    return {
      ast: null,
      error: `Erro de sintaxe fatal: ${err.message}`,
      language: lang,
      lines: 0,
    };
  }
}

/**
 * Utilitário para percorrer a AST de forma recursiva.
 * Aceita um objeto com handlers para cada tipo de nó.
 *
 * Exemplo de uso:
 *   traverse(ast, {
 *     FunctionDeclaration(node) { ... },
 *     CallExpression(node) { ... },
 *   });
 */
function traverse(node, visitors) {
  if (!node || typeof node !== 'object') return;

  // Se há um visitor para este tipo de nó, chama ele
  if (node.type && visitors[node.type]) {
    visitors[node.type](node);
  }

  // Percorre todos os filhos do nó
  for (const key of Object.keys(node)) {
    const child = node[key];
    if (Array.isArray(child)) {
      child.forEach((item) => traverse(item, visitors));
    } else if (child && typeof child === 'object' && child.type) {
      traverse(child, visitors);
    }
  }
}

/**
 * Verifica se a linguagem é suportada pelo analisador.
 */
function isLanguageSupported(language) {
  return Boolean(LANGUAGE_CONFIGS[language?.toLowerCase()]);
}

module.exports = { parseCode, traverse, isLanguageSupported };
