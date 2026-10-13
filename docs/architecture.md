# BucketEgg Route-to-Market — Documentação Técnica

Plataforma SaaS multi-tenant de automação de força de vendas e execução no retalho (inspirada no Beatroute).

- **Backend:** NestJS 12 (ESM) + Prisma 6 + PostgreSQL (Neon)
- **Frontend:** Next.js (App Router) + TailwindCSS
- **Documentação interativa da API:** `http://localhost:3000/docs` (Swagger) · especificação em `/docs/openapi.json`

## 1. Fluxo do utilizador

1. `POST /auth/register` — cria a conta. Com `organizationName`, cria logo a organização (o utilizador fica **OWNER**).
   Sem ela, a resposta traz `needsOnboarding: true` e o cliente chama `POST /organizations`, que devolve um novo token.
2. `POST /projects` — cria um projeto/campanha dentro da organização.
3. Dentro do projeto: lojas, beats, rotas, visitas, encomendas, formulários, importações e dashboard.
4. `POST /team` — convida a equipa (ADMIN, MANAGER, ANALYST, FIELD_REP). Um utilizador pode pertencer a várias organizações e trocar com `POST /auth/switch-organization`.

## 2. Módulos

| Módulo | Endpoints principais | Funcionalidades |
|---|---|---|
| Auth | `/auth/register`, `/auth/login`, `/auth/me`, `/auth/switch-organization`, `/auth/change-password` | bcrypt, JWT, limite de 10 tentativas/min por IP+email |
| Organizations | `/organizations`, `/organizations/current` | Moeda, fuso horário, raio de geofence |
| Team | `/team`, `/team/mine`, `/team/:membershipId`, `/users/me` | Papéis, vários supervisores por membro, desativação com revogação do token |
| Projects | `/projects` | CRUD e arquivo |
| Outlets | `/projects/:id/outlets[/nearby\|/overdue\|/check-duplicates]`, `/outlets/:id[/review]` | Duplicados por código, telefone, nome parecido (índice trigram) e GPS; aprovação; lojas próximas; prioridade por atraso × potencial |
| Beats | `/projects/:id/beats[/generate-day]`, `/beats/:id[/generate-route]` | Rotas fixas por dia da semana e geração do plano diário |
| Routes & Tasks | `/routes/plan`, `/routes/my-day`, `/routes/:id`, `/projects/:id/tasks`, `/tasks/:id` | Otimização pela **Google Routes API** (até 25 lojas, com ponto de partida) ou local (vizinho mais próximo + 2-opt), ETA por paragem; horas e dias no fuso da organização |
| Visits & Attendance | `/visits/check-in`, `/visits/:id/check-out`, `/visits/active`, `/attendance/clock-in\|clock-out` | Geofencing, motivo obrigatório sem encomenda |
| Sales | `/products`, `/orders`, `/orders/:id/status`, `/outlets/:id/payments\|statement\|suggested-order` | Preços do catálogo, IVA, limite de crédito atómico, numeração sem colisões, Must Sell List |
| Imports | `/imports/upload`, `/imports/presign`, `/imports`, `/imports/:id[/cancel]` | Ficheiros de centenas de MB em segundo plano (ver secção 5) |
| Datasets & Forms | `/projects/:id/forms`, `/datasets/:id/records\|schema\|download` | Formulários de auditoria, paginação por cursor, exportação XLSX/CSV em streaming |
| Analytics | `/projects/:id/analytics/dashboard\|sales-trend` | Plano vs real, strike rate, cobertura, vendas, cobranças, ranking — agregado no PostgreSQL |
| Health | `/health` | Estado da API e da base de dados |

### Rotas e Google Maps

