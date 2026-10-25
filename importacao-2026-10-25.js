"use strict";
// Importação única dos dados do sistema antigo (curo-three.vercel.app), conferidos em 25/10/2026 às 14:45:
// nomes completos dos médiuns (relatório de mensalidades), contas pendentes da cantina e relatório de estoque.

const DESC_SALDO = "Saldo trazido do sistema antigo (25/10/2026)";

// [nome atual no sistema novo | null para criar, nome completo, apelido, saldo devido]
const MEDIUNS = [
  ["Pai Oscar", "Pai Oscar", "", 3.00],
  ["Mãe Cintia", "Mãe Cintia Alves de Oliveira Beckert", "Mãe Cintia", 31.00],
  ["Mãe Marcela", "Mãe Marcela de Oliveira Beckert", "Mãe Marcela", 54.50],
  ["Mãe Manuela", "Mãe Manuela de Oliveira Beckert", "Mãe Manuela", 0],
  ["Gustavo", "Gustavo Henrique Corrêa", "Gustavo", 23.00],
  ["Suelin Schio", "Suelin Cristini Schio Soek", "Suelin Schio", 27.00],
  ["Deivid", "Deivid Oliveira", "Deivid", 58.50],
  ["Miguel", "Miguel Alves de Oliveira Azanha", "Miguel", 149.50],
  ["Gabi", "Gabrielle Giovana Bueno", "Gabi", 21.00],
  ["Izabelle", "Isabelle Nasloski", "Izabelle", 54.00],
  ["Claudio", "Claudio Fernando Schelesting", "Claudio", 0],
  ["Celmo", "Celmo Vazan", "Celmo", 15.00],
  ["Ket", "Kethllyn Cristine de Oliveira Antonio", "Ket", 5.00],
  ["Elisa", "Elisabete Santos", "Elisa", 43.00],
  ["Erika", "Erika Ribeiro de Almeida", "Erika", 48.00],
  ["Lucas", "Lucas Lopes da Silva", "Lucas", 50.00],
  ["Alessandra", "Alessandra Gomes da Silva", "Alessandra", 35.00],
  ["Marcia Mello", "Marcia Lourenço de Mello", "Marcia Mello", 25.00],
  ["Sandra", "Sandra Marcia Filipake", "Sandra", 38.75],
  ["Cris", "Crislene Luiz", "Cris", 0],
  ["Juca", "Jucenir Ribeiro de Almeida", "Juca", 22.00],
  ["Thaiz", "Thaiz Ribeiro de Almeida", "Thaiz", 30.50],
  ["Gi Wollertt", "Gisele Wollertt", "Gi Wollertt", 0],
  ["Karla", "Karla Cristina Ferreira", "Karla", 0],
  ["Suellin", "Suellin Fernanda Santos Ferreira Neves", "Suellin", 49.00],
  ["Kaue", "Kaue de Oliveira Melo", "Kaue", 428.50],
  ["Camille", "Camille Forville Siqueira", "Camille", 25.00],
  ["Val", "Valquiria Angelica Reis Gomes", "Val", 23.00],
  ["Carol", "Caroline de Oliveira", "Carol", 0],
  ["Francielle", "Francielle Franco de Oliveira", "Francielle", 61.50],
  [null, "Bruna Corte Real Lima", "", 66.25],
  [null, "CURO", "", 57.00],
  [null, "Cleiton Henrique Antonio", "", 865.75],
  [null, "Georgia Sant'Anna", "", 91.00],
  [null, "Igor Nierengarten Vieira", "", 0],
  [null, "Kamila Kaory Hikishima dos Santos", "", 41.50],
  [null, "Maria de Fatima Bacaro", "", 29.00],
  [null, "Sarah Barbosa Miranda", "", 0],
  [null, "Ângela Benetollo", "", 3.00],
  [null, "Fabiola de Freitas", "", 204.00],
  [null, "Natã Alves de Ramos", "", 200.00],
  [null, "Rodrigo Siqueira da Cruz", "", 103.00],
  [null, "Bianca da Silva Sales", "", 22.00],
  [null, "Jucimara Vane", "", 4.00],
];

