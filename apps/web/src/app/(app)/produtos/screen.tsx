'use client';

import { Banknote, EyeOff, LayoutGrid, List, Package, Pencil, Plus, RotateCcw, Star, Tags, Trash2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';
import { categoryStyle } from '@/components/sales/category';
import { ProductFormModal } from '@/components/sales/product-form-modal';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeader,
  Pagination,
  SearchInput,
  Skeleton,
  StatTile,
  Switch,
  Table,
  cn,
  useConfirm,
  useToast,
  type Column,
} from '@/components/ui';
import { api } from '@/lib/api';
import { int, money } from '@/lib/format';
import { useApi, useApiMutation } from '@/lib/query';
import { useSession } from '@/lib/session';
import type { Page, Product } from '@/lib/types';

const PAGE_SIZE = 24;
type View = 'grid' | 'table';

export function ProductsScreen() {
  const { isAdmin } = useSession();
  const toast = useToast();
  const confirm = useConfirm();
  const reduce = useReducedMotion();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [inactiveToggle, setInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<View>('grid');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const showInactive = isAdmin && inactiveToggle;

  const list = useApi<Page<Product>>(['products', 'catalog', page, search, category, showInactive], '/products', {
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
    category: category || undefined,
    includeInactive: showInactive || undefined,
  });
  // Catálogo inteiro (pequeno) para as categorias e os indicadores.
  const all = useApi<Page<Product>>(['products', 'all', showInactive], '/products', { limit: 500, includeInactive: showInactive || undefined });

  const overview = useMemo(() => {
    const items = all.data?.data ?? [];
    const cats = new Map<string, number>();
    for (const p of items) if (p.category) cats.set(p.category, (cats.get(p.category) ?? 0) + 1);
    const active = items.filter((p) => p.isActive);
    return {
      categories: [...cats.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt')),
      active: active.length,
      inactive: items.length - active.length,
      mustSell: active.filter((p) => p.isMustSell).length,
      avgPrice: active.length ? active.reduce((s, p) => s + p.price, 0) / active.length : 0,
    };
  }, [all.data]);

  const remove = useApiMutation((p: Product) => api<{ deleted: boolean; deactivated?: boolean }>(`/products/${p.id}`, { method: 'DELETE' }), {
    invalidate: [['products']],
    onSuccess: (r, p) => {
      if (r.deleted) toast.success('Produto apagado', p.name);
      else toast.info('Produto desativado em vez de apagado', `${p.name} já tem vendas registadas; o histórico das encomendas mantém-se.`);
    },
    onError: (e) => toast.error('Não foi possível apagar o produto', e.message),
  });
  const reactivate = useApiMutation((p: Product) => api<Product>(`/products/${p.id}`, { method: 'PATCH', body: { isActive: true } }), {
    invalidate: [['products']],
    onSuccess: (p) => toast.success('Produto reativado', p.name),
    onError: (e) => toast.error('Não foi possível reativar o produto', e.message),
  });

  const askDelete = async (p: Product) => {
    const ok = await confirm({
      title: `Apagar "${p.name}"?`,
      description: 'Se o produto já tiver sido vendido, é desativado em vez de apagado, para manter o histórico das encomendas.',
      confirmLabel: 'Apagar produto',
      danger: true,
    });
    if (ok) remove.mutate(p);
  };

  const actions = isAdmin
    ? {
        onEdit: (p: Product) => setEditing(p),
        onDelete: (p: Product) => void askDelete(p),
        onReactivate: (p: Product) => reactivate.mutate(p),
        busyId: (remove.isPending && remove.variables?.id) || (reactivate.isPending && reactivate.variables?.id) || null,
      }
    : null;

  const filtersActive = !!search || !!category;
  const rows = list.data?.data ?? [];

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Produto',
      cell: (p) => {
        const c = categoryStyle(p.category);
        return (
          <span className={cn('flex items-center gap-3', !p.isActive && 'opacity-60')}>
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: c.soft, color: c.text }}>
              <c.icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-ink">{p.name}</span>
              <span className="font-mono text-[11px] text-ink-3">{p.sku}</span>
            </span>
          </span>
        );
      },
    },
    { key: 'brand', header: 'Marca', hideOnMobile: true, cell: (p) => <span className="text-ink-2">{p.brand || '—'}</span> },
    { key: 'category', header: 'Categoria', cell: (p) => <CategoryChip category={p.category} /> },
    { key: 'unit', header: 'Unid.', hideOnMobile: true, cell: (p) => <span className="font-mono text-xs text-ink-2">{p.unit}</span> },
    { key: 'price', header: 'Preço', align: 'right', cell: (p) => <span className="font-bold">{money(p.price)}</span> },
    { key: 'tax', header: 'IVA', align: 'right', hideOnMobile: true, cell: (p) => <span className="text-ink-2">{p.taxRate}%</span> },
    {
      key: 'flags',
      header: 'Estado',
      cell: (p) => (
        <span className="flex flex-wrap gap-1">
          {p.isMustSell ? <MustSellBadge /> : null}
          {p.isActive ? (
            <Badge tone="ok">Ativo</Badge>
          ) : (
            <Badge tone="neutral" icon={EyeOff}>
              Inativo
            </Badge>
          )}
        </span>
      ),
    },
    ...(actions
      ? [
          {
            key: 'actions',
            header: 'Ações',
            align: 'right' as const,
            cell: (p: Product) => <AdminButtons product={p} {...actions} />,
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        icon={Package}
        title="Produtos"
        description={isAdmin ? 'Catálogo, preços, IVA e a lista Must Sell usados nas encomendas.' : 'Catálogo de produtos, preços e a lista Must Sell (produtos obrigatórios).'}
        actions={
          <>
            <div role="group" aria-label="Vista" className="flex rounded-xl bg-surface-2 p-1">
              {(
                [
                  ['grid', LayoutGrid, 'Cartões'],
                  ['table', List, 'Tabela'],
                ] as const
              ).map(([id, Icon, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={view === id}
                  onClick={() => setView(id)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold transition-colors',
                    view === id ? 'shadow-soft bg-surface text-ink' : 'text-ink-3 hover:text-ink-2',
                  )}
                >
                  <Icon className="size-4" style={view === id ? { color: 'var(--accent-text)' } : undefined} aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            {isAdmin ? (
              <Button variant="accent" icon={Plus} onClick={() => setEditing('new')}>
                Novo produto
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile index={0} label="Produtos ativos" value={overview.active} format={(v) => int(Math.round(v))} icon={Package} color="var(--m-produtos)" hint={overview.inactive ? `${overview.inactive} inativo(s)` : 'Disponíveis para encomenda'} />
        <StatTile index={1} label="Must Sell" value={overview.mustSell} format={(v) => int(Math.round(v))} icon={Star} color="var(--m-dia)" hint="Obrigatórios em cada loja" />
        <StatTile index={2} label="Categorias" value={overview.categories.length} format={(v) => int(Math.round(v))} icon={Tags} color="var(--m-beats)" />
        <StatTile index={3} label="Preço médio" value={overview.avgPrice} format={money} icon={Banknote} color="var(--m-lojas)" hint="Sem IVA" />
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            className="sm:max-w-sm sm:flex-1"
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            label="Pesquisar produtos"
            placeholder="Pesquisar por nome, SKU ou marca…"
          />
          {isAdmin ? (
            <div className="sm:ml-auto">
              <Switch
                checked={inactiveToggle}
                onChange={(v) => {
                  setInactive(v);
                  setPage(1);
                }}
                label="Mostrar inativos"
              />
            </div>
          ) : null}
        </div>
        {overview.categories.length ? (
          <div role="group" aria-label="Filtrar por categoria" className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <CategoryFilter label="Todas" count={all.data?.data.length} active={!category} onClick={() => (setCategory(''), setPage(1))} />
            {overview.categories.map(([c, n]) => (
              <CategoryFilter key={c} label={c} count={n} category={c} active={category === c} onClick={() => (setCategory(category === c ? '' : c), setPage(1))} />
            ))}
          </div>
        ) : all.isPending ? (
          <div className="flex gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-28 rounded-full" />
            ))}
          </div>
        ) : null}
      </div>

      {list.isPending ? (
        view === 'grid' ? (
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true" aria-label="A carregar produtos">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-52 rounded-2xl" />
            ))}
          </div>
        ) : (
          <Skeleton className="h-96 rounded-2xl" />
        )
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          illustration="box"
          title={filtersActive ? 'Nenhum produto encontrado' : 'O catálogo está vazio'}
          description={
            filtersActive
              ? 'Experimente outra pesquisa ou categoria.'
              : isAdmin
                ? 'Junte os produtos que a equipa vende: preço, IVA e se são obrigatórios (Must Sell).'
                : 'Ainda não há produtos. Peça a um administrador para criar o catálogo.'
          }
          action={
            filtersActive ? (
              <Button
                onClick={() => {
                  setSearch('');
                  setCategory('');
                  setPage(1);
                }}
              >
                Limpar filtros
              </Button>
            ) : isAdmin ? (
              <Button variant="accent" icon={Plus} onClick={() => setEditing('new')}>
                Novo produto
              </Button>
            ) : null
          }
        />
      ) : view === 'grid' ? (
        <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((p, i) => (
            <motion.li
              key={p.id}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.035, type: 'spring', stiffness: 260, damping: 24 }}
              className="h-full"
            >
              <ProductCard product={p} actions={actions} />
            </motion.li>
          ))}
        </ul>
      ) : (
        <Table columns={columns} rows={rows} rowKey={(p) => p.id} />
      )}
      {list.data && rows.length ? <Pagination page={page} pages={list.data.meta.pages ?? 1} total={list.data.meta.total} onChange={setPage} /> : null}

      {isAdmin ? (
        <ProductFormModal
          open={editing !== null}
          onClose={() => setEditing(null)}
          product={editing === 'new' ? null : editing}
          categories={overview.categories.map(([c]) => c)}
        />
      ) : null}
    </>
  );
}