- **Google Routes API** (`routes.googleapis.com/directions/v2:computeRoutes`, `optimizeWaypointOrder`, `TRAFFIC_UNAWARE`). A Directions API antiga é recusada pela Google em projetos novos ("You're calling a legacy API") — era o que a aplicação usava, e por isso caía sempre no otimizador local.
- Casos medidos na API real e tratados: máximo **25** paragens (26 → erro 400; acima disso usa o otimizador local); **1 paragem** devolve a ordem `[-1]` (não se pede otimização); ponto sem estrada (mar, ilha) devolve `{}`; chave inválida → 400. Em qualquer falha a rota é criada na mesma, com o otimizador local, e o motivo fica no registo (a chave vai no cabeçalho, nunca no URL nem no registo).
- Sem destino, a rota **regressa ao ponto de partida** nos dois motores (a distância total não depende da Google estar disponível).
- **Fuso horário:** `startTime` dos beats ("08:00"), "o meu dia", o filtro de rotas por data e o `dueDate` "AAAA-MM-DD" das tarefas usam o fuso da organização (`Africa/Maputo` por omissão). `timezone` só aceita fusos IANA válidos.
- Testes: `src/routes/route-optimizer.service.spec.ts` (Google simulada), `test/routes.e2e-spec.ts` (todas as funcionalidades, contra PostgreSQL), `test/google-routes.e2e-spec.ts` (Google real, ~8 pedidos; ignorado sem chave).

- **Mensagens de validação em português:** o `PortugueseValidationPipe` (`src/common/validation-pt.ts`) traduz as mensagens por omissão do class-validator (ex.: "«name» tem de ter pelo menos 2 caracteres."); as mensagens já personalizadas nos DTOs passam sem alteração.
- **Fuso horário em toda a API:** presenças, filtros de datas (encomendas, visitas, painel) e a tendência de vendas por dia usam os dias da organização (Maputo), não dias UTC.
- **Uma rota por beat e por dia:** `POST /beats/:id/generate-route` devolve 409 (com o `routeId` existente) se o beat já tiver rota nesse dia, como o plano do dia.

## 3. Papéis e permissões

| Papel | Quem é | Pode |
|---|---|---|
| OWNER | Quem criou a organização | Tudo, incluindo gerir outros OWNER e apagar datasets |
| ADMIN | Administrador | Tudo exceto gerir OWNER |
| MANAGER | Supervisor | Planear rotas e beats, aprovar lojas, gerir os seus FIELD_REP, importar, **corrigir dados recolhidos** |
| ANALYST | Analista de dados | Ver todos os dados, **corrigir, remover e restaurar registos**, editar formulários, importar datasets, exportar |
| FIELD_REP | Promotor / auditor | **Recolher e submeter dados**, visitas e encomendas. **Não altera o que submeteu** e só vê as suas recolhas |

**Correção de dados recolhidos** (`PATCH /datasets/:id/records/:recordId`): cada alteração fica no histórico (`GET .../history`) com autor, valores antes/depois e motivo. Com `lastKnownUpdatedAt`, dois editores em simultâneo recebem **409** em vez de se sobrescreverem. Remover é lógico e reversível.

## 4. Segurança e multi-tenancy

- **Guards globais (por esta ordem):** `JwtAuthGuard` → rate limit → `RolesGuard`. Endpoints públicos usam `@Public()`.
- **Rate limit por utilizador** (e por IP+email no login), não por IP: auditores em redes móveis partilham IPs (CGNAT).
- **Isolamento:** todo o acesso por ID passa pelo `AccessService`; recursos de outra organização devolvem **404**.
- **Validação:** `ValidationPipe` com `whitelist` + `forbidNonWhitelisted` (bloqueia mass-assignment).
- **Helmet**, CORS por lista de origens, `JWT_SECRET` obrigatório em produção, `.gitignore` protege o `.env`.

## 5. Grandes volumes de dados

**Importação** (`.xlsx`, `.xls`, `.xlsb`, `.ods`, `.csv`):
1. O ficheiro é guardado em streaming (disco ou S3/R2), sem ser carregado para memória. A resposta é imediata (**202**) com o job.
2. Um worker em segundo plano lê linha a linha (ExcelJS em streaming; `.xls` com SheetJS) e grava com **`COPY` do PostgreSQL numa única transação** — ou entra o ficheiro todo ou nada.
3. Tipos de coluna inferidos (número, data, verdadeiro/falso, texto). CSV do Excel em português (`;`, Windows-1252) detetado automaticamente.
4. Seguro com várias instâncias (`FOR UPDATE SKIP LOCKED`); jobs de instâncias que morrem são retomados.

**Correções em bibliotecas** (com testes de regressão):
- **ExcelJS 4.4 corrompia acentos** ("é", "ç") em ficheiros grandes — 10 em 20 000 linhas. Corrigido com `patches/exceljs@4.4.0.patch` (aplicado automaticamente pelo pnpm).
- ExcelJS falhava com ficheiros não gerados pelo Microsoft Excel (ordem invulgar no ZIP) — contornado.
- SheetJS atualizado para 0.20.3 (a versão do npm tinha 2 vulnerabilidades).

