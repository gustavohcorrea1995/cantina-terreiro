#!/bin/sh
# Monta a função da Netlify num arquivo único, já com express e pg dentro.
# Rode sempre que mudar server.js ou netlify/fonte/api.mjs, e envie o arquivo gerado junto.
set -e
npx --yes esbuild@0.24.2 netlify/fonte/api.mjs --bundle --platform=node --format=esm --target=node20 \
  --external:pg-native --log-level=warning --legal-comments=none \
  --banner:js="import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" \
  --outfile=netlify/functions/api.mjs
echo "Função montada em netlify/functions/api.mjs"
