'use client';

import { CalendarDays, Camera, Check, Hash, ListChecks, ToggleLeft, Type, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/components/ui';
import { date as fmtDate } from '@/lib/format';
import { FIELD_TYPE_LABEL, type Dataset, type DatasetSchema, type FieldDef, type FieldType } from '@/lib/types';

/** Tipos que se podem escolher ao criar perguntas (os restantes só chegam por importação). */
export const EDITABLE_TYPES: FieldType[] = ['string', 'number', 'boolean', 'date'];

/** Cada tipo de campo tem a sua cor e ícone (ver --m-* em globals.css). */
export const FIELD_TYPE_META: Record<FieldType, { icon: LucideIcon; color: string; text: string }> = {
  string: { icon: Type, color: 'var(--m-rotas)', text: 'var(--m-rotas-text)' },
  number: { icon: Hash, color: 'var(--m-vendas)', text: 'var(--m-vendas-text)' },
  boolean: { icon: ToggleLeft, color: 'var(--m-visitas)', text: 'var(--m-visitas-text)' },
  date: { icon: CalendarDays, color: 'var(--m-dia)', text: 'var(--m-dia-text)' },
  photo: { icon: Camera, color: 'var(--m-lojas)', text: 'var(--m-lojas-text)' },
  select: { icon: ListChecks, color: 'var(--m-beats)', text: 'var(--m-beats-text)' },
};

const metaFor = (type: string) => FIELD_TYPE_META[(type in FIELD_TYPE_META ? type : 'string') as FieldType];
export const typeLabel = (type: string) => FIELD_TYPE_LABEL[(type in FIELD_TYPE_LABEL ? type : 'string') as FieldType];

export function FieldTypeChip({ type, count, className }: { type: string; count?: number; className?: string }) {
  const meta = metaFor(type);
  const Icon = meta.icon;
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap', className)}
      style={{ background: `color-mix(in oklab, ${meta.color} 15%, transparent)`, color: meta.text }}
    >
      <Icon className="size-3" aria-hidden />
      {typeLabel(type)}
      {count !== undefined ? <span className="tabular-nums opacity-80">· {count}</span> : null}
    </span>
  );
}

/** Ícone redondo colorido do tipo (cabeçalhos de coluna, listas de campos). */
export function FieldTypeDot({ type, size = 'md' }: { type: string; size?: 'sm' | 'md' }) {
  const meta = metaFor(type);
  const Icon = meta.icon;
  return (
    <span
      title={typeLabel(type)}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-lg', size === 'sm' ? 'size-5' : 'size-8')}
      style={{ background: `color-mix(in oklab, ${meta.color} 16%, transparent)`, color: meta.text }}
    >
      <Icon className={size === 'sm' ? 'size-3' : 'size-4'} aria-hidden />
    </span>
  );
}

export interface SchemaField extends FieldDef {
  key: string;
}

/** Campos do esquema por ordem (col_0, col_1, … col_10). */
export function schemaFields(schema: DatasetSchema, onlyActive = false): SchemaField[] {
  const index = (k: string) => {
    const m = /(\d+)$/.exec(k);
    return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
  };
  return Object.entries(schema)
    .map(([key, def]) => ({ key, ...def }))
    .filter((f) => !onlyActive || f.active !== false)
    .sort((a, b) => index(a.key) - index(b.key) || a.key.localeCompare(b.key));
}

/** Próxima chave livre (col_N) para uma pergunta nova. */
export function nextFieldKey(schema: DatasetSchema): string {
  let max = -1;
  for (const k of Object.keys(schema)) {
    const m = /^col_(\d+)$/.exec(k);
    if (m) max = Math.max(max, Number(m[1]));
  }
  let n = max + 1;
  while (`col_${n}` in schema) n++;
  return `col_${n}`;
}

/** Datasets importados guardam o nome original da coluna; formulários não. */
export const isImported = (d: Pick<Dataset, 'schema'>) => Object.values(d.schema).some((f) => !!f.originalName);

