# BucketEgg Web — guia da equipa de design e front-end

Contrato que todos os ecrãs seguem. Se algo não estiver aqui, siga o código existente em
`src/app/(app)/painel`, `src/components/ui` e `src/components/shell`.

## Stack (versões instaladas — não usar APIs de versões antigas)
- **Next.js 16.4** (App Router, Turbopack, `cacheComponents: true`). Docs locais: `node_modules/next/dist/docs/`.
  `params`/`searchParams` são Promises. **Não use `useSearchParams`** (obriga a `<Suspense>`); guarde filtros em `useState`.
- **React 19.3**, **TypeScript estrito**, **Tailwind CSS v4** (tokens em `src/app/globals.css`).
- **motion 14** (`import { motion, AnimatePresence, useReducedMotion } from 'motion/react'`).
- **lucide-react 1.55** (ícones), **@tanstack/react-query 5**, **react-leaflet 5** (via `MapView`).
- Não instale dependências novas.

## Estrutura de uma página
```
src/app/(app)/<slug>/page.tsx      ← Server Component: exporta `metadata` e renderiza <Screen/>
src/app/(app)/<slug>/screen.tsx    ← 'use client': o ecrã
src/app/(app)/<slug>/*.tsx         ← partes do ecrã (formulários, painéis, cartões)
```
```tsx
// page.tsx
import type { Metadata } from 'next';
import { RoutesScreen } from './screen';
export const metadata: Metadata = { title: 'Rotas' };
export default function Page() { return <RoutesScreen />; }
```
A casca (`AppShell`) já trata de sessão, proteção, projeto ativo e da cor do módulo
(`<main data-module=…>` segundo o URL). Em `Modal`/`Drawer` passe `module="rotas"` para manter a cor.

## Dados
```tsx
const { projectId } = useProject();                    // projeto ativo (topo)
const q = useApi<Page<Outlet>>(['outlets', projectId, page, search],
  projectId ? `/projects/${projectId}/outlets` : null, { page, limit: 20, search });
const create = useApiMutation(
  (body: CreateOutletBody) => api<Outlet>(`/projects/${projectId}/outlets`, { method: 'POST', body }),
  { invalidate: [['outlets'], ['dashboard']], onSuccess: () => toast.success('Loja criada') },
);
```
- Chaves: `[recurso, projectId, ...filtros]`. Invalide por prefixo (`['outlets']`).
- Envolva o ecrã em `<RequireProject>{(project) => …}</RequireProject>` quando precisa de projeto.
- **Sempre** os 3 estados: `ListSkeleton`/`Skeleton` a carregar, `ErrorState error={q.error} onRetry={q.refetch}`,
  `EmptyState` quando vazio (com ilustração e ação). Erros de mutações → `toast.error('…', e.message)`.
- Tipos de resposta: `src/lib/types.ts`. Corpos de pedido: `src/lib/api-schema.d.ts`
  (`components['schemas']['CreateOutletDto']`) ou interfaces locais equivalentes.
- Diálogos empilhados (ex.: Modal por cima de um Drawer): Esc e Tab só afetam o de cima.
- Ações destrutivas: `const confirm = useConfirm(); if (!(await confirm({ title, danger: true }))) return;`
- Descarregar ficheiros autenticados: `download(path, query, nomePorOmissão)` de `@/lib/api`.

## Permissões (a API devolve 403 — esconda o que o utilizador não pode fazer)
`const { isManager, canEditData, isAdmin, isFieldRep, me, role } = useSession();`
- **isManager** (OWNER, ADMIN, MANAGER): planear/apagar rotas, criar tarefas, beats (escrita), editar/aprovar/apagar lojas,
  mudar estado de encomendas, equipa (listar/adicionar/alterar), criar/editar projetos.
- **canEditData** (+ ANALYST): criar formulários, corrigir/remover/restaurar registos, histórico, esquema, exportar, importações.
- **isAdmin** (OWNER, ADMIN): produtos (criar/editar/apagar), definições da organização, apagar projeto/dataset.
- **Todos**: ver rotas (promotor só as suas), o meu dia, criar lojas (promotor → fica "a aguardar aprovação"),
  check-in/out, presenças, encomendas (promotor vê as suas), cobranças, submeter recolhas, catálogo, painel.

