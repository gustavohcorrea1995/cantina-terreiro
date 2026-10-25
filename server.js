"use strict";
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { Pool, types } = require("pg");

// numeric -> number, date -> "YYYY-MM-DD", timestamptz -> ISO
types.setTypeParser(1700, v => (v === null ? null : parseFloat(v)));
types.setTypeParser(1082, v => v);
types.setTypeParser(1184, v => new Date(v).toISOString());

const PORT = process.env.PORT || 3000;
const SENHA = (process.env.SENHA || "").trim();
const TZ = process.env.FUSO || "America/Sao_Paulo";
if (!process.env.DATABASE_URL) { console.error("Falta a variável DATABASE_URL"); process.exit(1); }

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});
pool.on("error", e => console.error("pg pool", e.message));

const PAGAMENTOS = ["dinheiro", "pix", "credito", "debito", "caju", "conta"];
const PAG_CAIXA = ["dinheiro", "pix", "credito", "debito", "caju"];

/* ---------- utilidades ---------- */
class Erro extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }
const id = () => crypto.randomBytes(9).toString("base64url");
const r2 = v => Math.round((Number(v) || 0) * 100) / 100;
const r3 = v => Math.round((Number(v) || 0) * 1000) / 1000;
const txt = (v, max = 200) => String(v ?? "").trim().slice(0, max);
const isDia = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const numOk = v => typeof v === "number" && isFinite(v);
function agoraBR() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}` };
}
const camel = row => { if (!row) return row; const o = {}; for (const [k, v] of Object.entries(row)) o[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v; return o; };
const rows = r => r.rows.map(camel);

// versão em memória: os aparelhos consultam a cada poucos segundos sem acordar o banco
let versaoMem = null;
async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    const v = await c.query("UPDATE meta SET versao = versao + 1 WHERE id = 1 RETURNING versao");
    await c.query("COMMIT");
    versaoMem = Number(v.rows[0].versao);
    return out;
  } catch (e) {
    try { await c.query("ROLLBACK"); } catch {}
    throw e;
  } finally { c.release(); }
}

/* ---------- esquema e dados iniciais ---------- */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (id int PRIMARY KEY, versao bigint NOT NULL DEFAULT 0);
INSERT INTO meta (id, versao) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS config (chave text PRIMARY KEY, valor jsonb);
CREATE TABLE IF NOT EXISTS produtos (
  id text PRIMARY KEY, nome text NOT NULL, categoria text NOT NULL DEFAULT 'Outros', unidade text NOT NULL DEFAULT 'un',
  custo numeric(12,2) NOT NULL DEFAULT 0, preco numeric(12,2) NOT NULL DEFAULT 0,
  estoque numeric(14,3) NOT NULL DEFAULT 0, estoque_minimo numeric(14,3) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true, criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS mediuns (
  id text PRIMARY KEY, nome text NOT NULL, telefone text NOT NULL DEFAULT '', obs text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true, saldo numeric(12,2) NOT NULL DEFAULT 0, criado_em timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS vendas (
  id text PRIMARY KEY, data timestamptz NOT NULL DEFAULT now(), dia date NOT NULL, hora text NOT NULL,
  medium_id text, medium_nome text NOT NULL DEFAULT '', itens jsonb NOT NULL,
  total numeric(12,2) NOT NULL, custo_total numeric(12,2) NOT NULL, pagamento text NOT NULL,
  recebido numeric(12,2), troco numeric(12,2), cancelada boolean NOT NULL DEFAULT false, cancelada_em timestamptz);
CREATE INDEX IF NOT EXISTS vendas_dia ON vendas (dia);
CREATE INDEX IF NOT EXISTS vendas_medium ON vendas (medium_id);
CREATE TABLE IF NOT EXISTS movimentos (
  id text PRIMARY KEY, tipo text NOT NULL, data timestamptz NOT NULL DEFAULT now(), dia date NOT NULL,
  produto_id text, nome text NOT NULL, qtd numeric(14,3) NOT NULL, custo_unit numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0, obs text NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS movimentos_dia ON movimentos (dia);
CREATE TABLE IF NOT EXISTS despesas (
  id text PRIMARY KEY, descricao text NOT NULL, valor numeric(12,2) NOT NULL, categoria text NOT NULL DEFAULT '',
  dia date NOT NULL, data timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS despesas_dia ON despesas (dia);
CREATE TABLE IF NOT EXISTS pagamentos (
  id text PRIMARY KEY, data timestamptz NOT NULL DEFAULT now(), dia date NOT NULL, medium_id text, medium_nome text NOT NULL DEFAULT '',
  valor numeric(12,2) NOT NULL, forma text NOT NULL, obs text NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS pagamentos_dia ON pagamentos (dia);
CREATE INDEX IF NOT EXISTS pagamentos_medium ON pagamentos (medium_id);
CREATE TABLE IF NOT EXISTS acertos (
  id text PRIMARY KEY, data timestamptz NOT NULL DEFAULT now(), dia date NOT NULL, medium_id text, medium_nome text NOT NULL DEFAULT '',
  valor numeric(12,2) NOT NULL, saldo_novo numeric(12,2) NOT NULL, descricao text NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS acertos_medium ON acertos (medium_id);
`;
const SEED_MEDIUNS = ["Pai Oscar", "Mãe Cintia", "Mãe Marcela", "Mãe Manuela", "Gustavo", "Suelin Schio", "Deivid", "Miguel", "Gabi", "Izabelle", "Chuim", "Claudio", "Celmo", "Ket", "Elisa", "Erika", "Lucas", "Alessandra", "Marcia Mello", "Sandra", "Cris", "Juca", "Thaiz", "Gi Wollertt", "Karla", "Suellin", "Kaue", "Camille", "Val", "Carol", "Francielle", "Cleverson"];
const SEED_PRODUTOS = [
  ["Nuggets", "Comidas", "porção"], ["Batata Frita", "Comidas", "porção"], ["Salgadinho de festa", "Comidas", "un"], ["Sanduíche", "Comidas", "un"],
  ["Sopa", "Comidas", "porção"], ["Yakissoba", "Comidas", "porção"], ["Pastel", "Comidas", "un"], ["Torta salgada", "Comidas", "fatia"],
  ["Mousse", "Doces", "un"], ["Bolo", "Doces", "fatia"], ["Torta doce", "Doces", "fatia"],
  ["Coca Cola", "Bebidas", "un"], ["Coca Cola Zero", "Bebidas", "un"], ["Guaraná", "Bebidas", "un"], ["Guaraná Zero", "Bebidas", "un"],
  ["Pepsi Black", "Bebidas", "un"], ["Água sem gás", "Bebidas", "un"], ["Água com gás", "Bebidas", "un"],
];
// desfaz os efeitos de uma venda (estoque e conta) e a apaga
async function apagarVenda(c, v) {
  if (!v.cancelada) {
    for (const i of v.itens || []) await c.query("UPDATE produtos SET estoque = estoque + $2 WHERE id = $1", [i.produtoId, r3(i.qtd)]);
    if (v.pagamento === "conta" && v.medium_id) await c.query("UPDATE mediuns SET saldo = saldo - $2 WHERE id = $1", [v.medium_id, v.total]);
  }
  await c.query("DELETE FROM vendas WHERE id = $1", [v.id]);
}
// define o saldo da conta de um médium, deixando registrado no extrato
async function acertarSaldo(c, m, saldo, descricao) {
  const delta = r2(saldo - Number(m.saldo));
  if (!delta) return 0;
  await c.query("INSERT INTO acertos (id, dia, medium_id, medium_nome, valor, saldo_novo, descricao) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [id(), agoraBR().dia, m.id, m.nome, delta, r2(saldo), txt(descricao, 200)]);
  await c.query("UPDATE mediuns SET saldo = $2 WHERE id = $1", [m.id, r2(saldo)]);
  return delta;
}
async function limpezaUnica(chave, fn) {
  const ja = await pool.query("SELECT 1 FROM config WHERE chave = $1", [chave]);
  if (ja.rowCount) return;
  await tx(async c => { await fn(c); await c.query("INSERT INTO config (chave, valor) VALUES ($1, 'true') ON CONFLICT (chave) DO NOTHING", [chave]); });
}
async function diagnostico() {
  const q = async sql => (await pool.query(sql)).rows;
  const [cont] = await q("SELECT (SELECT count(*) FROM mediuns) mediuns, (SELECT count(*) FROM produtos) produtos, (SELECT count(*) FROM vendas) vendas, (SELECT count(*) FROM pagamentos) pagamentos, (SELECT count(*) FROM movimentos) movimentos, (SELECT count(*) FROM despesas) despesas");
  console.log("DIAG contagens " + JSON.stringify(cont));
  for (const r of await q("SELECT dia, count(*) n, sum(total) total, bool_or(cancelada) alguma_cancelada FROM vendas GROUP BY dia ORDER BY dia")) console.log("DIAG vendas " + JSON.stringify(r));
  for (const r of await q("SELECT nome, saldo, ativo FROM mediuns ORDER BY nome")) console.log("DIAG medium " + JSON.stringify(r));
  for (const r of await q("SELECT nome, categoria, custo, preco, estoque, ativo FROM produtos ORDER BY nome")) console.log("DIAG produto " + JSON.stringify(r));
  for (const r of await q("SELECT dia, medium_nome, valor, forma FROM pagamentos ORDER BY data")) console.log("DIAG pagamento " + JSON.stringify(r));
  for (const r of await q("SELECT dia, tipo, nome, qtd FROM movimentos ORDER BY data")) console.log("DIAG mov " + JSON.stringify(r));
}
async function prepararBanco() {
  await pool.query(SCHEMA);
  // pedido do responsável: apagar as vendas de teste feitas em 24/10/2026 (uma vez só)
  await limpezaUnica("limpeza-testes-2026-10-24", async c => {
    const vs = (await c.query("SELECT * FROM vendas WHERE dia = '2026-10-24' FOR UPDATE")).rows;
    for (const v of vs) { await apagarVenda(c, v); console.log(`Venda de teste apagada: ${v.dia} ${v.hora} ${v.medium_nome || "avulso"} R$ ${v.total} (${v.pagamento}${v.cancelada ? ", já cancelada" : ""})`); }
    console.log(`Limpeza de testes de 24/10/2026: ${vs.length} venda(s) apagada(s)`);
  });
  const seeded = await pool.query("SELECT 1 FROM config WHERE chave = 'seeded'");
  if (seeded.rowCount) return;
  await tx(async c => {
    const m = await c.query("SELECT count(*)::int n FROM mediuns");
    if (!m.rows[0].n) for (const nome of SEED_MEDIUNS) await c.query("INSERT INTO mediuns (id, nome) VALUES ($1, $2)", [id(), nome]);
    const p = await c.query("SELECT count(*)::int n FROM produtos");
    if (!p.rows[0].n) for (const [nome, cat, un] of SEED_PRODUTOS) await c.query("INSERT INTO produtos (id, nome, categoria, unidade) VALUES ($1, $2, $3, $4)", [id(), nome, cat, un]);
    await c.query("INSERT INTO config (chave, valor) VALUES ('seeded', 'true') ON CONFLICT (chave) DO NOTHING");
  });
  console.log("Banco preparado com a lista inicial de médiuns e produtos");
}

/* ---------- app ---------- */
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => { res.set("X-Content-Type-Options", "nosniff"); res.set("Referrer-Policy", "same-origin"); next(); });
app.get("/healthz", (req, res) => res.send("ok"));
app.use(express.static(path.join(__dirname, "public"), {
  setHeaders: (res, p) => { if (p.endsWith(".html") || p.endsWith(".webmanifest")) res.set("Cache-Control", "no-cache"); },
}));

