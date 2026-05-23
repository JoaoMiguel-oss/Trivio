// TRIVIO - CORRETOR AUTOMÁTICO
// Busca os casos de teste de um desafio, executa o código do candidato
// para cada caso e calcula o score com base nos testes passados.
// Score = (testes_passados / total_testes) * 10, arredondado em 1 decimal.
// Chamado de forma assíncrona (fire-and-forget) após salvar a submissão.

const db = require('../banco/conexao');
const { executarCodigo } = require('./codeRunner');

/**
 * Normaliza output para comparação: remove espaços extras e normaliza quebras de linha.
 */
function normalizar(str) {
    return (str || '').trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Corrige automaticamente uma submissão executando cada caso de teste.
 * Atualiza candidaturas_desafio com score, testes_passados, total_testes e resultado_execucao.
 * @param {number} candidaturaId - ID da linha em candidaturas_desafio
 */
async function corrigirSubmissao(candidaturaId) {
    // Busca a submissão com código e linguagem
    const candidatura = db.prepare(
        'SELECT * FROM candidaturas_desafio WHERE id = ?'
    ).get(candidaturaId);

    if (!candidatura || !candidatura.codigo || !candidatura.linguagem) {
        console.warn(`[AUTO-CORREÇÃO] Candidatura ${candidaturaId} sem código ou linguagem — pulando`);
        return;
    }

    // Busca casos de teste associados ao desafio, ordenados por id
    const casos = db.prepare(
        'SELECT * FROM casos_teste WHERE desafio_id = ? ORDER BY id ASC'
    ).all(candidatura.desafio_id);

    if (!casos || casos.length === 0) {
        console.log(`[AUTO-CORREÇÃO] Desafio ${candidatura.desafio_id} sem casos de teste — score não calculado`);
        return;
    }

    const resultados = [];
    let passados = 0;

    for (const caso of casos) {
        let resultado;
        try {
            resultado = await executarCodigo(candidatura.codigo, candidatura.linguagem, caso.input || '');
        } catch (err) {
            resultado = { sucesso: false, output: '', erro: err.message, tempo: 0 };
        }

        const outputObtido = normalizar(resultado.output);
        const outputEsperado = normalizar(caso.output_esperado);
        const passou = resultado.sucesso && outputObtido === outputEsperado;

        if (passou) passados++;

        resultados.push({
            caso_id: caso.id,
            descricao: caso.descricao || `Caso ${caso.id}`,
            passou,
            output_obtido: resultado.output,
            output_esperado: caso.output_esperado,
            erro: resultado.erro || null,
            tempo_ms: resultado.tempo,
        });
    }

    const total = casos.length;
    // Score de 0 a 10 com 1 casa decimal
    const score = total > 0 ? Math.round((passados / total) * 100) / 10 : 0;

    db.prepare(`
        UPDATE candidaturas_desafio
        SET score_ia          = ?,
            testes_passados   = ?,
            total_testes      = ?,
            resultado_execucao = ?
        WHERE id = ?
    `).run(
        score,
        passados,
        total,
        JSON.stringify(resultados),
        candidaturaId
    );

    console.log(`[AUTO-CORREÇÃO] Candidatura ${candidaturaId}: ${passados}/${total} testes → score ${score}`);
}

module.exports = { corrigirSubmissao };
