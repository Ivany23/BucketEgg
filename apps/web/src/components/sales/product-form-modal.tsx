'use client';

import { Save, Star } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Button, Field, Input, Modal, Switch, cn, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { useApiMutation } from '@/lib/query';
import type { Product } from '@/lib/types';
import { categoryStyle } from './category';

interface ProductBody {
  sku: string;
  name: string;
  brand?: string;
  category?: string;
  unit: string;
  price: number;
  taxRate: number;
  isMustSell: boolean;
  isActive?: boolean;
}

type Errors = Partial<Record<'sku' | 'name' | 'brand' | 'category' | 'unit' | 'price' | 'taxRate', string>>;

const UNITS = ['UN', 'CX', 'CX6', 'CX12', 'CX24', 'KG', 'L', 'PAC', 'GRD'];

/** Criar ou editar produto (só administradores). */
export function ProductFormModal({
  open,
  onClose,
  product,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  /** Produto a editar; sem ele cria um novo. */
  product: Product | null;
  /** Categorias existentes (sugestões). */
  categories: string[];
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      module="produtos"
      size="lg"
      title={product ? 'Editar produto' : 'Novo produto'}
      description={product ? <span className="font-mono">{product.sku}</span> : 'O preço e o IVA são usados em todas as novas encomendas.'}
    >
      <ProductForm key={product?.id ?? 'new'} product={product} categories={categories} onDone={onClose} />
    </Modal>
  );
}

