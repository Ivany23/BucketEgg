'use client';

import { AlertTriangle, Lightbulb, Minus, Plus, Send, ShoppingCart, Star, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { AnimatedNumber, Button, EmptyState, Field, IconButton, Modal, SearchInput, Skeleton, Textarea, cn, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { money } from '@/lib/format';
import { useApi, useApiMutation } from '@/lib/query';
import type { CreatedOrder, Page, Product, SuggestedOrder } from '@/lib/types';
import { categoryStyle } from './category';
import { OutletAccount } from './outlet-account';
import { OutletPicker, type OutletRef } from './outlet-picker';
import { lineTotals, orderTotals } from './order-math';

interface CreateOrderBody {
  outletId: string;
  items: { productId: string; quantity: number; discountPct?: number }[];
  notes?: string;
}

interface CartLine {
  product: Product;
  quantity: number;
  discountPct: number;
}

interface CreditErrorBody {
  message: string;
  creditLimit: number;
  balance: number;
  orderTotal: number;
}

const isCreditError = (e: unknown): e is ApiError & { body: CreditErrorBody } =>
  e instanceof ApiError && e.status === 400 && typeof (e.body as Partial<CreditErrorBody> | null)?.creditLimit === 'number';

/** Nova encomenda: loja → produtos → resumo. Preços e IVA vêm sempre do catálogo (a API recalcula). */
export function NewOrderModal({
  open,
  onClose,
  projectId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onCreated: (order: CreatedOrder) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      module="vendas"
      size="xl"
      title="Nova encomenda"
      description="Escolha a loja, junte os produtos e confirme. Os preços e o IVA vêm do catálogo."
    >
      <NewOrderForm projectId={projectId} onCancel={onClose} onCreated={onCreated} />
    </Modal>
  );
}

function StepTitle({ n, color, children, aside }: { n: number; color: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span
        aria-hidden
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white"
        style={{ background: color, boxShadow: `0 4px 12px -4px ${color}` }}
      >
        {n}
      </span>
      <h3 className="flex-1 text-[15px] font-bold text-ink">{children}</h3>
      {aside}
    </div>
  );
}

function NewOrderForm({ projectId, onCancel, onCreated }: { projectId: string; onCancel: () => void; onCreated: (order: CreatedOrder) => void }) {
  const toast = useToast();
  const reduce = useReducedMotion();
  const [outlet, setOutlet] = useState<OutletRef | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ outlet?: string; items?: string }>({});

  // Catálogo completo (pequeno): IVA dos produtos sugeridos e lista Must Sell.
  const catalog = useApi<Page<Product>>(['products', 'lookup'], '/products', { limit: 500 }, { staleTime: 5 * 60_000 });
  const results = useApi<Page<Product>>(['products', 'picker', search], '/products', { search: search.trim() || undefined, limit: 20 });
  const suggestion = useApi<SuggestedOrder>(['suggested', outlet?.id], outlet ? `/outlets/${outlet.id}/suggested-order` : null);

  const byId = useMemo(() => new Map((catalog.data?.data ?? []).map((p) => [p.id, p])), [catalog.data]);
  const inCart = useMemo(() => new Map(cart.map((l) => [l.product.id, l])), [cart]);
  const totals = orderTotals(cart.map((l) => ({ price: l.product.price, taxRate: l.product.taxRate, quantity: l.quantity, discountPct: l.discountPct })));
  const missingMsl = (catalog.data?.data ?? []).filter((p) => p.isMustSell && p.isActive && !inCart.has(p.id));

  const create = useApiMutation((body: CreateOrderBody) => api<CreatedOrder>('/orders', { method: 'POST', body }), {
    invalidate: [['orders'], ['statement'], ['outlets'], ['outlet'], ['suggested'], ['dashboard']],
    onSuccess: (order) => {
      toast.success(`Encomenda ${order.number} registada`, `Total ${money(order.total)} · ${order.items.length} produto(s)`);
      if (order.missingMustSell.length) {
        toast.warn('Faltaram produtos obrigatórios (Must Sell)', order.missingMustSell.map((p) => p.name).join(', '));
      }
      onCreated(order);
    },
    onError: (e) => {
      if (!isCreditError(e)) toast.error('Não foi possível registar a encomenda', e.message);
    },
  });
  const creditError = isCreditError(create.error) ? create.error.body : null;

  const setLine = (product: Product, patch: Partial<Omit<CartLine, 'product'>>) => {
    create.reset();
    setErrors((e) => ({ ...e, items: undefined }));
    setCart((all) => {
      const found = all.find((l) => l.product.id === product.id);
      if (!found) return [...all, { product, quantity: 1, discountPct: 0, ...patch }];
      return all.map((l) => (l.product.id === product.id ? { ...l, ...patch } : l));
    });
  };
  const removeLine = (id: string) => {
    create.reset();
    setCart((all) => all.filter((l) => l.product.id !== id));
  };

  const applySuggestion = () => {
    const items = suggestion.data?.items ?? [];
    const lines: CartLine[] = [];
    for (const s of items) {
      const product = byId.get(s.productId);
      if (product) lines.push({ product, quantity: s.suggestedQuantity, discountPct: inCart.get(s.productId)?.discountPct ?? 0 });
    }
    const keep = cart.filter((l) => !lines.some((n) => n.product.id === l.product.id));
    create.reset();
    setErrors((e) => ({ ...e, items: undefined }));
    setCart([...keep, ...lines]);
    toast.info('Sugestão aplicada', `${lines.length} produto(s) no carrinho. Ajuste as quantidades se precisar.`);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!outlet) next.outlet = 'Escolha a loja.';
    if (!cart.length) next.items = 'Junte pelo menos um produto.';
    else if (cart.some((l) => !(l.quantity > 0))) next.items = 'Todas as quantidades têm de ser maiores que zero.';
    else if (cart.some((l) => l.discountPct < 0 || l.discountPct > 100)) next.items = 'O desconto tem de estar entre 0% e 100%.';
    setErrors(next);
    if (Object.keys(next).length || !outlet) return;
    create.mutate({
      outletId: outlet.id,
      items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity, ...(l.discountPct > 0 ? { discountPct: l.discountPct } : {}) })),
      notes: notes.trim() || undefined,
    });
  };

  const suggestCount = (suggestion.data?.items ?? []).filter((s) => byId.has(s.productId)).length;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {/* 1. Loja */}
      <section>
        <StepTitle n={1} color="var(--m-lojas)">
          Loja
        </StepTitle>
        <div className="grid gap-3 lg:grid-cols-2">
          <OutletPicker
            projectId={projectId}
            label="Loja que encomenda"
            required
            value={outlet}
            showBalance
            hint="Só aparecem lojas ativas."
            error={errors.outlet}
            onChange={(o) => {
              create.reset();
              setOutlet(o);
              setErrors((er) => ({ ...er, outlet: undefined }));
            }}
          />
          {outlet ? <OutletAccount outletId={outlet.id} extra={totals.total} /> : null}
        </div>
        <AnimatePresence>
          {outlet && suggestion.data && suggestCount > 0 ? (
            <motion.div
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div
                className="mt-3 flex flex-col gap-3 rounded-2xl border p-3.5 sm:flex-row sm:items-center"
                style={{ background: 'var(--m-dia-soft)', borderColor: 'color-mix(in oklab, var(--m-dia) 40%, transparent)' }}
              >
                <Lightbulb className="size-5 shrink-0" style={{ color: 'var(--m-dia-text)' }} aria-hidden />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-bold text-ink">Sugestão para esta loja</p>
                  <p className="text-ink-2">
                    {suggestion.data.basedOnOrders > 0
                      ? `Com base nas últimas ${suggestion.data.basedOnOrders} encomenda(s) e na lista Must Sell: `
                      : 'Produtos obrigatórios (Must Sell): '}
                    {suggestion.data.items
                      .slice(0, 4)
                      .map((s) => `${s.name} ×${s.suggestedQuantity}`)
                      .join(', ')}
                    {suggestion.data.items.length > 4 ? ` e mais ${suggestion.data.items.length - 4}` : ''}.
                  </p>
                </div>
                <Button size="sm" variant="secondary" icon={Lightbulb} onClick={applySuggestion} disabled={catalog.isPending}>
                  Usar sugestão ({suggestCount})
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* 2. Produtos */}
        <section aria-labelledby="order-products">
          <StepTitle n={2} color="var(--m-produtos)">
            <span id="order-products">Produtos</span>
          </StepTitle>
          <SearchInput value={search} onChange={setSearch} label="Pesquisar produtos" placeholder="Pesquisar por nome, SKU ou marca…" />
          <div className="mt-3">
            {results.isPending ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" aria-busy="true" aria-label="A carregar produtos">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : results.isError ? (
              <p role="alert" className="rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad">
                {results.error.message}{' '}
                <button type="button" className="font-semibold underline" onClick={() => void results.refetch()}>
                  Tentar de novo
                </button>
              </p>
            ) : results.data.data.length === 0 ? (
              <EmptyState compact illustration="search" title="Nenhum produto encontrado" description={search ? `Nada para "${search}".` : 'O catálogo está vazio.'} />
            ) : (
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {results.data.data.map((p, i) => (
                  <motion.li
                    key={p.id}
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 10) * 0.03, type: 'spring', stiffness: 300, damping: 26 }}
                  >
                    <PickCard
                      product={p}
                      line={inCart.get(p.id)}
                      onAdd={() => setLine(p, { quantity: (inCart.get(p.id)?.quantity ?? 0) + 1 })}
                      onQty={(q) => (q <= 0 ? removeLine(p.id) : setLine(p, { quantity: q }))}
                    />
                  </motion.li>
                ))}
              </ul>
            )}
            {results.data && results.data.meta.total > results.data.data.length ? (
              <p className="mt-2 text-xs text-ink-3">
                A mostrar {results.data.data.length} de {results.data.meta.total}. Pesquise para encontrar outros.
              </p>
            ) : null}
          </div>
        </section>

        {/* 3. Resumo */}
        <section aria-labelledby="order-cart" className="lg:sticky lg:top-0 lg:self-start">
          <StepTitle
            n={3}
            color="var(--m-vendas)"
            aside={
              cart.length ? (
                <button
                  type="button"
                  onClick={() => {
                    create.reset();
                    setCart([]);
                  }}
                  className="text-xs font-semibold text-ink-3 hover:text-bad"
                >
                  Limpar
                </button>
              ) : null
            }
          >
            <span id="order-cart">Resumo</span>
          </StepTitle>
          <div className="rounded-2xl border border-line bg-surface-2/40">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-8 text-center">
                <span className="inline-flex size-12 items-center justify-center rounded-2xl" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}>
                  <ShoppingCart className="size-6" aria-hidden />
                </span>
                <p className="mt-3 text-sm font-semibold text-ink">O carrinho está vazio</p>
                <p className="mt-1 text-xs text-ink-3">Toque num produto para o juntar{outlet ? ' ou use a sugestão' : ''}.</p>
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-line" aria-label="Produtos na encomenda">
                <AnimatePresence initial={false}>
                  {cart.map((l) => (
                    <motion.li
                      key={l.product.id}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, x: -16 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    >
                      <CartRow line={l} onChange={(patch) => setLine(l.product, patch)} onRemove={() => removeLine(l.product.id)} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
            <dl className="flex flex-col gap-1 border-t border-line px-4 py-3 text-sm">
              <TotalRow label="Subtotal" value={totals.subtotal} />
              <TotalRow label="Desconto" value={-totals.discount} />
              <TotalRow label="IVA" value={totals.tax} />
              <div className="mt-1 flex items-baseline justify-between border-t border-line pt-2">
                <dt className="font-bold text-ink">Total</dt>
                <dd className="text-xl font-extrabold text-[var(--accent-text)]">
                  <AnimatedNumber value={totals.total} format={money} />
                </dd>
              </div>
            </dl>
          </div>
          {errors.items ? (
            <p role="alert" className="mt-2 text-xs font-medium text-bad">
              {errors.items}
            </p>
          ) : null}

          {missingMsl.length > 0 && cart.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-warn/40 bg-warn-soft/60 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-bold text-ink">
                <Star className="size-4 text-warn" fill="currentColor" aria-hidden />
                Faltam produtos Must Sell
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {missingMsl.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setLine(p, { quantity: 1 })}
                      className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:border-[var(--accent)]"
                    >
                      <Plus className="size-3" aria-hidden />
                      {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Field label="Notas" className="mt-4" hint="Ex.: horário de entrega, pessoa de contacto.">
            {(a) => <Textarea {...a} rows={2} maxLength={1000} className="min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} />}
          </Field>
        </section>
      </div>

      <AnimatePresence>
        {creditError ? (
          <motion.div
            role="alert"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex gap-3 rounded-2xl border border-bad/40 bg-bad-soft p-4 text-sm"
          >
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink">{creditError.message}</p>
              <p className="mt-1 text-ink-2">
                Dívida atual {money(creditError.balance)} + esta encomenda {money(creditError.orderTotal)} = {money(creditError.balance + creditError.orderTotal)},
                acima do limite de {money(creditError.creditLimit)}. Reduza a encomenda em pelo menos{' '}
                <strong className="text-ink">{money(creditError.balance + creditError.orderTotal - creditError.creditLimit)}</strong> ou registe primeiro uma cobrança.
              </p>
            </div>
            <IconButton label="Fechar aviso" icon={X} onClick={() => create.reset()} />
          </motion.div>
        ) : create.isError ? (
          <p role="alert" className="rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad">
            {create.error.message}
          </p>
        ) : null}
      </AnimatePresence>

      <div className="sticky -bottom-5 z-10 -mx-5 -mb-5 flex flex-wrap items-center gap-2 border-t border-line bg-surface px-5 py-4 sm:-mx-6 sm:px-6">
        <p className="mr-auto text-sm text-ink-2">
          {cart.length} produto(s) ·{' '}
          <strong className="text-ink">
            <AnimatedNumber value={totals.total} format={money} />
          </strong>
        </p>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="accent" icon={Send} loading={create.isPending}>
          Submeter encomenda
        </Button>
      </div>
    </form>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-ink-2">{label}</dt>
      <dd className={cn('font-semibold', value < 0 ? 'text-ok' : 'text-ink')}>
        {value < 0 ? '− ' : ''}
        <AnimatedNumber value={Math.abs(value)} format={money} />
      </dd>
    </div>
  );
}

/** Cartão de produto no seletor (toque = junta 1; depois aparece o contador). */
function PickCard({ product, line, onAdd, onQty }: { product: Product; line?: CartLine; onAdd: () => void; onQty: (q: number) => void }) {
  const cat = categoryStyle(product.category);
  const Icon = cat.icon;
  return (
    <div
      className={cn('relative flex h-full flex-col overflow-hidden rounded-2xl border bg-surface transition-shadow', line ? 'shadow-soft' : 'border-line hover:shadow-soft')}
      style={line ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)' } : undefined}
    >
      <span aria-hidden className="h-1.5" style={{ background: cat.color }} />
      <button type="button" onClick={onAdd} className="flex flex-1 flex-col items-start gap-1 p-3 text-left" aria-label={`Juntar ${product.name} (${money(product.price)})`}>
        <span className="flex w-full items-start justify-between gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-lg" style={{ background: cat.soft, color: cat.text }}>
            <Icon className="size-4" aria-hidden />
          </span>
          {product.isMustSell ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-warn-soft px-1.5 py-0.5 text-[10px] font-bold text-warn" title="Must Sell (obrigatório)">
              <Star className="size-3" fill="currentColor" aria-hidden />
              MSL
            </span>
          ) : null}
        </span>
        <span className="line-clamp-2 text-[13px] leading-tight font-bold text-ink">{product.name}</span>
        <span className="font-mono text-[10px] text-ink-3">
          {product.sku} · {product.unit}
        </span>
        <span className="mt-auto pt-1 text-sm font-extrabold text-ink tabular-nums">{money(product.price)}</span>
      </button>
      {line ? (
        <div className="border-t border-line p-1.5">
          <QtyStepper value={line.quantity} onChange={onQty} label={product.name} />
        </div>
      ) : null}
    </div>
  );
}

function QtyStepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center justify-between gap-1" role="group" aria-label={`Quantidade de ${label}`}>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        aria-label={value <= 1 ? `Tirar ${label}` : `Menos uma unidade de ${label}`}
        className="inline-flex size-8 items-center justify-center rounded-lg bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink"
      >
        {value <= 1 ? <Trash2 className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={value}
        aria-label={`Quantidade de ${label}`}
        onChange={(e) => {
          const v = Math.floor(Number(e.target.value));
          onChange(Number.isFinite(v) && v > 0 ? v : 1);
        }}
        className="h-8 w-12 min-w-0 rounded-lg border border-line bg-surface text-center text-sm font-bold text-ink tabular-nums outline-none focus:border-[var(--accent)] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label={`Mais uma unidade de ${label}`}
        className="inline-flex size-8 items-center justify-center rounded-lg text-[#10141c] hover:brightness-105"
        style={{ background: 'var(--accent)' }}
      >
        <Plus className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

function CartRow({ line, onChange, onRemove }: { line: CartLine; onChange: (p: Partial<Omit<CartLine, 'product'>>) => void; onRemove: () => void }) {
  const { product } = line;
  const t = lineTotals({ price: product.price, taxRate: product.taxRate, quantity: line.quantity, discountPct: line.discountPct });
  const cat = categoryStyle(product.category);
  return (
    <div className="px-3.5 py-3">
      <div className="flex items-start gap-2">
        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: cat.color }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{product.name}</p>
          <p className="text-[11px] text-ink-3">
            <span className="font-mono">{product.sku}</span> · {money(product.price)} / {product.unit} · IVA {product.taxRate}%
          </p>
        </div>
        <IconButton label={`Tirar ${product.name}`} icon={Trash2} tone="danger" className="-mt-1 -mr-1 size-8" onClick={onRemove} />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="w-[120px]">
          <QtyStepper value={line.quantity} onChange={(q) => (q <= 0 ? onRemove() : onChange({ quantity: q }))} label={product.name} />
        </div>
        <label className="flex items-center gap-1 text-xs text-ink-3">
          <span className="sr-only">Desconto em percentagem de {product.name}</span>
          <span aria-hidden>Desc.</span>
          <span className="relative">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={0.5}
              value={line.discountPct || ''}
              placeholder="0"
              onChange={(e) => {
                const v = Number(e.target.value);
                onChange({ discountPct: Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0 });
              }}
              className="h-8 w-16 rounded-lg border border-line bg-surface pr-5 pl-2 text-right text-sm text-ink tabular-nums outline-none focus:border-[var(--accent)]"
            />
            <span aria-hidden className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-ink-3">
              %
            </span>
          </span>
        </label>
        <p className="ml-auto text-right text-sm font-bold text-ink tabular-nums">
          {money(t.total)}
          {t.discount > 0 ? <span className="block text-[11px] font-medium text-ok">− {money(t.discount)}</span> : null}
        </p>
      </div>
    </div>
  );
}