**Exportação:** `GET /datasets/:id/download?format=xlsx|csv` em streaming, memória constante; acima de 1 048 575 linhas o XLSX é dividido em folhas.

## 6. Desempenho medido

Medido num PC Windows de 12 núcleos, com PostgreSQL local (a ferramenta de carga, a API e a base de dados no mesmo computador — em produção os números são melhores).

**Ficheiros grandes** (integridade verificada: 0 caracteres corrompidos, nº de linhas exato):

| Ficheiro | Importação | Exportação CSV | Exportação XLSX |
|---|---|---|---|
| 300 000 linhas, `.xlsx` 40 MB | 47 s | 17 s | 18 s |
| 1 milhão de linhas, `.csv` 216 MB | 98 s | 57 s | 81 s |
| 1 milhão × 60 colunas, `.xlsx` **386 MB** | 5 min 40 s | 86 s | 2 min 44 s |

Ler uma página num dataset de 1 milhão de linhas: 180 ms. Memória máxima da API: ~900 MB (recomenda-se 2 GB por instância que faça importações).

**500 auditores em simultâneo** (4 processos, `pnpm start:cluster`):

| Cenário | Capacidade | Tempo de resposta (uso realista, 250 pedidos/s) | Erros |
|---|---|---|---|
| Leituras (perfil, lojas, rotas, formulários) | 1 960 pedidos/s | mediana 72 ms, p99 451 ms | 0 |
| Recolha de dados (submissões) | 1 251 pedidos/s | mediana 48 ms, p99 551 ms | 0 |

**Estrangulamentos encontrados e corrigidos:**
- Armazenamento por omissão do `@nestjs/throttler` percorria todos os pedidos do último minuto em cada pedido (perdia 70% da capacidade) → `FastThrottlerStorage` com custo constante.
- Contagem de registos do auditor percorria a tabela inteira (17 pedidos/s) → contagem pelo índice (499 pedidos/s).
- Contador de registos numa só linha fazia as submissões esperar umas pelas outras → contador repartido em 16 fatias, atualizado na mesma instrução SQL (contagem sempre exata).
- Estatísticas desatualizadas após cargas em massa (consultas de 18 s) → `ANALYZE` no fim de cada importação.
- Pool de ligações do Prisma esgotava a base de dados com vários processos → `DB_POOL_SIZE` por processo.
- Um processo Node.js usa um só núcleo → cluster (`dist/cluster.js`) ou várias réplicas.

### Medido contra a Neon (Frankfurt, plano Free), com a API neste PC em Maputo

A ida e volta Maputo → Frankfurt (~190 ms por consulta) domina estes números. No servidor da Neon as mesmas consultas demoram 0,1 ms (página por cursor) a 72 ms (contar 300 000 registos). **Em produção a API tem de ficar em Frankfurt, junto da base.**

| Teste | Resultado | Erros |
|---|---|---|
| Importar `.xlsx` de 300 000 linhas (40 MB) | 138 s (limitado pelo envio deste PC, ~2 MB/s); exportação CSV/XLSX 79 s | 0 (0 caracteres corrompidos) |
| 500 auditores, 50 pedidos/s (submeter a cada ~10 s) | mediana 470 ms, p99 2,3 s | 0 em 2 864 pedidos |
| 500 auditores sem pausa | 103 submissões/s + 124 leituras/s, mediana 4,6 s (fila: cada ligação espera 190 ms por consulta) | 0 em 6 801 pedidos |

**Espaço ocupado:** ~950 bytes por linha de 20 colunas — um `.xlsx` ocupa **~7×** o seu tamanho na base (o XLSX é comprimido). Um `.xlsx` de 320 MB precisa de ~2 GB: **não cabe no plano Free (1 GB por projeto)**. Ao atingir o limite, a importação falha logo, sem repetir, com a mensagem "A base de dados atingiu o limite de armazenamento do plano", e não fica nada a meio (transação única).