interface AdminActions {
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
  onReactivate: (p: Product) => void;
  busyId: string | null;
}

function AdminButtons({ product, onEdit, onDelete, onReactivate, busyId }: { product: Product } & AdminActions) {
  const busy = busyId === product.id;
  return (
    <span className="inline-flex items-center gap-0.5">
      {!product.isActive ? <IconButton label={`Reativar ${product.name}`} icon={RotateCcw} disabled={busy} onClick={() => onReactivate(product)} /> : null}
      <IconButton label={`Editar ${product.name}`} icon={Pencil} disabled={busy} onClick={() => onEdit(product)} />
      <IconButton label={`Apagar ${product.name}`} icon={Trash2} tone="danger" disabled={busy} onClick={() => onDelete(product)} />
    </span>
  );
}

function MustSellBadge({ big }: { big?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap text-[#3b2300]',
        big ? 'px-2.5 py-1 text-xs shadow-[0_4px_12px_-4px_rgba(245,158,11,0.8)]' : 'px-2 py-0.5 text-[11px]',
      )}
      style={{ background: 'linear-gradient(135deg, #fde047, #f59e0b)' }}
    >
      <Star className="size-3.5" fill="currentColor" aria-hidden />
      Must Sell
    </span>
  );
}

function CategoryChip({ category }: { category: string | null }) {
  if (!category) return <span className="text-xs text-ink-3">Sem categoria</span>;
  const c = categoryStyle(category);
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap" style={{ background: c.soft, color: c.text }}>
      <c.icon className="size-3.5" aria-hidden />
      {category}
    </span>
  );
}

