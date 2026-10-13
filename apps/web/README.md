# BucketEgg Web

Interface da plataforma BucketEgg (Route-to-Market): **Next.js 16.4** (App Router, Turbopack, Cache Components),
React 19, Tailwind CSS v4, motion, TanStack Query e Leaflet. Laranja é a cor da marca; cada módulo tem a sua cor.

## Correr

```bash
pnpm install
cp .env.example .env.local      # NEXT_PUBLIC_API_URL aponta para a API
pnpm dev -p 3001                # http://localhost:3001 (a API autoriza este endereço por omissão em CORS_ORIGINS)
pnpm build && pnpm start -p 3001
```

Dados de demonstração (numa base de dados própria, **nunca** na principal), a partir de `apps/api`:

```bash
node scripts/seed-demo.mjs http://localhost:3000    # organização, equipa, 45 lojas, catálogo, beats, rotas, visitas…
node scripts/demo-today.mjs http://localhost:3000   # atualiza rotas/visitas para o dia de hoje (pode repetir)
```

Contas (palavra-passe `Demo2026Forte`): `dono@bucketegg.demo` (dono), `ana.machava@…` / `carlos.tembe@…` (supervisores),
`ines.cossa@…` (analista), `joao.mabunda@…`, `maria.sitoe@…`, … (promotores).

## Ecrãs

| Ecrã | Para quem | O que faz |
|---|---|---|
| `/painel` | todos | KPIs, receita e encomendas por dia, plano vs. real, strike rate, cobertura, ranking |
| `/meu-dia` | todos (sobretudo promotores, no telemóvel) | Entrada/saída, paragens com ETA, check-in GPS, encomenda com sugestão, cobrança, check-out |
| `/rotas` | todos (promotor vê as suas) | Rotas do dia no mapa; gestores planeiam (Google Maps), reagendam e criam tarefas avulsas |
| `/beats` | todos (gestores editam) | Circuitos semanais, gerar rota de um beat ou o plano do dia |
| `/lojas` | todos | Lista/mapa, aprovação, visita em atraso, perto de mim, duplicados, extrato e cobranças |
| `/visitas` | todos | Histórico de visitas (geofence, produtividade) e presenças |
| `/encomendas` | todos (promotor vê as suas) | Filtros, detalhe, estados (gestores), nova encomenda com limite de crédito |
| `/produtos` | todos (admins editam) | Catálogo, Must Sell, categorias |
| `/formularios` | todos (analistas/supervisores corrigem) | Formulários, recolhas, correções com histórico, colunas, exportação XLSX/CSV |
| `/importacoes` | supervisores e analistas | Excel/CSV grandes com progresso real de envio e de importação |
| `/equipa` | gestores | Membros, papéis, supervisores, organigrama |
| `/projetos`, `/definicoes` | todos (permissões por papel) | Projetos; perfil, segurança, organização, organizações, aparência |

## Arquitetura (resumo)

- O token JWT fica no browser (localStorage); a área autenticada é desenhada no cliente. Cada página é **pré-renderizada
  estática** (casca instantânea) e os dados chegam da API com cache (mostra o que já tem e atualiza em segundo plano).
- "Hoje" é sempre calculado no browser no fuso de Maputo (`useToday`), nunca na pré-renderização.
- Guia da equipa (componentes, cores, permissões, padrões de dados): [docs/ui-guide.md](docs/ui-guide.md).

## Verificação

```bash
pnpm exec tsc --noEmit
pnpm exec eslint --max-warnings 0 src
pnpm build
```
Estado em 13/10/2026: zero erros e zero avisos; 21 páginas estáticas; QA no browser (4 papéis × computador e telemóvel,
62 aberturas de ecrã) sem erros de consola, de API ou de layout; percursos completos testados pela interface
(promotor: entrada → check-in → encomenda → check-out; gestor: planear rota com Google, aprovar loja, confirmar encomenda,
importar CSV).