**Plano Neon necessário em produção:** Launch ou superior — armazenamento sem limite fixo (0,35 $/GB-mês), até 16 CU, 500 GB de tráfego incluído. O Free tem 1 GB, 100 horas de computação por mês (uma base sempre ligada gasta ~720 h) e 5 GB de tráfego.

**Ligações:** `DB_POOL_SIZE` por processo. Com a API junto da base, 10 chega. Se a API estiver longe da base, cada ligação serve menos pedidos por segundo; pelo `-pooler` da Neon (até 10 000 clientes) pode subir-se para 25.

Scripts para repetir as medições: `test/load/generate-file.mjs`, `import-export-bench.mjs`, `load-test.mjs` (ver cabeçalho de cada um).

## 7. Deploy e escala

| Peça | Onde | Porquê |
|---|---|---|
| Frontend Next.js | **Vercel** | CDN global |
| API NestJS | **Contentor** (`apps/api/Dockerfile`): Railway, Render, Fly.io ou Cloud Run | A Vercel limita pedidos a 4,5 MB e a duração das funções; as importações correm em segundo plano |
| Base de dados | **Neon**, região **Frankfurt (aws-eu-central-1)** | Não há região Neon em África. Medido a partir de Maputo (TCP, mediana): EUA/Ohio 263 ms, Londres 187 ms, Frankfurt 192 ms. Frankfurt e Londres empatam; Frankfurt tem mais opções para a API (Render, Fly.io, Railway, Cloud Run, Vercel `fra1`). A API deve ficar na **mesma região** que a base de dados |
| Ficheiros | **Cloudflare R2** ou AWS S3 (`STORAGE_DRIVER=s3`) | Upload direto do browser (`/imports/presign`): os 300 MB não passam pela API |

- **Ligações:** `DATABASE_URL` com `-pooler` (tráfego da API) e `DIRECT_DATABASE_URL` sem `-pooler` (migrações e `COPY`). Total de ligações diretas = instâncias × (`IMPORT_CONCURRENCY` + 1).
- **Várias instâncias:** o rate limit e o cache de acesso são por instância (a revogação de acesso demora no máximo `AUTH_CACHE_TTL_MS` = 10 s nas outras). Para um limite global exato, usar Redis no futuro.
- **Compressão:** a API comprime JSON/CSV; com um proxy/CDN à frente que comprima, pode ser desligada na API (recomendação da documentação do NestJS).
- **Mudar de região:** a Neon não muda a região de um projeto existente. Cria-se um projeto novo na região certa e migram-se os dados (`pnpm db:deploy` na base nova + `pnpm db:restore` a partir do backup, ou `pg_dump`/`pg_restore` com o cliente PostgreSQL da mesma versão do servidor, hoje 18).
- **Transações:** `DB_TX_MAX_WAIT_MS` (10 s) e `DB_TX_TIMEOUT_MS` (15 s) substituem os padrões do Prisma (2 s / 5 s), curtos quando a base está longe. A criação de encomendas é uma só instrução SQL, para os bloqueios do saldo da loja durarem uma única ida e volta.
- **Não testado ainda:** a construção da imagem Docker (o Docker Desktop não estava a correr) e o modo S3/R2 contra um serviço real.

## 8. Execução local

```bash
cd apps/api
cp .env.example .env          # preencher DATABASE_URL, DIRECT_DATABASE_URL e JWT_SECRET
pnpm install                  # aplica o patch do ExcelJS e gera o Prisma Client
pnpm db:deploy                # aplica as migrações (prisma/migrations)
pnpm start:dev                # http://localhost:3000/docs
```

Para PostgreSQL local: `docker compose up -d` (na raiz `data-platform/`).

### Testes

```bash
pnpm test        # testes unitários
pnpm test:e2e    # API completa + backup, contra a base TEST_DATABASE_URL do .env (APAGA os dados dela)
```

O e2e usa **só** `TEST_DATABASE_URL` / `TEST_DIRECT_DATABASE_URL` e recusa correr se o nome da base não terminar em `_test` — nunca toca na base de produção. O teste do backup cria as suas próprias bases (`bk_src_test`, `bk_dst_test`, `bk_restore_test`). Para criar a base de testes na Neon: `CREATE DATABASE neondb_test;` e `pnpm db:deploy` com essa URL.

## 9. Backups

