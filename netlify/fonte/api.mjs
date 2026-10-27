// API da cantina na Netlify: liga o mesmo servidor Express (server.js) dentro da função,
// numa porta local, e repassa cada pedido de /api/* para ele.
import { once } from "node:events";
import servidor from "../../server.js";

const { app, bancoPronto } = servidor;
app.locals.serverless = true;

let base = null;
async function iniciar() {
  if (base) return base;
  await bancoPronto();
  const s = app.listen(0, "127.0.0.1");
  await once(s, "listening");
  base = `http://127.0.0.1:${s.address().port}`;
  return base;
}

export default async (req, context) => {
  try {
    const destino = await iniciar();
    const url = new URL(req.url);
    const headers = new Headers(req.headers);
    headers.delete("host");
    if (context?.ip) headers.set("x-forwarded-for", context.ip);
    const temCorpo = !["GET", "HEAD"].includes(req.method);
    const r = await fetch(destino + url.pathname + url.search, {
      method: req.method, headers, body: temCorpo ? await req.arrayBuffer() : undefined, redirect: "manual",
    });
    const h = new Headers(r.headers);
    h.delete("content-length"); h.delete("connection"); h.delete("keep-alive"); h.delete("transfer-encoding");
    return new Response(await r.arrayBuffer(), { status: r.status, headers: h });
  } catch (e) {
    console.error("Falha na API:", e);
    return Response.json({ erro: "O servidor não conseguiu acessar o banco de dados. Tente de novo em instantes." }, { status: 503 });
  }
};

export const config = { path: "/api/*" };
