'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, Minus, PackagePlus, Plus, Sparkles, Star, Trash2, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnimatedNumber, Badge, Button, Field, Modal, SearchInput, Skeleton, Textarea, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { money } from '@/lib/format';
import { useApi, useApiMutation } from '@/lib/query';
import type { CreatedOrder, Page, Product, Statement, SuggestedOrder } from '@/lib/types';
import { Notice, stepColor } from './shared';

interface Line {
  productId: string;
  name: string;
  sku: string;
  unit: string | null;
  price: number;
  taxRate: number;
  isMustSell: boolean;
  qty: number;
  disc: number;
  /** Motivo da sugestão (ex.: "produto obrigatório (MSL)"). */
  reason?: string;
}

interface CreateOrderBody {
  outletId: string;
  visitId?: string;
  items: { productId: string; quantity: number; discountPct: number }[];
  notes?: string;
}

interface CreditErrorBody {
  creditLimit?: number;
  balance?: number;
  orderTotal?: number;
}

const lineTotals = (l: Line) => {
  const gross = l.price * l.qty;
  const discount = gross * (l.disc / 100);
  const tax = (gross - discount) * (l.taxRate / 100);
  return { gross, discount, tax, total: gross - discount + tax };
};

const fromProduct = (p: Product, qty = 1, reason?: string): Line => ({
  productId: p.id,
  name: p.name,
  sku: p.sku,
  unit: p.unit,
  price: p.price,
  taxRate: p.taxRate,
  isMustSell: p.isMustSell,
  qty,
  disc: 0,
  reason,
});

const clampNum = (v: number, min: number, max: number) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min);