**Incremental, todos os dias às 00h00** (`pnpm db:backup`, código em `apps/api/scripts/backup/`). Copia a base (`DIRECT_DATABASE_URL`) para `BACKUP_DATABASE_URL`:

| No destino | Conteúdo |
|---|---|
| `mirror.<tabela>` | Cópia de cada tabela, com a mesma chave primária (estado do último backup) e o md5 de cada linha (`_bk_hash`) |
| `bk.history` | Versões anteriores das linhas **alteradas** (`op = UPDATE`) e linhas **apagadas** na origem (`op = DELETE`), com o nº da execução |
| `bk.runs` | Uma linha por execução: estado, duração, contagens por tabela, erro |

- **Transfere só o que mudou:** a origem envia apenas (chave, md5 da linha) — ~70 bytes por linha; o destino devolve as chaves novas/alteradas e só essas linhas viajam completas. Num dia sem alterações, um dataset de 1 milhão de linhas transfere ~70 MB em vez de ~1 GB (importante com o limite de tráfego da Neon).
- **Só acrescenta, nunca perde:** linhas novas entram; uma linha alterada guarda primeiro a versão antiga em `bk.history`; uma linha apagada na origem passa para `bk.history`.
- **Sem duplicados:** tudo é comparado pela chave primária — correr duas vezes seguidas não muda nada.
- **Consistente e atómico:** lê a origem numa só fotografia (`REPEATABLE READ`) e grava no destino numa transação (ou corre tudo, ou nada). Duas execuções em simultâneo são recusadas.
- **Dia falhado?** O seguinte apanha tudo o que mudou desde o último backup bem-sucedido.
- **Restauro:** numa base vazia já migrada: `pnpm db:deploy` e depois `pnpm db:restore -- "postgresql://..."`. Versões antigas: `SELECT * FROM bk.history WHERE table_name = 'outlets' AND pk->>'id' = '...'`.
- **Agendamento neste PC:** `powershell -ExecutionPolicy Bypass -File scriptsackup
egister-task.ps1` (tarefa "BucketEgg - Backup incremental"; se o PC estiver desligado às 00h00, corre quando ligar). Registo em `backups/logs/`. **Em produção**, agendar `node scripts/backup/backup.mjs` no servidor da API (cron do Railway/Render/Fly às `0 22 * * *` UTC = 00h00 em Maputo).
- **Bases atuais:** principal no projeto Neon de **Frankfurt** (`DATABASE_URL`); backup na base `neondb_backup` do projeto dos **EUA** (`BACKUP_DATABASE_URL`) — duas regiões diferentes. Os testes (`neondb_test`) também ficam no projeto dos EUA, para não gastarem o espaço da principal. Uma base no mesmo projeto protege contra erros (dados apagados por engano) mas não contra uma falha do projeto inteiro.
- A Neon tem também restauro instantâneo do próprio projeto (janela de histórico: 6 h no plano Free, até 7 dias no Launch e 30 dias no Scale), útil para voltar atrás algumas horas.

## 10. Interface web (`apps/web`)

- **Next.js 16.4** (App Router, Turbopack, Cache Components): as 21 páginas são **pré-renderizadas estáticas**; a sessão (JWT) só existe no browser, por isso os dados chegam da API com cache (TanStack Query). Medido no build de produção: ecrã visível em 150–360 ms, 2.ª visita (cache) em ~200 ms; a primeira carga de dados depende da distância à API (em produção, API e base juntas em Frankfurt).
- **Design:** laranja como marca (botões laranja vivo com texto escuro, ≈7:1 de contraste), uma cor por módulo, temas claro/escuro, movimento suave que respeita "reduzir movimento", ilustrações SVG próprias. Gráficos em SVG com paleta validada para daltonismo (laranja primeiro).
- **Mapa:** Leaflet com mosaicos OpenStreetMap (atribuição visível); para muito tráfego, `NEXT_PUBLIC_MAP_TILES` (fornecedor com chave). Os mosaicos CARTO deixaram de funcionar sem chave.
- **Permissões:** os botões seguem os papéis da API (a API continua a validar tudo: 403).
- **Dados de demonstração:** `scripts/seed-demo.mjs` e `scripts/demo-today.mjs` (base própria, nunca a principal).
- Detalhes: [apps/web/README.md](../apps/web/README.md) e [apps/web/docs/ui-guide.md](../apps/web/docs/ui-guide.md).

