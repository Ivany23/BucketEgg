#!/bin/sh
# Arranque em produção (Render/Docker): aplica as migrações pendentes e inicia a API.
# "set -e" pára se as migrações falharem; "exec" deixa o Node receber os sinais de paragem.
set -e
./node_modules/.bin/prisma migrate deploy
exec node dist/main.js
