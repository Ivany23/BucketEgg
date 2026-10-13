'use client';

/**
 * Gráficos em SVG próprio (sem biblioteca), seguindo regras de visualização:
 * - uma série por gráfico de linhas/colunas (nunca dois eixos y); a cor vem da paleta validada (--series-N);
 * - linhas de 2 px, marcadores ≥ 8 px com anel da cor da superfície, colunas ≤ 24 px com topo arredondado;
 * - grelha discreta (1 px), texto sempre nas cores de texto (nunca na cor da série);
 * - dica (tooltip) ao passar o rato/teclado e alternativa em tabela para leitores de ecrã.
 */
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { cn } from '../ui/core';

/** Largura do contentor (re-renderiza ao redimensionar). */
function useWidth<T extends HTMLElement>(fallback = 320) {
  const ref = useRef<T | null>(null);
  const subscribe = useCallback((cb: () => void) => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return () => undefined;
    const ro = new ResizeObserver(cb);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const width = useSyncExternalStore(
    subscribe,
    () => ref.current?.clientWidth || fallback,
    () => fallback,
  );
  return { ref, width };
}

/** Ticks "redondos" para o eixo y. */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

const compactNum = (v: number) => new Intl.NumberFormat('pt-PT', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

export interface SeriesPoint {
  /** Rótulo do eixo x (ex.: "12 out"). */
  label: string;
  value: number;
}

function Tooltip({ x, y, children, width }: { x: number; y: number; children: ReactNode; width: number }) {
  const left = Math.min(Math.max(x, 70), width - 70);
  return (
    <div
      role="status"
      className="shadow-lift pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-line bg-surface px-3 py-2 text-xs whitespace-nowrap"
      style={{ left, top: y - 10 }}
    >
      {children}
    </div>
  );
}

/** Tabela alternativa (acessibilidade e leitura exata dos valores). */
export function ChartTable({ caption, rows, valueLabel, format }: { caption: string; rows: SeriesPoint[]; valueLabel: string; format: (v: number) => string }) {
  return (
    <div className="scrollbar-thin max-h-64 overflow-auto rounded-xl border border-line">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface-2 text-left text-xs text-ink-3 uppercase">
          <tr>
            <th scope="col" className="px-3 py-2">
              Dia
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              {valueLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-line">
              <td className="px-3 py-1.5 text-ink-2">{r.label}</td>
              <td className="px-3 py-1.5 text-right font-semibold text-ink tabular-nums">{format(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Linha com área suave (uma série), com mira e dica. */
export function LineChart({
  data,
  color = 'var(--series-1)',
  height = 220,
  format,
  ariaLabel,
}: {
  data: SeriesPoint[];
  color?: string;
  height?: number;
  format: (v: number) => string;
  ariaLabel: string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const reduce = useReducedMotion();
  const gradId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 16, right: 16, bottom: 28, left: 44 };
  const w = Math.max(width, 240);
  const innerW = w - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(...data.map((d) => d.value), 0);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const x = (i: number) => pad.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / top) * innerH;
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const area = data.length ? `${line} L${x(data.length - 1)},${pad.top + innerH} L${x(0)},${pad.top + innerH} Z` : '';
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 64))));
  const last = data.length - 1;

  const pick = (clientX: number, rect: DOMRect) => {
    const rel = clientX - rect.left - pad.left;
    const i = Math.round((rel / innerW) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <svg
        width={w}
        height={height}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        className="block touch-none outline-none"
        onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setHover((h) => Math.min(last, (h ?? -1) + 1));
          if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? last + 1) - 1));
          if (e.key === 'Escape') setHover(null);
        }}
        onBlur={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.22" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={w - pad.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--text-3)] text-[11px]">
              {compactNum(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          (i % labelEvery === 0 && last - i >= labelEvery / 2) || i === last ? (
            <text key={d.label + i} x={x(i)} y={height - 8} textAnchor="middle" className="fill-[var(--text-3)] text-[11px]">
              {d.label}
            </text>
          ) : null,
        )}
        {area ? (
          <motion.path d={area} fill={`url(#${gradId})`} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} />
        ) : null}
        {line ? (
          <motion.path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        ) : null}
        {data.length ? (
          <circle cx={x(last)} cy={y(data[last].value)} r="4.5" fill={color} stroke="var(--surface)" strokeWidth="2" />
        ) : null}
        {hover !== null && data[hover] ? (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke="var(--border-strong)" strokeWidth="1" />
            <circle cx={x(hover)} cy={y(data[hover].value)} r="5" fill={color} stroke="var(--surface)" strokeWidth="2" />
          </g>
        ) : null}
      </svg>
      {hover !== null && data[hover] ? (
        <Tooltip x={x(hover)} y={y(data[hover].value)} width={w}>
          <span className="font-semibold text-ink">{data[hover].label}</span>
          <span className="ml-2 text-ink-2">{format(data[hover].value)}</span>
        </Tooltip>
      ) : null}
    </div>
  );
}