function CategoryFilter({ label, count, category, active, onClick }: { label: string; count?: number; category?: string; active: boolean; onClick: () => void }) {
  const c = category ? categoryStyle(category) : null;
  const color = c?.color ?? 'var(--accent)';
  const Icon = c?.icon ?? LayoutGrid;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-[background,color,border,box-shadow]',
        active ? 'border-transparent text-ink' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
      )}
      style={active ? { background: `color-mix(in oklab, ${color} 18%, var(--surface))`, boxShadow: `inset 0 0 0 2px ${color}` } : undefined}
    >
      <Icon className="size-4" style={{ color: c?.text ?? 'var(--accent-text)' }} aria-hidden />
      {label}
      {count !== undefined ? <span className="rounded-full bg-surface-2 px-1.5 text-[11px] text-ink-3 tabular-nums">{count}</span> : null}
    </button>
  );
}

function ProductCard({ product: p, actions }: { product: Product; actions: AdminActions | null }) {
  const reduce = useReducedMotion();
  const c = categoryStyle(p.category);
  const priceWithTax = p.price * (1 + p.taxRate / 100);
  return (
    <motion.article
      whileHover={reduce ? undefined : { y: -3 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      aria-label={p.name}
      className={cn(
        'shadow-soft group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-surface transition-shadow hover:shadow-lift',
        p.isMustSell && p.isActive ? 'border-[color-mix(in_oklab,#f59e0b_45%,var(--border))]' : 'border-line',
        !p.isActive && 'opacity-60 saturate-50',
      )}
    >
      {/* Faixa colorida da categoria */}
      <div className="relative h-20 overflow-hidden" style={{ background: `linear-gradient(135deg, ${c.soft}, color-mix(in oklab, ${c.color} 28%, ${c.soft}))` }}>
        <span aria-hidden className="absolute -right-6 -bottom-8 size-28 rounded-full opacity-20 transition-transform duration-500 group-hover:scale-110" style={{ background: c.color }} />
        <span className="absolute top-3 left-3 inline-flex size-11 items-center justify-center rounded-2xl bg-surface/85 shadow-sm backdrop-blur" style={{ color: c.text }}>
          <c.icon className="size-6" aria-hidden />
        </span>
        <span className="absolute top-3 right-3 flex flex-col items-end gap-1">
          {p.isMustSell ? <MustSellBadge big /> : null}
          {!p.isActive ? (
            <Badge tone="neutral" icon={EyeOff}>
              Inativo
            </Badge>
          ) : null}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoryChip category={p.category} />
          {p.brand ? <span className="text-xs font-medium text-ink-3">{p.brand}</span> : null}
        </div>
        <h3 className="mt-2 line-clamp-2 text-[15px] leading-snug font-bold text-ink">{p.name}</h3>
        <p className="mt-0.5 font-mono text-xs text-ink-3">
          {p.sku} · <span title="Unidade de venda">{p.unit}</span>
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div>
            <p className="text-lg leading-none font-extrabold text-ink tabular-nums">{money(p.price)}</p>
            <p className="mt-1 text-[11px] text-ink-3">
              IVA {p.taxRate}% · {money(priceWithTax)} c/ IVA
            </p>
          </div>
          {actions ? <AdminButtons product={p} {...actions} /> : null}
        </div>
      </div>
    </motion.article>
  );
}