export const isEmpty = (v: unknown) => v === null || v === undefined || v === '';

/** Valor em texto simples (diferenças no histórico, leitores de ecrã). */
export function valueText(value: unknown, type: string): string {
  if (isEmpty(value)) return '—';
  if (type === 'boolean' || typeof value === 'boolean') return value === true ? 'Sim' : value === false ? 'Não' : String(value);
  if (type === 'date' && typeof value === 'string') return fmtDate(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (type === 'number' && typeof value === 'number') return value.toLocaleString('pt-PT', { maximumFractionDigits: 4 });
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Célula de tabela formatada pelo tipo do campo. */
export function CellValue({ value, type }: { value: unknown; type: string }) {
  if (isEmpty(value)) return <span className="text-ink-3">—</span>;
  if (typeof value === 'boolean') {
    return value ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 text-xs font-bold text-ok">
        <Check className="size-3.5" aria-hidden /> Sim
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-bad-soft px-2 py-0.5 text-xs font-bold text-bad">
        <X className="size-3.5" aria-hidden /> Não
      </span>
    );
  }
  if (type === 'photo' && typeof value === 'string' && /^https?:\/\//i.test(value)) {
    return (
      <a href={value} target="_blank" rel="noreferrer" className="font-semibold text-[var(--accent-text)] underline-offset-2 hover:underline">
        Ver foto
      </a>
    );
  }
  if (type === 'number' && typeof value === 'number') return <span className="tabular-nums">{valueText(value, type)}</span>;
  if (type === 'date') return <span className="whitespace-nowrap">{valueText(value, type)}</span>;
  const text = valueText(value, type);
  return (
    <span className="line-clamp-2 max-w-[18rem]" title={text.length > 40 ? text : undefined}>
      {text}
    </span>
  );
}

/* ───────────────────────── Valores de formulário ───────────────────────── */

/** Valor do campo enquanto se escreve (inputs trabalham com texto; Sim/Não com boolean). */
export type DraftValue = string | boolean | null;

export function toDraft(value: unknown, type: string): DraftValue {
  if (isEmpty(value)) return type === 'boolean' ? null : '';
  if (type === 'boolean') return typeof value === 'boolean' ? value : null;
  if (type === 'date' && typeof value === 'string') return value.slice(0, 10);
  return String(value);
}

/** Converte o rascunho para o valor que a API espera. `undefined` = vazio; `Error` = inválido. */
export function fromDraft(draft: DraftValue, type: string): unknown {
  if (draft === null || draft === '') return undefined;
  if (type === 'boolean') return typeof draft === 'boolean' ? draft : undefined;
  const text = String(draft).trim();
  if (!text) return undefined;
  if (type === 'number') {
    const n = Number(text.replace(',', '.'));
    return Number.isFinite(n) ? n : new Error('Indique um número válido.');
  }
  if (type === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : new Error('Data inválida.');
  if (type === 'photo' && !/^https?:\/\/\S+$/i.test(text)) return new Error('Indique um endereço (https://…) da fotografia.');
  return text;
}

/** Mensagens de validação da API ({ message, errors: [] }). */
export function apiErrorList(body: unknown): string[] {
  const errors = (body as { errors?: unknown } | null)?.errors;
  return Array.isArray(errors) ? errors.filter((e): e is string => typeof e === 'string') : [];
}

/** Troca "col_1 (Rótulo): esperado number" por uma frase em português. */
export function humanizeApiError(msg: string): string {
  const typeNames: Record<string, string> = { number: 'um número', boolean: 'Sim/Não', date: 'uma data', string: 'texto', photo: 'um link', select: 'uma opção' };
  const m = /^(\w+)(?: \((.+)\))?: (.+)$/.exec(msg);
  if (!m) return msg;
  const [, key, label, rest] = m;
  const what = rest.startsWith('esperado ') ? `deve ser ${typeNames[rest.slice(9)] ?? rest.slice(9)}` : rest;
  return `${label ?? key}: ${what}`;
}