// senha de acesso
const tentativas = new Map();
function senhaConfere(s) {
  if (!SENHA) return true;
  const a = Buffer.from(String(s || "")), b = Buffer.from(SENHA);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
app.post("/api/login", (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress;
  const now = Date.now(); const t = (tentativas.get(ip) || []).filter(x => now - x < 60000);
  if (t.length >= 10) return res.status(429).json({ erro: "Muitas tentativas. Espere um minuto." });
  if (senhaConfere(req.body?.senha)) { tentativas.delete(ip); return res.json({ ok: true }); }
  t.push(now); tentativas.set(ip, t);
  res.status(401).json({ erro: "Senha incorreta." });
});
app.use("/api", (req, res, next) => {
  if (senhaConfere(req.get("x-senha") ? decodeURIComponent(req.get("x-senha")) : "")) return next();
  res.status(401).json({ erro: "Senha necessária." });
});
const h = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

/* leitura */
app.get("/api/versao", h(async (req, res) => {
  if (versaoMem === null) versaoMem = Number((await pool.query("SELECT versao FROM meta WHERE id = 1")).rows[0]?.versao || 0);
  res.set("Cache-Control", "no-store");
  res.json({ versao: versaoMem, hoje: agoraBR().dia });
}));
app.get("/api/estado", h(async (req, res) => {
  const { dia: hoje } = agoraBR();
  let inicio = isDia(req.query.inicio) ? req.query.inicio : hoje;
  let fim = isDia(req.query.fim) ? req.query.fim : hoje;
  if (inicio > fim) [inicio, fim] = [fim, inicio];
  const [ver, prods, meds, cfg, vendas, vendasHoje, movs, desp, pags] = await Promise.all([
    pool.query("SELECT versao FROM meta WHERE id = 1"),
    pool.query("SELECT * FROM produtos ORDER BY nome"),
    pool.query("SELECT * FROM mediuns ORDER BY nome"),
    pool.query("SELECT valor FROM config WHERE chave = 'geral'"),
    pool.query("SELECT * FROM vendas WHERE dia BETWEEN $1 AND $2 ORDER BY data DESC LIMIT 20000", [inicio, fim]),
    pool.query("SELECT * FROM vendas WHERE dia = $1 ORDER BY data DESC", [hoje]),
    pool.query("SELECT * FROM movimentos WHERE dia BETWEEN $1 AND $2 ORDER BY data DESC LIMIT 5000", [inicio, fim]),
    pool.query("SELECT * FROM despesas WHERE dia BETWEEN $1 AND $2 ORDER BY dia DESC, data DESC LIMIT 5000", [inicio, fim]),
    pool.query("SELECT * FROM pagamentos WHERE dia BETWEEN $1 AND $2 ORDER BY data DESC LIMIT 5000", [inicio, fim]),
  ]);
  versaoMem = Number(ver.rows[0]?.versao || 0);
  res.set("Cache-Control", "no-store");
  res.json({
    versao: versaoMem, hoje, inicio, fim,
    produtos: rows(prods), mediuns: rows(meds), config: cfg.rows[0]?.valor || {},
    vendas: rows(vendas), vendasHoje: rows(vendasHoje), movs: rows(movs), despesas: rows(desp), pagamentos: rows(pags),
  });
}));
app.get("/api/mediuns/:id/extrato", h(async (req, res) => {
  const [v, p, a] = await Promise.all([
    pool.query("SELECT * FROM vendas WHERE medium_id = $1 ORDER BY data DESC LIMIT 300", [req.params.id]),
    pool.query("SELECT * FROM pagamentos WHERE medium_id = $1 ORDER BY data DESC LIMIT 300", [req.params.id]),
    pool.query("SELECT * FROM acertos WHERE medium_id = $1 ORDER BY data DESC LIMIT 300", [req.params.id]),
  ]);
  res.json({ vendas: rows(v), pagamentos: rows(p), acertos: rows(a) });
}));

/* vendas */
app.post("/api/vendas", h(async (req, res) => {
  const b = req.body || {};
  if (!PAGAMENTOS.includes(b.pagamento)) throw new Erro("Forma de pagamento inválida.");
  if (!Array.isArray(b.itens) || !b.itens.length || b.itens.length > 200) throw new Erro("A venda não tem itens.");
  const qtdPor = new Map();
  for (const i of b.itens) {
    if (typeof i?.produtoId !== "string" || !numOk(i.qtd) || i.qtd <= 0) throw new Erro("Item inválido na venda.");
    qtdPor.set(i.produtoId, r3((qtdPor.get(i.produtoId) || 0) + i.qtd));
  }
  const venda = await tx(async c => {
    const pr = await c.query("SELECT * FROM produtos WHERE id = ANY($1) FOR UPDATE", [[...qtdPor.keys()]]);
    const map = new Map(pr.rows.map(p => [p.id, p]));
    const itens = [];
    for (const [pid, qtd] of qtdPor) {
      const p = map.get(pid);
      if (!p) throw new Erro("Um dos produtos foi excluído. Atualize a tela e tente de novo.");
      if (!(p.preco > 0)) throw new Erro(`“${p.nome}” está sem preço de venda.`);
      itens.push({ produtoId: pid, nome: p.nome, categoria: p.categoria, qtd, preco: r2(p.preco), custo: r2(p.custo), subtotal: r2(p.preco * qtd) });
    }
    let med = null;
    if (b.mediumId) {
      med = (await c.query("SELECT * FROM mediuns WHERE id = $1 FOR UPDATE", [b.mediumId])).rows[0];
      if (!med) throw new Erro("Médium não encontrado. Atualize a tela.");
    }
    if (b.pagamento === "conta" && !med) throw new Erro("Escolha o médium para vender na conta.");
    const total = r2(itens.reduce((a, i) => a + i.subtotal, 0));
    const custoTotal = r2(itens.reduce((a, i) => a + i.custo * i.qtd, 0));
    let recebido = null, troco = null;
    if (b.pagamento === "dinheiro" && numOk(b.recebido) && b.recebido > 0) { recebido = r2(b.recebido); troco = r2(recebido - total); }
    const agora = agoraBR();
    let dia = agora.dia, hora = agora.hora, data = new Date().toISOString();
    if (b.dia && b.dia !== agora.dia){
      // venda retroativa: data escolhida pelo usuário, nunca no futuro
      if (!isDia(b.dia) || b.dia > agora.dia || b.dia < "2020-01-01") throw new Erro("Data da venda inválida.");
      dia = b.dia;
      hora = typeof b.hora === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(b.hora) ? b.hora : "12:00";
      data = new Date(`${dia}T${hora}:00-03:00`).toISOString();
    }
    const vid = id();
    const ins = await c.query(
      `INSERT INTO vendas (id, data, dia, hora, medium_id, medium_nome, itens, total, custo_total, pagamento, recebido, troco)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [vid, data, dia, hora, med?.id || null, med?.nome || "", JSON.stringify(itens), total, custoTotal, b.pagamento, recebido, troco]);
    for (const [pid, qtd] of qtdPor) await c.query("UPDATE produtos SET estoque = estoque - $2 WHERE id = $1", [pid, qtd]);
    if (b.pagamento === "conta") await c.query("UPDATE mediuns SET saldo = saldo + $2 WHERE id = $1", [med.id, total]);
    return camel(ins.rows[0]);
  });
  res.json(venda);
}));
app.post("/api/vendas/:id/cancelar", h(async (req, res) => {
  await tx(async c => {
    const v = (await c.query("SELECT * FROM vendas WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
    if (!v) throw new Erro("Venda não encontrada.", 404);
    if (v.cancelada) return;
    await c.query("UPDATE vendas SET cancelada = true, cancelada_em = now() WHERE id = $1", [v.id]);
    for (const i of v.itens || []) await c.query("UPDATE produtos SET estoque = estoque + $2 WHERE id = $1", [i.produtoId, r3(i.qtd)]);
    if (v.pagamento === "conta" && v.medium_id) await c.query("UPDATE mediuns SET saldo = saldo - $2 WHERE id = $1", [v.medium_id, v.total]);
  });
  res.json({ ok: true });
}));

app.delete("/api/vendas/:id", h(async (req, res) => {
  await tx(async c => {
    const v = (await c.query("SELECT * FROM vendas WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
    if (!v) throw new Erro("Venda não encontrada.", 404);
    await apagarVenda(c, v);
  });
  res.json({ ok: true });
}));

/* produtos e estoque */
function dadosProduto(b) {
  const nome = txt(b.nome, 120);
  if (!nome) throw new Erro("Informe o nome do produto.");
  if (!numOk(b.preco) || b.preco < 0) throw new Erro("Informe o preço de venda.");
  return {
    nome, categoria: txt(b.categoria, 60) || "Outros", unidade: txt(b.unidade, 20) || "un",
    custo: numOk(b.custo) && b.custo >= 0 ? r2(b.custo) : 0, preco: r2(b.preco),
    estoqueMinimo: numOk(b.estoqueMinimo) && b.estoqueMinimo >= 0 ? r3(b.estoqueMinimo) : 0, ativo: b.ativo !== false,
  };
}
async function inserirProduto(c, d, estoque, obs) {
  const pid = id();
  await c.query("INSERT INTO produtos (id, nome, categoria, unidade, custo, preco, estoque, estoque_minimo, ativo) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [pid, d.nome, d.categoria, d.unidade, d.custo, d.preco, estoque, d.estoqueMinimo, d.ativo]);
  if (estoque) await c.query("INSERT INTO movimentos (id, tipo, dia, produto_id, nome, qtd, custo_unit, total, obs) VALUES ($1,'inicial',$2,$3,$4,$5,$6,$7,$8)",
    [id(), agoraBR().dia, pid, d.nome, estoque, d.custo, r2(estoque * d.custo), obs]);
  return pid;
}
app.post("/api/produtos", h(async (req, res) => {
  const d = dadosProduto(req.body || {});
  const est = numOk(req.body.estoque) ? r3(req.body.estoque) : 0;
  const pid = await tx(c => inserirProduto(c, d, est, "Cadastro do produto"));
  res.json({ id: pid });
}));
app.post("/api/produtos/importar", h(async (req, res) => {
  const lista = Array.isArray(req.body?.linhas) ? req.body.linhas.slice(0, 500) : [];
  const n = await tx(async c => {
    let n = 0;
    for (const l of lista) {
      let d; try { d = dadosProduto({ ...l, ativo: true }); } catch { continue; }
      await inserirProduto(c, d, numOk(l.estoque) ? r3(l.estoque) : 0, "Importação"); n++;
    }
    return n;
  });
  res.json({ n });
}));
app.put("/api/produtos/:id", h(async (req, res) => {
  const d = dadosProduto(req.body || {});
  const r = await tx(c => c.query("UPDATE produtos SET nome=$2, categoria=$3, unidade=$4, custo=$5, preco=$6, estoque_minimo=$7, ativo=$8, atualizado_em=now() WHERE id=$1",
    [req.params.id, d.nome, d.categoria, d.unidade, d.custo, d.preco, d.estoqueMinimo, d.ativo]));
  if (!r.rowCount) throw new Erro("Produto não encontrado.", 404);
  res.json({ ok: true });
}));
app.delete("/api/produtos/:id", h(async (req, res) => {
  await tx(c => c.query("DELETE FROM produtos WHERE id = $1", [req.params.id]));
  res.json({ ok: true });
}));
app.post("/api/entradas", h(async (req, res) => {
  const b = req.body || {};
  if (!numOk(b.qtd) || b.qtd <= 0) throw new Erro("Informe a quantidade comprada.");
  const dia = isDia(b.dia) ? b.dia : agoraBR().dia;
  await tx(async c => {
    const p = (await c.query("SELECT * FROM produtos WHERE id = $1 FOR UPDATE", [b.produtoId])).rows[0];
    if (!p) throw new Erro("Produto não encontrado.", 404);
    const cu = numOk(b.custo) && b.custo >= 0 ? r2(b.custo) : r2(p.custo);
    const qtd = r3(b.qtd);
    await c.query("INSERT INTO movimentos (id, tipo, dia, produto_id, nome, qtd, custo_unit, total, obs) VALUES ($1,'entrada',$2,$3,$4,$5,$6,$7,$8)",
      [id(), dia, p.id, p.nome, qtd, cu, r2(qtd * cu), txt(b.obs, 200)]);
    if (b.atualizaCusto && numOk(b.custo)) await c.query("UPDATE produtos SET estoque = estoque + $2, custo = $3, atualizado_em = now() WHERE id = $1", [p.id, qtd, cu]);
    else await c.query("UPDATE produtos SET estoque = estoque + $2 WHERE id = $1", [p.id, qtd]);
  });
  res.json({ ok: true });
}));
app.post("/api/ajustes", h(async (req, res) => {
  const b = req.body || {};
  if (!["ajuste", "perda", "inicial"].includes(b.tipo)) throw new Erro("Tipo de ajuste inválido.");
  if (!numOk(b.q) || b.q < 0) throw new Erro("Informe a quantidade.");
  const delta = await tx(async c => {
    const p = (await c.query("SELECT * FROM produtos WHERE id = $1 FOR UPDATE", [b.produtoId])).rows[0];
    if (!p) throw new Erro("Produto não encontrado.", 404);
    const q = r3(b.q);
    const delta = b.tipo === "perda" ? -q : r3(q - p.estoque);
    if (!delta) return 0;
    await c.query("INSERT INTO movimentos (id, tipo, dia, produto_id, nome, qtd, custo_unit, total, obs) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [id(), b.tipo, agoraBR().dia, p.id, p.nome, delta, r2(p.custo), r2(delta * p.custo), txt(b.obs, 200)]);
    await c.query("UPDATE produtos SET estoque = estoque + $2 WHERE id = $1", [p.id, delta]);
    return delta;
  });
  res.json({ delta });
}));

/* médiuns e contas */
function dadosMedium(b) {
  const nome = txt(b.nome, 120);
  if (!nome) throw new Erro("Informe o nome.");
  return { nome, telefone: txt(b.telefone, 40), obs: txt(b.obs, 200), ativo: b.ativo !== false };
}
app.post("/api/mediuns", h(async (req, res) => {
  const d = dadosMedium(req.body || {}); const mid = id();
  await tx(c => c.query("INSERT INTO mediuns (id, nome, telefone, obs, ativo) VALUES ($1,$2,$3,$4,$5)", [mid, d.nome, d.telefone, d.obs, d.ativo]));
  res.json({ id: mid });
}));
app.post("/api/mediuns/importar", h(async (req, res) => {
  const lista = Array.isArray(req.body?.linhas) ? req.body.linhas.slice(0, 500) : [];
  const n = await tx(async c => {
    const ex = new Set((await c.query("SELECT lower(nome) n FROM mediuns")).rows.map(r => r.n));
    let n = 0;
    for (const l of lista) {
      const nome = txt(l.nome, 120); if (!nome || ex.has(nome.toLowerCase())) continue;
      ex.add(nome.toLowerCase());
      await c.query("INSERT INTO mediuns (id, nome, telefone) VALUES ($1,$2,$3)", [id(), nome, txt(l.telefone, 40)]); n++;
    }
    return n;
  });
  res.json({ n });
}));
app.put("/api/mediuns/:id", h(async (req, res) => {
  const d = dadosMedium(req.body || {});
  const r = await tx(c => c.query("UPDATE mediuns SET nome=$2, telefone=$3, obs=$4, ativo=$5 WHERE id=$1", [req.params.id, d.nome, d.telefone, d.obs, d.ativo]));
  if (!r.rowCount) throw new Erro("Médium não encontrado.", 404);
  res.json({ ok: true });
}));
app.delete("/api/mediuns/:id", h(async (req, res) => {
  await tx(c => c.query("DELETE FROM mediuns WHERE id = $1", [req.params.id]));
  res.json({ ok: true });
}));
app.post("/api/mediuns/:id/acerto", h(async (req, res) => {
  const b = req.body || {};
  if (!numOk(b.saldo) || Math.abs(b.saldo) > 1e6) throw new Erro("Informe o novo saldo.");
  await tx(async c => {
    const m = (await c.query("SELECT * FROM mediuns WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
    if (!m) throw new Erro("Médium não encontrado.", 404);
    await acertarSaldo(c, m, b.saldo, txt(b.descricao, 200) || "Acerto de saldo");
  });
  res.json({ ok: true });
}));
app.post("/api/pagamentos", h(async (req, res) => {
  const b = req.body || {};
  if (!numOk(b.valor) || b.valor <= 0) throw new Erro("Informe o valor recebido.");
  if (!PAG_CAIXA.includes(b.forma)) throw new Erro("Forma de pagamento inválida.");
  await tx(async c => {
    const m = (await c.query("SELECT * FROM mediuns WHERE id = $1 FOR UPDATE", [b.mediumId])).rows[0];
    if (!m) throw new Erro("Médium não encontrado.", 404);
    const v = r2(b.valor);
    await c.query("INSERT INTO pagamentos (id, dia, medium_id, medium_nome, valor, forma, obs) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [id(), agoraBR().dia, m.id, m.nome, v, b.forma, txt(b.obs, 200)]);
    await c.query("UPDATE mediuns SET saldo = saldo - $2 WHERE id = $1", [m.id, v]);
  });
  res.json({ ok: true });
}));

/* despesas e ajustes gerais */
app.post("/api/despesas", h(async (req, res) => {
  const b = req.body || {};
  const descricao = txt(b.descricao, 160);
  if (!descricao || !numOk(b.valor) || b.valor <= 0) throw new Erro("Informe a descrição e o valor.");
  await tx(c => c.query("INSERT INTO despesas (id, descricao, valor, categoria, dia) VALUES ($1,$2,$3,$4,$5)",
    [id(), descricao, r2(b.valor), txt(b.categoria, 60), isDia(b.dia) ? b.dia : agoraBR().dia]));
  res.json({ ok: true });
}));
app.delete("/api/despesas/:id", h(async (req, res) => {
  await tx(c => c.query("DELETE FROM despesas WHERE id = $1", [req.params.id]));
  res.json({ ok: true });
}));
app.put("/api/config", h(async (req, res) => {
  const valor = { nome: txt(req.body?.nome, 120) };
  await tx(c => c.query("INSERT INTO config (chave, valor) VALUES ('geral', $1) ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor", [JSON.stringify(valor)]));
  res.json({ ok: true });
}));

app.use("/api", (req, res) => res.status(404).json({ erro: "Não encontrado." }));
app.use((err, req, res, next) => {
  if (err instanceof Erro) return res.status(err.status).json({ erro: err.message });
  if (err?.type === "entity.parse.failed") return res.status(400).json({ erro: "Dados inválidos." });
  console.error(err);
  res.status(500).json({ erro: "Erro no servidor. Tente de novo." });
});

prepararBanco()
  .then(() => diagnostico().catch(e => console.error("DIAG falhou", e.message)))
  .then(() => app.listen(PORT, () => console.log(`Cantina no ar na porta ${PORT}${SENHA ? " (com senha)" : " (sem senha)"}`)))
  .catch(e => { console.error("Falha ao preparar o banco:", e.message); process.exit(1); });