## Componentes (`@/components/ui`)
`Button` (variant: primary | secondary | ghost | danger | accent | soft; size; loading; icon; iconRight),
`ButtonLink` (link com aspeto de botão — nunca `<button>` dentro de `<a>`), `IconButton` (label obrigatório),
`Field` (render-prop com a11y: `<Field label="Nome" error={..}>{(a) => <Input {...a} />}</Field>`), `Input`, `Textarea`,
`Select`, `Switch`, `Badge` (tone: neutral|brand|ok|warn|bad|info|accent), `Card` (interactive), `Skeleton`, `Spinner`,
`ProgressBar`, `AnimatedNumber`, `Avatar`, `PageHeader` (icon, title, description, actions, eyebrow), `EmptyState`
(illustration), `ErrorState`, `ListSkeleton`, `Tabs`, `Pagination`, `SearchInput` (espera 300 ms), `StatTile`, `Table`
(columns, rows, rowKey, onRowClick, rowLabel), `Stagger`, `Modal`, `Drawer`, `useToast`, `useConfirm`.
Domínio (`@/components/domain`): `OrderStatusBadge`, `TaskStatusBadge`, `taskColor`, `OutletStatusBadge`,
`JobStatusBadge`, `RoleBadge`, `RequireProject`. Mapa: `MapView` de `@/components/map` (points, start, startLabel, path, onSelect,
selectedId, circles, height; cores em hex ou `var(--…)`, resolvidas para o SVG). Ilustrações: `Illustration name=…` (box, map, truck, clipboard, team, upload, store,
success, oops, calendar, cart, search, egg).

## Cor e estilo
- Laranja é a marca (`bg-brand`, `text-brand-text`, botão `primary`). Cada módulo tem a sua cor:
  `var(--accent)`, `var(--accent-text)` (texto AA), `var(--accent-soft)` (fundos). Também `var(--m-rotas)`, `--m-lojas`… para
  dar uma cor diferente a cada passo/indicador ("uma cor por instrução").
- Superfícies: `bg-surface`, `bg-surface-2`, `border-line`, texto `text-ink` / `text-ink-2` / `text-ink-3`.
- Estados reservados: `ok`, `warn`, `bad`, `info` (sempre com ícone + texto, nunca só cor).
- Cartões `rounded-2xl border border-line bg-surface shadow-soft`; espaçamento generoso; grelhas responsivas.
- Movimento: subtil e rápido (molas, ≤ 300 ms), listas com entrada em cascata, `whileHover={{ y: -3 }}` em cartões clicáveis.
  `MotionConfig reducedMotion="user"` já respeita "reduzir movimento".
- **Telemóvel primeiro**: tudo funciona a 375 px (o promotor usa telemóvel). A barra inferior ocupa ~80 px (o `main` já tem margem).

## Texto
Português de Moçambique/Portugal: "Guardar", "Cancelar", "Loja", "Promotor", "Encomenda", "Cobrança", "Palavra-passe".
Datas/moeda com `@/lib/format` (`money`, `date`, `dateTime`, `time`, `ago`, `km`, `minutes`, `todayIso`, `int`, `pct`).

## Particularidades da API (medidas)
- Listas paginadas: `{ data, meta: { total, page, limit, pages } }`; registos de datasets: `meta.nextCursor` (paginação por cursor).
- Taxas do painel já vêm em **percentagem** (`completionRate: 48.6`).
- Datas "AAAA-MM-DD" são dias de Maputo. `GET /routes/my-day?date=`, `GET /projects/:id/routes?date=&assigneeId=`.
- Check-in exige `lat`/`lng` (GPS do browser: `navigator.geolocation`); fora do geofence a API aceita mas marca `withinGeofence: false`.
  Check-out sem encomenda nessa visita exige `noOrderReason`.
- Encomenda: preços sempre do catálogo (só `productId`, `quantity`, `discountPct`); erro 400 com "crédito" se exceder o limite;
  a resposta traz `missingMustSell` (avisar o promotor).
- Correção de registo: enviar `lastKnownUpdatedAt` (o `updatedAt` lido); 409 = outro supervisor alterou entretanto.
- Importação: `POST /imports/upload` multipart (campos `projectId`, `kind`, `name` **antes** de `file`); depois sondar `GET /imports/:id`.
- Respostas reais de exemplo: `docs/api-samples.json`. Conta de demonstração: `dono@bucketegg.demo` / `Demo2026Forte`
  (promotor: `joao.mabunda@bucketegg.demo`; supervisora: `ana.machava@…`; analista: `ines.cossa@…`). API: `http://localhost:3000`.

## Verificação obrigatória antes de entregar
1. `pnpm exec tsc --noEmit` — zero erros.
2. `pnpm exec eslint <os seus ficheiros>` — zero erros e zero avisos.
3. Confirmar com `curl` contra `http://localhost:3000` cada pedido novo (método, caminho, corpo, resposta).
4. **Não** correr `next dev`/`next build` (a integração e o teste no browser são feitos pela equipa de QA).
5. Não editar ficheiros partilhados (`src/components/ui`, `src/lib`, `src/components/shell`, `globals.css`, `domain.tsx`);
   se precisar de algo lá, descreva-o no relatório.