/** Colunas (uma série), com valor em destaque no máximo e dica por coluna. */
export function ColumnChart({
  data,
  color = 'var(--series-2)',
  height = 160,
  format,
  ariaLabel,
}: {
  data: SeriesPoint[];
  color?: string;
  height?: number;
  format: (v: number) => string;
  ariaLabel: string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 18, right: 12, bottom: 26, left: 32 };
  const w = Math.max(width, 240);
  const innerW = w - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(...data.map((d) => d.value), 0);
  const ticks = niceTicks(max, 3);
  const top = ticks[ticks.length - 1] || 1;
  const band = data.length ? innerW / data.length : innerW;
  const barW = Math.max(3, Math.min(24, band - 2)); // ≤ 24 px, 2 px de ar entre colunas
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 64))));
  const maxIndex = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <svg width={w} height={height} role="img" aria-label={ariaLabel} className="block">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={w - pad.right} y1={pad.top + innerH - (t / top) * innerH} y2={pad.top + innerH - (t / top) * innerH} stroke="var(--grid)" strokeWidth="1" />
            <text x={pad.left - 6} y={pad.top + innerH - (t / top) * innerH} dy="0.32em" textAnchor="end" className="fill-[var(--text-3)] text-[11px]">
              {compactNum(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = (d.value / top) * innerH;
          const cx = pad.left + band * i + band / 2;
          const r = Math.min(4, barW / 2, h);
          const x0 = cx - barW / 2;
          const y0 = pad.top + innerH - h;
          // Topo arredondado (4 px), base reta sobre a linha de base.
          const path =
            h <= 0
              ? ''
              : `M${x0},${pad.top + innerH} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + barW - r} Q${x0 + barW},${y0} ${x0 + barW},${y0 + r} V${pad.top + innerH} Z`;
          return (
            <g key={d.label + i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              {/* Área de toque maior do que a coluna */}
              <rect x={pad.left + band * i} y={pad.top} width={band} height={innerH} fill="transparent" />
              {path ? (
                <motion.path
                  d={path}
                  fill={color}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                  initial={reduce ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  style={{ originY: 1, transformBox: 'fill-box' }}
                  transition={{ delay: Math.min(i, 30) * 0.015, type: 'spring', stiffness: 200, damping: 22 }}
                />
              ) : null}
              {i === maxIndex && d.value > 0 ? (
                <text x={cx} y={y0 - 6} textAnchor="middle" className="fill-[var(--text-2)] text-[11px] font-semibold">
                  {format(d.value)}
                </text>
              ) : null}
              {(i % labelEvery === 0 && data.length - 1 - i >= labelEvery / 2) || i === data.length - 1 ? (
                <text x={cx} y={height - 8} textAnchor="middle" className="fill-[var(--text-3)] text-[11px]">
                  {d.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] ? (
        <Tooltip x={pad.left + band * hover + band / 2} y={pad.top + innerH - (data[hover].value / top) * innerH} width={w}>
          <span className="font-semibold text-ink">{data[hover].label}</span>
          <span className="ml-2 text-ink-2">{format(data[hover].value)}</span>
        </Tooltip>
      ) : null}
    </div>
  );
}

/** Barras horizontais (ranking): rótulo à esquerda, valor na ponta. */
export function BarList({
  items,
  format,
  color = 'var(--series-1)',
}: {
  items: { id: string; label: ReactNode; value: number; extra?: ReactNode }[];
  format: (v: number) => string;
  color?: string;
}) {
  const reduce = useReducedMotion();
  const max = Math.max(...items.map((i) => i.value), 0) || 1;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item, i) => (
        <li key={item.id} className="grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,13rem)_1fr]">
          <div className="min-w-0 text-sm">{item.label}</div>
          <div className="flex items-center gap-2">
            <div className="relative h-6 flex-1">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-r-[4px]"
                style={{ background: color, maxWidth: '100%' }}
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${(item.value / max) * 100}%` }}
                transition={{ delay: i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-sm font-semibold text-ink tabular-nums">{format(item.value)}</span>
          </div>
          {item.extra ? <div className="col-span-2 -mt-2 pl-0 text-xs text-ink-3 sm:col-start-2">{item.extra}</div> : null}
        </li>
      ))}
    </ul>
  );
}

/** Barra empilhada (partes de um todo) com legenda e valores — cores de estado com rótulo. */
export function StackedBar({ parts, ariaLabel }: { parts: { label: string; value: number; color: string }[]; ariaLabel: string }) {
  const reduce = useReducedMotion();
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div>
      <div role="img" aria-label={ariaLabel} className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full bg-surface-3">
        {parts.map((p, i) =>
          p.value > 0 ? (
            <motion.div
              key={p.label}
              title={`${p.label}: ${p.value}`}
              style={{ background: p.color }}
              className={cn(i === 0 && 'rounded-l-full', i === parts.length - 1 && 'rounded-r-full')}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${(p.value / (total || 1)) * 100}%` }}
              transition={{ delay: i * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2 text-sm text-ink-2">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: p.color }} />
            {p.label}
            <span className="font-semibold text-ink tabular-nums">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Anel de percentagem (um número em destaque). */
export function Ring({ value, color, size = 96, label }: { value: number; color: string; size?: number; label: string }) {
  const reduce = useReducedMotion();
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`${label}: ${v.toFixed(0)}%`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (v / 100) * c }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <span className="absolute text-lg font-extrabold text-ink tabular-nums">{v.toFixed(0)}%</span>
    </div>
  );
}