export function OrderModal({
  open,
  onClose,
  outletId,
  outletName,
  visitId,
  onRequestPayment,
}: {
  open: boolean;
  onClose: () => void;
  outletId: string;
  outletName: string;
  visitId?: string;
  onRequestPayment?: () => void;
}) {
  const toast = useToast();
  const reduce = useReducedMotion();
  const catalog = useApi<Page<Product>>(['products', 'catalog'], open ? '/products' : null, { limit: 200 });
  const suggested = useApi<SuggestedOrder>(['suggested-order', outletId], open ? `/outlets/${outletId}/suggested-order` : null);
  const statement = useApi<Statement>(['statement', outletId], open ? `/outlets/${outletId}/statement` : null);
  const [search, setSearch] = useState('');
  const results = useApi<Page<Product>>(['products', 'search', search], open && search ? '/products' : null, { search, limit: 20 });

  // Linhas editadas pelo promotor; até lá, mostra a sugestão (sem copiar para estado num efeito).
  const [edited, setEdited] = useState<Line[] | null>(null);
  const [notes, setNotes] = useState('');
  const [created, setCreated] = useState<CreatedOrder | null>(null);
  const [creditError, setCreditError] = useState<CreditErrorBody | null>(null);

  const byId = useMemo(() => new Map((catalog.data?.data ?? []).map((p) => [p.id, p])), [catalog.data]);
  const initial = useMemo<Line[] | null>(() => {
    if (!suggested.data || !catalog.data) return null;
    return suggested.data.items.flatMap((s) => {
      const p = byId.get(s.productId);
      if (!p) return [];
      return [fromProduct(p, Math.max(1, Math.round(s.suggestedQuantity)), s.reason)];
    });
  }, [suggested.data, catalog.data, byId]);
  const lines = edited ?? initial ?? [];
  const ready = initial !== null || edited !== null;
  const prefillFailed = !ready && (suggested.isError || catalog.isError);

  const update = (fn: (all: Line[]) => Line[]) => {
    setCreditError(null);
    setEdited(fn(lines));
  };
  const setLine = (id: string, patch: Partial<Line>) => update((all) => all.map((l) => (l.productId === id ? { ...l, ...patch } : l)));
  const remove = (id: string) => update((all) => all.filter((l) => l.productId !== id));
  const add = (p: Product) => {
    if (lines.some((l) => l.productId === p.id)) return;
    update((all) => [...all, fromProduct(p)]);
  };

  const totals = lines.reduce(
    (acc, l) => {
      const t = lineTotals(l);
      return { gross: acc.gross + t.gross, discount: acc.discount + t.discount, tax: acc.tax + t.tax, total: acc.total + t.total };
    },
    { gross: 0, discount: 0, tax: 0, total: 0 },
  );

  const available = statement.data && statement.data.outlet.creditLimit > 0 ? statement.data.outlet.creditLimit - statement.data.balance : null;
  const overLimit = available !== null && totals.total > available + 0.005;

  const create = useApiMutation((body: CreateOrderBody) => api<CreatedOrder>('/orders', { method: 'POST', body }), {
    invalidate: [['visits'], ['orders'], ['statement'], ['outlets'], ['dashboard'], ['my-day']],
    onSuccess: (order) => {
      setCreated(order);
      toast.success(`Encomenda ${order.number} registada`, `${outletName} · ${money(order.total)}`);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 400 && /cr[ée]dito/i.test(e.message)) {
        setCreditError((e.body as CreditErrorBody | undefined) ?? {});
      } else {
        toast.error('Não foi possível registar a encomenda', e.message);
      }
    },
  });

  const invalidLine = lines.find((l) => !(l.qty > 0) || l.disc < 0 || l.disc > 100);
  const submit = () => {
    if (!lines.length || invalidLine) return;
    create.mutate({
      outletId,
      visitId,
      items: lines.map((l) => ({ productId: l.productId, quantity: l.qty, discountPct: l.disc })),
      notes: notes.trim() || undefined,
    });
  };

  const pickable = (search ? results.data?.data : catalog.data?.data)?.filter((p) => p.isActive && !lines.some((l) => l.productId === p.id)) ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      module="vendas"
      title={created ? 'Encomenda registada' : 'Registar encomenda'}
      description={outletName}
      footer={
        created ? (
          <Button variant="primary" onClick={onClose}>
            Concluir
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" icon={CheckCircle2} loading={create.isPending} disabled={!lines.length || !!invalidLine} onClick={submit}>
              Registar · {money(totals.total)}
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="flex flex-col gap-4">
          <motion.div
            initial={reduce ? false : { scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="flex items-center gap-4 rounded-2xl bg-ok-soft p-4"
          >
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-ok text-white dark:text-[#06210f]">
              <CheckCircle2 className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-lg font-extrabold text-ink">{created.number}</p>
              <p className="text-sm text-ink-2">
                {created.items.length} {created.items.length === 1 ? 'produto' : 'produtos'} · total {money(created.total)}
              </p>
            </div>
          </motion.div>
          {created.missingMustSell.length ? (
            <Notice tone="warn" title="Produtos obrigatórios (Must Sell) que ficaram de fora">
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {created.missingMustSell.map((p) => (
                  <li key={p.id}>
                    <Badge tone="warn" icon={Star}>
                      {p.name}
                    </Badge>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs">Sugira-os ao cliente na próxima visita.</p>
            </Notice>
          ) : (
            <Notice tone="ok" title="Todos os produtos obrigatórios estão na encomenda" />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {statement.data ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniStat label="Saldo em dívida" value={money(statement.data.balance)} color="var(--m-vendas)" />
              <MiniStat label="Limite de crédito" value={statement.data.outlet.creditLimit > 0 ? money(statement.data.outlet.creditLimit) : 'Sem limite'} color="var(--m-rotas)" />
              <MiniStat label="Disponível" value={available !== null ? money(available) : '—'} color={overLimit ? 'var(--bad)' : 'var(--ok)'} />
            </div>
          ) : null}

          {creditError ? (
            <Notice
              tone="bad"
              title="Limite de crédito excedido para esta loja"
              action={
                onRequestPayment ? (
                  <Button size="sm" variant="secondary" icon={Wallet} onClick={onRequestPayment}>
                    Registar cobrança
                  </Button>
                ) : null
              }
            >
              {creditError.creditLimit !== undefined ? (
                <>
                  Limite {money(creditError.creditLimit)} · saldo atual {money(creditError.balance)} · esta encomenda {money(creditError.orderTotal)}. Reduza
                  as quantidades ou registe primeiro uma cobrança.
                </>
              ) : (
                'Reduza as quantidades ou registe primeiro uma cobrança.'
              )}
            </Notice>
          ) : overLimit ? (
            <Notice tone="warn" title="Esta encomenda ultrapassa o crédito disponível">
              A API vai recusá-la. Reduza as quantidades ou registe uma cobrança.
            </Notice>
          ) : null}

          <section aria-labelledby="order-lines">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 id="order-lines" className="text-sm font-bold text-ink">
                Produtos
              </h3>
              {suggested.data && suggested.data.items.length && !edited ? (
                <Badge tone="accent" icon={Sparkles}>
                  Sugestão{suggested.data.basedOnOrders ? ` (últimas ${suggested.data.basedOnOrders} encomendas)` : ' (Must Sell)'}
                </Badge>
              ) : null}
            </div>
            {!ready && !prefillFailed ? (
              <div className="flex flex-col gap-2" aria-busy="true" aria-label="A preparar a sugestão">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            ) : lines.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-3">
                {prefillFailed ? 'Não foi possível carregar a sugestão. ' : ''}Adicione produtos do catálogo abaixo.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {lines.map((l, i) => {
                    const t = lineTotals(l);
                    return (
                      <motion.li
                        key={l.productId}
                        layout={!reduce}
                        initial={reduce ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        className="relative overflow-hidden rounded-2xl border border-line bg-surface p-3 pl-4"
                      >
                        <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: stepColor(i) }} />
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-ink">{l.name}</p>
                            <p className="mt-0.5 text-xs text-ink-3">
                              {l.sku}
                              {l.unit ? ` · ${l.unit}` : ''} · {money(l.price)} · IVA {l.taxRate}%
                            </p>
                            {l.isMustSell ? (
                              <Badge tone="warn" icon={Star} className="mt-1">
                                Obrigatório
                              </Badge>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => remove(l.productId)}
                            aria-label={`Remover ${l.name}`}
                            className="inline-flex size-9 items-center justify-center rounded-xl text-ink-3 hover:bg-bad-soft hover:text-bad"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap items-end gap-3">
                          <div className="flex items-center rounded-xl border border-line-strong" role="group" aria-label={`Quantidade de ${l.name}`}>
                            <button
                              type="button"
                              aria-label="Diminuir quantidade"
                              disabled={l.qty <= 1}
                              onClick={() => setLine(l.productId, { qty: Math.max(1, l.qty - 1) })}
                              className="inline-flex size-10 items-center justify-center rounded-l-xl text-ink-2 hover:bg-surface-2 disabled:opacity-40"
                            >
                              <Minus className="size-4" aria-hidden />
                            </button>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              step={1}
                              value={l.qty}
                              aria-label={`Quantidade de ${l.name}`}
                              onChange={(e) => setLine(l.productId, { qty: clampNum(Math.round(Number(e.target.value)), 1, 99_999) })}
                              className="h-10 w-14 border-x border-line bg-transparent text-center text-sm font-bold text-ink tabular-nums outline-none focus:bg-surface-2"
                            />
                            <button
                              type="button"
                              aria-label="Aumentar quantidade"
                              onClick={() => setLine(l.productId, { qty: l.qty + 1 })}
                              className="inline-flex size-10 items-center justify-center rounded-r-xl text-ink-2 hover:bg-surface-2"
                            >
                              <Plus className="size-4" aria-hidden />
                            </button>
                          </div>
                          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-3">
                            Desconto %
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={100}
                              step={0.5}
                              value={l.disc}
                              onChange={(e) => setLine(l.productId, { disc: clampNum(Number(e.target.value), 0, 100) })}
                              className="h-10 w-20 rounded-xl border border-line-strong bg-surface px-2 text-sm text-ink tabular-nums outline-none focus:border-brand"
                            />
                          </label>
                          <div className="ml-auto text-right">
                            <p className="text-[11px] font-semibold text-ink-3 uppercase">Total da linha</p>
                            <p className="text-sm font-extrabold text-ink tabular-nums">{money(t.total)}</p>
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </section>

          <section aria-labelledby="order-add" className="rounded-2xl bg-surface-2 p-3">
            <h3 id="order-add" className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
              <PackagePlus className="size-4 text-[var(--accent-text)]" aria-hidden /> Adicionar do catálogo
            </h3>
            <SearchInput value={search} onChange={setSearch} placeholder="Pesquisar produto ou SKU…" label="Pesquisar produto" />
            <div className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
              {(search ? results.isPending : catalog.isPending) ? (
                <Skeleton className="h-10" />
              ) : pickable.length === 0 ? (
                <p className="px-2 py-3 text-xs text-ink-3">{search ? 'Nenhum produto encontrado.' : 'Todos os produtos já estão na encomenda.'}</p>
              ) : (
                pickable.slice(0, 20).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => add(p)}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface"
                  >
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
                      <Plus className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                      <span className="block text-xs text-ink-3">
                        {p.sku} · {money(p.price)}
                        {p.isMustSell ? ' · obrigatório' : ''}
                      </span>
                    </span>
                    <span className="sr-only">Adicionar {p.name}</span>
                  </button>
                ))
              )}
            </div>
          </section>

          <Field label="Notas da encomenda" hint="Opcional (ex.: entregar de manhã).">
            {(a) => <Textarea {...a} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16" />}
          </Field>

          <dl className="rounded-2xl border border-line p-4 text-sm">
            <div className="flex justify-between py-0.5 text-ink-2">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{money(totals.gross)}</dd>
            </div>
            <div className="flex justify-between py-0.5 text-ink-2">
              <dt>Desconto</dt>
              <dd className="tabular-nums">−{money(totals.discount)}</dd>
            </div>
            <div className="flex justify-between py-0.5 text-ink-2">
              <dt>IVA</dt>
              <dd className="tabular-nums">{money(totals.tax)}</dd>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2">
              <dt className="font-bold text-ink">Total</dt>
              <dd className="text-xl font-extrabold text-ink">
                <AnimatedNumber value={totals.total} format={money} />
              </dd>
            </div>
          </dl>
          {invalidLine ? <p className="text-xs font-medium text-bad">Verifique as quantidades (maior que 0) e os descontos (0 a 100%).</p> : null}
        </div>
      )}
    </Modal>
  );
}

export function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl border border-line p-2.5" style={{ background: `color-mix(in oklab, ${color} 9%, transparent)` }}>
      <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-ink-3">
        <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />
        {label}
      </p>
      <p className="mt-0.5 text-[13px] leading-tight font-extrabold break-words text-ink tabular-nums sm:text-sm">{value}</p>
    </div>
  );
}
