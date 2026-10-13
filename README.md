# BucketEgg

Plataforma route-to-market para equipas no terreno: rotas otimizadas, visitas com GPS, encomendas, cobranças, auditorias, importação de Excel gigante e painel ao vivo.

| Pasta | O que é |
| --- | --- |
| [`apps/web`](apps/web) | Interface — Next.js 16 (App Router), React 19, Tailwind v4 |
| [`apps/api`](apps/api) | API — NestJS + Prisma + PostgreSQL (Neon) |
| [`docs`](docs/architecture.md) | Arquitetura, bases de dados e backup |

Cada aplicação é independente e tem o seu próprio `pnpm-lock.yaml`.

## Deploy da interface no Vercel

1. **Add New → Project** e importar este repositório.
2. **Root Directory:** `apps/web` (o Vercel deteta Next.js e pnpm automaticamente).
3. **Environment Variables:**
   - `NEXT_PUBLIC_API_URL` — endereço público da API (ex.: `https://api.exemplo.com`).
   - `NEXT_PUBLIC_DEMO_LOGIN` — deixar vazio em produção (`1` só para demonstrações).
   - Opcional: `NEXT_PUBLIC_MAP_TILES` / `NEXT_PUBLIC_MAP_ATTRIBUTION` (fornecedor de mapas com chave).
4. **Deploy.**

Depois do deploy, acrescente o domínio do Vercel a `CORS_ORIGINS` na API (ex.: `https://bucketegg.vercel.app`). Um `*` aceita as pré-visualizações: `https://bucketegg-*.vercel.app`.

## Deploy da API no Render (Frankfurt)

A API é um servidor NestJS de longa duração (workers de importação, ligações à base de dados), por isso corre num serviço de contentores e não no Vercel. A configuração está em [`render.yaml`](render.yaml).

1. No Render: **New → Blueprint** e escolher este repositório.
2. Preencher os valores pedidos:
   - `DATABASE_URL` — Neon Frankfurt, endereço **com** `-pooler`;
   - `DIRECT_DATABASE_URL` — Neon Frankfurt, endereço **sem** `-pooler`;
   - `CORS_ORIGINS` — domínio(s) do Vercel, ex.: `https://bucketegg.vercel.app,https://bucketegg-*.vercel.app`;
   - `GOOGLE_MAPS_API_KEY` — opcional (Routes API).
   O `JWT_SECRET` é gerado pelo Render.
3. **Apply.** Cada arranque aplica as migrações pendentes e o Render verifica `/health`.
4. Copiar o endereço da API (ex.: `https://bucketegg-api.onrender.com`) para `NEXT_PUBLIC_API_URL` no Vercel e fazer **Redeploy** da interface.

O plano `free` adormece após 15 min sem pedidos e apaga os ficheiros locais a cada reinício. Para produção (500+ utilizadores, Excel de 300 000+ linhas) use `1c-2g` ou superior. As restantes variáveis estão em [`apps/api/.env.example`](apps/api/.env.example).

## Desenvolvimento local

```bash
cd apps/api && pnpm install && pnpm start:dev   # http://localhost:3000
cd apps/web && pnpm install && pnpm dev -p 3001 # http://localhost:3001
```

Os ficheiros `.env` / `.env.local` nunca são enviados para o repositório; use os `.env.example` como modelo.