// [nome atual no sistema novo | null para criar, nome, categoria, preço, estoque]
const PRODUTOS = [
  ["Água sem gás", "Água sem gás", "Bebidas", 3.00, 24],
  ["Água com gás", "Água com gás", "Bebidas", 3.00, 0],
  [null, "Alfajor", "Doces", 2.50, 20],
  [null, "Bala de goma", "Doces", 1.00, 30],
  [null, "Bala Halls", "Doces", 2.00, 0],
  [null, "Balas (pequenas)", "Doces", 2.00, 34],
  ["Batata Frita", "Batata Frita", "Salgados", 4.00, 38],
  [null, "Bolinha de queijo", "Salgados", 4.00, 89],
  ["Bolo", "Bolo Sabores", "Doces", 3.00, 13],
  [null, "Bombom de travessa", "Doces", 3.00, 28],
  [null, "Onion rings (cebola)", "Salgados", 5.00, 8],
  [null, "Cachorro Quente", "Comidas", 2.50, 28],
  [null, "Cerveja", "Bebidas", 2.00, 20],
  [null, "Cini Sabores", "Bebidas", 4.00, 1],
  ["Coca Cola", "Coca Cola", "Bebidas", 5.00, 32],
  ["Coca Cola Zero", "Coca Cola Zero", "Bebidas", 5.00, 94],
  [null, "Coxinhas", "Salgados", 4.00, 67],
  [null, "Cuca de Banana", "Doces", 3.00, 45],
  [null, "Doce de Amendoim", "Doces", 1.00, 30],
  [null, "Empadinha", "Salgados", 3.00, 6],
  [null, "Empadão de Frango", "Salgados", 5.00, 26],
  [null, "Esfirra Tamanho M", "Salgados", 4.00, 34],
  [null, "Espetinho", "Comidas", 3.00, 0],
  [null, "Fanta Laranja", "Bebidas", 5.00, 0],
  [null, "Fanta Uva", "Bebidas", 5.00, 1],
  ["Guaraná", "Guaraná", "Bebidas", 3.00, 2],
  ["Guaraná Zero", "Guaraná Zero", "Bebidas", 3.00, 25],
  [null, "Guia de proteção", "Guias", 25.00, 86],
  [null, "Guia de trabalho", "Guias", 60.00, 93],
  [null, "Mini bolinho", "Doces", 2.00, 7],
  [null, "Misto Quente", "Salgados", 3.00, 16],
  ["Mousse", "Mousse", "Doces", 3.00, 21],
  ["Nuggets", "Nuggets", "Comidas", 4.00, 17],
  [null, "Obi", "Artigos religiosos", 15.00, 10],
  [null, "Pacote de Salgadinho", "Salgados", 3.00, 16],
  ["Pastel", "Pastel", "Salgados", 2.50, 36],
  [null, "Pastelzinho Tamanho P", "Salgados", 4.00, 0],
  [null, "Paçoca", "Doces", 1.00, 0],
  [null, "Pepsi", "Bebidas", 4.00, 0],
  ["Pepsi Black", "Pepsi zero", "Bebidas", 5.00, 35],
  ["Pipoca", "Pipoca Doce", "Doces", 3.00, 35],
  [null, "Pirulito", "Doces", 0.25, 61],
  [null, "Pudim", "Doces", 2.00, 30],
  [null, "Pão de Queijo", "Salgados", 3.00, 45],
  [null, "Pão Recheado", "Salgados", 2.00, 20],
  [null, "Pão com Frango", "Comidas", 2.50, 66],
  [null, "Pão com ovo e outros", "Comidas", 5.00, 0],
  [null, "Quiche de Frango e Palmito", "Salgados", 4.00, 10],
  ["Salgadinho de festa", "Salgadinhos festa", "Salgados", 4.00, 173],
  [null, "Salgado", "Salgados", 6.00, 0],
  ["Sanduíche", "Sanduíche", "Comidas", 3.00, 32],
  ["Sopa", "Sopa", "Comidas", 3.00, 0],
  [null, "Sopa 01", "Comidas", 5.00, 0],
  [null, "Sprite", "Bebidas", 4.00, 0],
  ["Torta salgada", "Torta Salgada", "Salgados", 2.00, 38],
  [null, "Buraco quente", "Comidas", 5.00, 0],
];

