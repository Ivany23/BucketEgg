'use client';

import { Check, Monitor, Moon, Palette, Sun, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useRef, type KeyboardEvent } from 'react';
import { SettingsSection } from '@/components/org/section';
import { cn } from '@/components/ui';
import { useTheme, type ThemeChoice } from '@/lib/theme';

/* As pré-visualizações usam cores fixas (não os tokens), para mostrar cada tema independentemente do atual. */
const LIGHT = { bg: '#fbf8f5', surface: '#ffffff', line: '#eadfd4', ink: '#1c140e', muted: '#d9c9b9' };
const DARK = { bg: '#14110f', surface: '#1e1a17', line: '#2e2620', ink: '#f5ede6', muted: '#4a3f37' };

const OPTIONS: { id: ThemeChoice; label: string; description: string; icon: LucideIcon }[] = [
  { id: 'system', label: 'Sistema', description: 'Segue o telemóvel ou computador.', icon: Monitor },
  { id: 'light', label: 'Claro', description: 'Ideal ao sol, no terreno.', icon: Sun },
  { id: 'dark', label: 'Escuro', description: 'Confortável à noite e poupa bateria.', icon: Moon },
];

export function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const reduce = useReducedMotion();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Setas mudam a escolha (padrão de "radiogroup").
  const onKey = (e: KeyboardEvent, i: number) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + OPTIONS.length) % OPTIONS.length;
    setTheme(OPTIONS[next].id);
    refs.current[next]?.focus();
  };

  return (
    <SettingsSection icon={Palette} title="Aparência" description="Escolha o tema da aplicação neste dispositivo." color="var(--m-beats)">
      <div role="radiogroup" aria-label="Tema" className="grid gap-4 sm:grid-cols-3">
        {OPTIONS.map((o, i) => {
          const selected = theme === o.id;
          return (
            <motion.button
              key={o.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTheme(o.id)}
              onKeyDown={(e) => onKey(e, i)}
              whileHover={reduce ? undefined : { y: -3 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className={cn(
                'relative flex flex-col overflow-hidden rounded-2xl border bg-surface text-left transition-shadow',
                selected ? 'border-transparent shadow-lift' : 'border-line shadow-soft hover:border-line-strong',
              )}
              style={selected ? { boxShadow: '0 0 0 2px var(--m-beats), 0 16px 40px -18px var(--m-beats)' } : undefined}
            >
              <Preview kind={o.id} />
              <span className="flex items-center gap-2.5 p-3.5">
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[var(--m-beats-soft)] text-[var(--m-beats-text)]">
                  <o.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">{o.label}</span>
                  <span className="block text-xs text-ink-3">{o.description}</span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'inline-flex size-5 items-center justify-center rounded-full border-2 transition-colors',
                    selected ? 'border-transparent bg-[var(--m-beats)] text-white' : 'border-line-strong',
                  )}
                >
                  {selected ? <Check className="size-3" strokeWidth={3.5} /> : null}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-ink-3">A escolha fica guardada neste browser. Também pode alternar o tema no botão do topo.</p>
    </SettingsSection>
  );
}

function Preview({ kind }: { kind: ThemeChoice }) {
  if (kind === 'system') {
    return (
      <span aria-hidden className="relative block h-28 overflow-hidden">
        <span className="absolute inset-0" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}>
          <MiniApp c={LIGHT} />
        </span>
        <span className="absolute inset-0" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}>
          <MiniApp c={DARK} />
        </span>
      </span>
    );
  }
  return (
    <span aria-hidden className="relative block h-28 overflow-hidden">
      <MiniApp c={kind === 'dark' ? DARK : LIGHT} />
    </span>
  );
}

function MiniApp({ c }: { c: typeof LIGHT }) {
  return (
    <span className="absolute inset-0 flex gap-2 p-3" style={{ background: c.bg }}>
      <span className="flex w-1/4 flex-col gap-1.5 rounded-lg p-1.5" style={{ background: c.surface, boxShadow: `inset 0 0 0 1px ${c.line}` }}>
        <span className="h-2 w-3/4 rounded-full" style={{ background: '#f97316' }} />
        <span className="h-1.5 w-full rounded-full" style={{ background: c.muted }} />
        <span className="h-1.5 w-5/6 rounded-full" style={{ background: c.muted }} />
        <span className="h-1.5 w-2/3 rounded-full" style={{ background: c.muted }} />
      </span>
      <span className="flex flex-1 flex-col gap-1.5">
        <span className="h-2.5 w-1/2 rounded-full" style={{ background: c.ink }} />
        <span className="grid flex-1 grid-cols-3 gap-1.5">
          {['#f97316', '#a855f7', '#14b8a6'].map((col) => (
            <span key={col} className="flex flex-col justify-end gap-1 rounded-md p-1.5" style={{ background: c.surface, boxShadow: `inset 0 0 0 1px ${c.line}` }}>
              <span className="size-2.5 rounded-full" style={{ background: col }} />
              <span className="h-1.5 w-3/4 rounded-full" style={{ background: c.muted }} />
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}