function ProductForm({ product, categories, onDone }: { product: Product | null; categories: string[]; onDone: () => void }) {
  const toast = useToast();
  const listId = useId();
  const [f, setF] = useState({
    sku: product?.sku ?? '',
    name: product?.name ?? '',
    brand: product?.brand ?? '',
    category: product?.category ?? '',
    unit: product?.unit ?? 'UN',
    price: product ? String(product.price) : '',
    taxRate: product ? String(product.taxRate) : '16',
    isMustSell: product?.isMustSell ?? false,
    isActive: product?.isActive ?? true,
  });
  const [errors, setErrors] = useState<Errors>({});
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const save = useApiMutation(
    (body: ProductBody) =>
      product ? api<Product>(`/products/${product.id}`, { method: 'PATCH', body }) : api<Product>('/products', { method: 'POST', body }),
    {
      invalidate: [['products']],
      onSuccess: (p) => {
        toast.success(product ? 'Produto atualizado' : 'Produto criado', `${p.name} · ${money(p.price)}`);
        onDone();
      },
      onError: (e) => {
        if (e.status === 409) setErrors((er) => ({ ...er, sku: 'Já existe um produto com este SKU.' }));
        else toast.error('Não foi possível guardar o produto', e.message);
      },
    },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    const sku = f.sku.trim();
    const name = f.name.trim();
    const price = Number(f.price.replace(',', '.'));
    const taxRate = Number(f.taxRate.replace(',', '.'));
    if (!sku) next.sku = 'Indique o SKU.';
    else if (sku.length > 60) next.sku = 'No máximo 60 caracteres.';
    if (name.length < 2) next.name = 'O nome tem de ter pelo menos 2 caracteres.';
    else if (name.length > 160) next.name = 'No máximo 160 caracteres.';
    if (f.brand.trim().length > 80) next.brand = 'No máximo 80 caracteres.';
    if (f.category.trim().length > 80) next.category = 'No máximo 80 caracteres.';
    if (!f.unit.trim()) next.unit = 'Indique a unidade.';
    else if (f.unit.trim().length > 10) next.unit = 'No máximo 10 caracteres.';
    if (f.price.trim() === '' || !Number.isFinite(price) || price < 0) next.price = 'Indique um preço igual ou maior que zero.';
    else if (!/^\d+([.,]\d{1,2})?$/.test(f.price.trim())) next.price = 'No máximo 2 casas decimais.';
    if (f.taxRate.trim() === '' || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) next.taxRate = 'Entre 0 e 100.';
    setErrors(next);
    if (Object.keys(next).length) return;
    const brand = f.brand.trim();
    const category = f.category.trim();
    const body: ProductBody = {
      sku,
      name,
      // Na edição, um campo esvaziado tem de ir vazio para apagar o valor antigo.
      ...(brand || product?.brand ? { brand } : {}),
      ...(category || product?.category ? { category } : {}),
      unit: f.unit.trim().toUpperCase(),
      price,
      taxRate,
      isMustSell: f.isMustSell,
      ...(product ? { isActive: f.isActive } : {}),
    };
    save.mutate(body);
  };

  const cat = categoryStyle(f.category);
  const CatIcon = cat.icon;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <Field label="SKU" required error={errors.sku} hint="Código único do produto.">
          {(a) => <Input {...a} className="font-mono uppercase" maxLength={60} value={f.sku} onChange={(e) => set('sku', e.target.value)} placeholder="CC-330" autoCapitalize="characters" />}
        </Field>
        <Field label="Nome" required error={errors.name}>
          {(a) => <Input {...a} maxLength={160} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Coca-Cola 330ml (lata)" />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Marca" error={errors.brand}>
          {(a) => <Input {...a} maxLength={80} value={f.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Coca-Cola" />}
        </Field>
        <Field label="Categoria" error={errors.category} hint={categories.length ? 'Escolha uma existente ou escreva uma nova.' : undefined}>
          {(a) => (
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-2.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md" style={{ background: cat.soft, color: cat.text }}>
                <CatIcon className="size-3.5" aria-hidden />
              </span>
              <Input {...a} className="pl-10" list={listId} maxLength={80} value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="Refrigerantes" />
              <datalist id={listId}>
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          )}
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Preço (MZN)" required error={errors.price}>
          {(a) => <Input {...a} type="number" inputMode="decimal" min={0} step="0.01" value={f.price} onChange={(e) => set('price', e.target.value)} placeholder="0,00" />}
        </Field>
        <Field label="IVA (%)" required error={errors.taxRate}>
          {(a) => <Input {...a} type="number" inputMode="decimal" min={0} max={100} step="0.5" value={f.taxRate} onChange={(e) => set('taxRate', e.target.value)} />}
        </Field>
        <Field label="Unidade" required error={errors.unit} className="col-span-2 sm:col-span-1" hint="Ex.: UN, CX24.">
          {(a) => (
            <>
              <Input {...a} list={`${listId}-units`} maxLength={10} className="uppercase" value={f.unit} onChange={(e) => set('unit', e.target.value)} />
              <datalist id={`${listId}-units`}>
                {UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </>
          )}
        </Field>
      </div>
      {Number(f.price) > 0 && Number(f.taxRate) >= 0 ? (
        <p className="-mt-1 text-xs text-ink-3">
          Preço com IVA: <strong className="text-ink">{money(Number(f.price) * (1 + Number(f.taxRate) / 100))}</strong> por {f.unit.trim().toUpperCase() || 'unidade'}
        </p>
      ) : null}

      <div className={cn('flex flex-col gap-3 rounded-2xl border p-4 transition-colors', f.isMustSell ? 'border-warn/50 bg-warn-soft/50' : 'border-line')}>
        <div className="flex items-start gap-3">
          <Star className={cn('mt-0.5 size-5 shrink-0', f.isMustSell ? 'text-warn' : 'text-ink-3')} fill={f.isMustSell ? 'currentColor' : 'none'} aria-hidden />
          <div className="flex-1">
            <Switch checked={f.isMustSell} onChange={(v) => set('isMustSell', v)} label="Must Sell (produto obrigatório)" />
            <p className="mt-1 text-xs text-ink-2">Os promotores são avisados quando uma encomenda não o inclui e aparece sempre na sugestão de encomenda.</p>
          </div>
        </div>
        {product ? (
          <div className="border-t border-line pt-3">
            <Switch checked={f.isActive} onChange={(v) => set('isActive', v)} label="Ativo (disponível para encomendas)" />
            {!f.isActive ? <p className="mt-1 text-xs text-ink-2">Produtos inativos não aparecem no catálogo dos promotores nem podem ser encomendados.</p> : null}
          </div>
        ) : null}
      </div>

      <div className="sticky -bottom-5 -mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t border-line bg-surface px-5 py-4 sm:-mx-6 sm:px-6">
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" variant="accent" icon={Save} loading={save.isPending}>
          {product ? 'Guardar alterações' : 'Criar produto'}
        </Button>
      </div>
    </form>
  );
}