module.exports = async function importar(c, { id, r2, r3, dia, acertarSaldo, log }) {
  const low = s => String(s).toLocaleLowerCase("pt-BR");
  // médiuns
  const meds = (await c.query("SELECT * FROM mediuns FOR UPDATE")).rows;
  const porNome = new Map(meds.map(m => [low(m.nome), m]));
  let criados = 0, renomeados = 0, saldos = 0;
  for (const [atual, nome, apelido, saldo] of MEDIUNS) {
    let m = porNome.get(low(nome)) || (atual ? porNome.get(low(atual)) : null);
    if (!m) {
      const mid = id();
      m = (await c.query("INSERT INTO mediuns (id, nome, obs) VALUES ($1,$2,$3) RETURNING *", [mid, nome, apelido ? `Apelido: ${apelido}` : ""])).rows[0];
      porNome.set(low(nome), m); criados++;
    } else if (m.nome !== nome) {
      const obs = m.obs ? m.obs : (apelido ? `Apelido: ${apelido}` : "");
      m = (await c.query("UPDATE mediuns SET nome = $2, obs = $3 WHERE id = $1 RETURNING *", [m.id, nome, obs])).rows[0];
      await c.query("UPDATE vendas SET medium_nome = $2 WHERE medium_id = $1", [m.id, nome]);
      await c.query("UPDATE pagamentos SET medium_nome = $2 WHERE medium_id = $1", [m.id, nome]);
      porNome.set(low(nome), m); renomeados++;
    }
    if (await acertarSaldo(c, m, saldo, DESC_SALDO)) saldos++;
  }
  log(`Importação médiuns: ${criados} criados, ${renomeados} renomeados, ${saldos} saldos acertados`);

  // produtos
  const prods = (await c.query("SELECT * FROM produtos FOR UPDATE")).rows;
  const pNome = new Map(prods.map(p => [low(p.nome), p]));
  let pc = 0, pa = 0;
  for (const [atual, nome, cat, preco, est] of PRODUTOS) {
    let p = pNome.get(low(nome)) || (atual ? pNome.get(low(atual)) : null);
    if (!p) {
      const pid = id();
      await c.query("INSERT INTO produtos (id, nome, categoria, preco, estoque) VALUES ($1,$2,$3,$4,$5)", [pid, nome, cat, r2(preco), r3(est)]);
      if (est) await c.query("INSERT INTO movimentos (id, tipo, dia, produto_id, nome, qtd, custo_unit, total, obs) VALUES ($1,'inicial',$2,$3,$4,$5,0,0,$6)",
        [id(), dia, pid, nome, r3(est), "Estoque do sistema antigo (25/10/2026)"]);
      pc++;
    } else {
      const delta = r3(est - Number(p.estoque));
      await c.query("UPDATE produtos SET nome = $2, categoria = $3, preco = $4, estoque = $5, ativo = true, atualizado_em = now() WHERE id = $1", [p.id, nome, cat, r2(preco), r3(est)]);
      if (p.nome !== nome) await c.query("UPDATE movimentos SET nome = $2 WHERE produto_id = $1", [p.id, nome]);
      if (delta) await c.query("INSERT INTO movimentos (id, tipo, dia, produto_id, nome, qtd, custo_unit, total, obs) VALUES ($1,'inicial',$2,$3,$4,$5,$6,0,$7)",
        [id(), dia, p.id, nome, delta, r2(p.custo), "Estoque do sistema antigo (25/10/2026)"]);
      pa++;
    }
  }
  log(`Importação produtos: ${pc} criados, ${pa} atualizados`);
};
