"use strict";
// Importação única das mensalidades de outubro/2026 (relatório do sistema antigo, 25/10/2026 14:43).
// Também marca quem participa das mensalidades: os 39 médiuns do relatório.

const MEMBROS = [
  "Alessandra Gomes da Silva", "Bruna Corte Real Lima", "CURO", "Camille Forville Siqueira", "Caroline de Oliveira",
  "Celmo Vazan", "Cintia Alves de Oliveira Beckert", "Claudio Fernando Schelesting", "Cleiton Henrique Antonio", "Crislene Luiz",
  "Deivid Oliveira", "Elisabete Santos", "Erika Ribeiro de Almeida", "Francielle Franco de Oliveira", "Gabrielle Giovana Bueno",
  "Georgia Sant'Anna", "Gisele Wollertt", "Gustavo Henrique Corrêa", "Igor Nierengarten Vieira", "Isabelle Nasloski",
  "Jucenir Ribeiro de Almeida", "Kamila Kaory Hikishima dos Santos", "Karla Cristina Ferreira", "Kaue de Oliveira Melo",
  "Kethllyn Cristine de Oliveira Antonio", "Lucas Lopes da Silva", "Manuela de Oliveira Beckert", "Marcela de Oliveira Beckert",
  "Marcia Lourenço de Mello", "Maria de Fatima Bacaro", "Miguel Alves de Oliveira Azanha", "Oscar", "Sandra Marcia Filipake",
  "Sarah Barbosa Miranda", "Suelin Cristini Schio Soek", "Suellin Fernanda Santos Ferreira Neves", "Thaiz Ribeiro de Almeida",
  "Valquiria Angelica Reis Gomes", "Ângela Benetollo",
];
// [nome, dia do pagamento] — todos R$ 100,00 via Pix
const PAGOS_OUT = [
  ["Alessandra Gomes da Silva", "2026-10-07"], ["Camille Forville Siqueira", "2026-10-07"], ["Celmo Vazan", "2026-10-07"],
  ["Claudio Fernando Schelesting", "2026-10-07"], ["Deivid Oliveira", "2026-10-07"], ["Erika Ribeiro de Almeida", "2026-10-05"],
  ["Francielle Franco de Oliveira", "2026-10-07"], ["Gabrielle Giovana Bueno", "2026-10-07"], ["Georgia Sant'Anna", "2026-10-07"],
  ["Gisele Wollertt", "2026-10-07"], ["Gustavo Henrique Corrêa", "2026-10-07"], ["Jucenir Ribeiro de Almeida", "2026-10-05"],
  ["Kamila Kaory Hikishima dos Santos", "2026-10-07"], ["Lucas Lopes da Silva", "2026-10-05"], ["Manuela de Oliveira Beckert", "2026-10-07"],
  ["Marcela de Oliveira Beckert", "2026-10-07"], ["Miguel Alves de Oliveira Azanha", "2026-10-07"], ["Suelin Cristini Schio Soek", "2026-10-07"],
  ["Suellin Fernanda Santos Ferreira Neves", "2026-10-07"], ["Ângela Benetollo", "2026-10-05"],
];

module.exports = async function importar(c, { id, log }) {
  const chave = s => String(s).toLocaleLowerCase("pt-BR").replace(/^(pai|mãe|mae)\s+/, "").trim();
  const meds = (await c.query("SELECT id, nome FROM mediuns")).rows;
  const porNome = new Map(meds.map(m => [chave(m.nome), m]));
  const faltando = [];
  await c.query("UPDATE mediuns SET mensalidade = false");
  for (const n of MEMBROS) {
    const m = porNome.get(chave(n));
    if (m) await c.query("UPDATE mediuns SET mensalidade = true WHERE id = $1", [m.id]); else faltando.push(n);
  }
  let pagos = 0;
  for (const [n, dia] of PAGOS_OUT) {
    const m = porNome.get(chave(n));
    if (!m) { faltando.push(n); continue; }
    await c.query(`INSERT INTO mensalidades (id, medium_id, medium_nome, referencia, status, valor, dia, forma, obs)
      VALUES ($1,$2,$3,'2026-10','pago',100,$4,'pix','Importado do sistema antigo') ON CONFLICT (medium_id, referencia) DO NOTHING`, [id(), m.id, m.nome, dia]);
    pagos++;
  }
  log(`Mensalidades: ${MEMBROS.length - new Set(faltando).size} participantes marcados, ${pagos} pagamentos de outubro importados${faltando.length ? "; não encontrados: " + [...new Set(faltando)].join(", ") : ""}`);
};
