# Cantina do Terreiro

Sistema web da cantina: vendas por médium (à vista ou na conta), estoque, custos, balanço e relatório em Excel. Funciona no tablet, no celular e no PC, com os mesmos dados.

## Como funciona

- `server.js`: servidor Node (Express) com banco PostgreSQL. Cria as tabelas sozinho na primeira vez e carrega a lista inicial de médiuns e produtos.
- `public/index.html`: a tela do sistema (vender, vendas, médiuns, produtos e estoque, balanço).
- Estoque e saldo das contas são atualizados dentro de transações no banco, então dois aparelhos vendendo ao mesmo tempo não perdem baixas.
- Os aparelhos verificam novidades a cada 4 segundos enquanto a tela está aberta.

## Variáveis de ambiente

| Variável | Para que serve |
|---|---|
| `DATABASE_URL` | Endereço do banco PostgreSQL (ex.: Neon) |
| `SENHA` | Senha pedida na primeira vez em cada aparelho. Sem ela, o site fica aberto. |
| `FUSO` | Fuso horário das vendas (padrão `America/Sao_Paulo`) |

## Rodar no computador

```
npm install
DATABASE_URL=postgresql://... SENHA=minhasenha npm start
```

Depois abra http://localhost:3000.

## Publicar no Render

Web Service com Node: comando de build `npm install`, comando de start `npm start`, e as variáveis acima.

## Publicar na Netlify

A tela fica em `public/` e a API roda na função `netlify/functions/api.mjs`, que é gerada a partir de
`netlify/fonte/api.mjs` + `server.js` com tudo empacotado dentro. Depois de mudar `server.js`, rode
`npm run montar:netlify` e envie o arquivo gerado junto. Variáveis na Netlify: `DATABASE_URL` e `SENHA`.
