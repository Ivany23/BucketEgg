'use client';

import { Plus, Repeat, Route as RouteIcon, Store, UserX, Wand2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { RequireProject } from '@/components/domain';
import { BeatDrawer } from '@/components/planning/beat-drawer';
import { BeatFormModal } from '@/components/planning/beat-form-modal';
import { GenerateDayModal } from '@/components/planning/generate-day-modal';
import { WEEKDAY_COLORS, WeekdayChips } from '@/components/planning/shared';
import { Avatar, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { useApi } from '@/lib/query';
import { useSession } from '@/lib/session';
import type { Beat, BeatDetail, Project } from '@/lib/types';
import { useToday } from '@/lib/today';

type FormState = { mode: 'create' } | { mode: 'edit'; beat: BeatDetail } | null;

export function BeatsScreen() {
  const { isManager } = useSession();
  return <RequireProject>{(project) => <BeatsContent project={project} isManager={isManager} />}</RequireProject>;
}

function BeatsContent({ project, isManager }: { project: Project; isManager: boolean }) {
  const q = useApi<Beat[]>(['beats', project.id], `/projects/${project.id}/beats`);
  const [openBeat, setOpenBeat] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [generating, setGenerating] = useState(false);
  const beats = q.data ?? [];
  const today = useToday();
  const todayWd = today ? new Date(`${today}T00:00:00Z`).getUTCDay() : -1;

  return (
    <>
      <PageHeader
        icon={Repeat}
        eyebrow="Planeamento"
        title="Beats"
        description={
          isManager
            ? 'Circuitos semanais de lojas. Nos dias de cada beat, gere as rotas otimizadas com um clique.'
            : 'Os seus circuitos semanais: que lojas visita e em que dias.'
        }
        actions={
          isManager ? (
            <>
              <Button icon={Wand2} onClick={() => setGenerating(true)} disabled={!beats.length}>
                Gerar plano do dia
              </Button>
              <Button variant="primary" icon={Plus} onClick={() => setForm({ mode: 'create' })}>
                Novo beat
              </Button>
            </>
          ) : null
        }
      />

      {q.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="A carregar beats">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : beats.length ? (
        <>
          <WeekStrip beats={beats} today={todayWd} />
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Beats">
            {beats.map((b, i) => (
              <BeatCard key={b.id} beat={b} index={i} today={todayWd} onOpen={() => setOpenBeat(b.id)} />
            ))}
          </ul>
        </>
      ) : (
        <Card className="px-4">
          <EmptyState
            illustration="calendar"
            title="Ainda não há beats"
            description={
              isManager
                ? 'Crie circuitos fixos (ex.: “Baixa — Segunda e Quinta”) e gere as rotas de cada dia automaticamente.'
                : 'Ainda não tem circuitos semanais atribuídos.'
            }
            action={
              isManager ? (
                <Button variant="primary" icon={Plus} onClick={() => setForm({ mode: 'create' })}>
                  Novo beat
                </Button>
              ) : null
            }
          />
        </Card>
      )}

      <BeatDrawer
        beatId={openBeat}
        routesCount={beats.find((b) => b.id === openBeat)?._count?.routes}
        onClose={() => setOpenBeat(null)}
        onEdit={(beat) => {
          // Um diálogo de cada vez (Esc e o foco ficam no formulário).
          setOpenBeat(null);
          setForm({ mode: 'edit', beat });
        }}
      />
      {isManager ? (
        <>
          <BeatFormModal
            open={!!form}
            onClose={() => {
              // Cancelar a edição volta ao detalhe do beat.
              if (form?.mode === 'edit') setOpenBeat(form.beat.id);
              setForm(null);
            }}
            projectId={project.id}
            beat={form?.mode === 'edit' ? form.beat : null}
            onSaved={(saved) => {
              setForm(null);
              setOpenBeat(saved.id);
            }}
          />
          <GenerateDayModal open={generating} onClose={() => setGenerating(false)} projectId={project.id} beats={beats} />
        </>
      ) : null}
    </>
  );
}

/** Resumo da semana: quantos beats em cada dia (hoje destacado). */
function WeekStrip({ beats, today }: { beats: Beat[]; today: number }) {
  const reduce = useReducedMotion();
  const counts = [0, 1, 2, 3, 4, 5, 6].map((d) => beats.filter((b) => b.weekdays.includes(d)).length);
  const max = Math.max(1, ...counts);
  const names = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  // Segunda primeiro (semana de trabalho).
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <section aria-label="Beats por dia da semana" className="shadow-soft mb-6 rounded-2xl border border-line bg-surface p-4">
      <ol className="grid grid-cols-7 gap-1.5 sm:gap-3">
        {order.map((d, i) => (
          <li key={d} className="flex flex-col items-center gap-1.5" aria-label={`${names[d]}: ${counts[d]} beats${d === today ? ' (hoje)' : ''}`}>
            <div className="flex h-16 w-full items-end justify-center rounded-xl bg-surface-2 p-1">
              <motion.div
                aria-hidden
                className="w-full max-w-10 rounded-lg"
                style={{ background: `color-mix(in oklab, ${WEEKDAY_COLORS[d]} 75%, white)` }}
                initial={reduce ? false : { height: 0 }}
                animate={{ height: `${counts[d] ? Math.max(14, (counts[d] / max) * 100) : 0}%` }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 220, damping: 24 }}
              />
            </div>
            <span aria-hidden className={d === today ? 'rounded-md bg-[var(--accent)] px-1.5 text-xs font-bold text-[#10141c]' : 'text-xs font-semibold text-ink-3'}>
              {names[d].slice(0, 3)}
            </span>
            <span aria-hidden className="text-sm font-extrabold text-ink tabular-nums">
              {counts[d]}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function BeatCard({ beat: b, index, today, onOpen }: { beat: Beat; index: number; today: number; onOpen: () => void }) {
  const reduce = useReducedMotion();
  const isToday = b.weekdays.includes(today);
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.05, type: 'spring', stiffness: 260, damping: 26 }}
    >
      <Card interactive onClick={onOpen} className="relative flex h-full flex-col overflow-hidden p-4">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, var(--m-beats), var(--m-vendas))' }} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-bold text-ink" title={b.name}>
              {b.name}
            </h3>
            <p className="mt-0.5 line-clamp-2 text-sm text-ink-2">{b.description || 'Sem descrição'}</p>
          </div>
          {isToday ? (
            <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--accent-text)]">Hoje</span>
          ) : null}
        </div>
        <div className="mt-3">
          <WeekdayChips days={b.weekdays} size="sm" />
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 text-xs font-semibold">
          <span className="mr-auto inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-ink-2">
            {b.assignee ? (
              <>
                <Avatar name={b.assignee.name} email={b.assignee.email} size={24} />
                <span className="truncate">{b.assignee.name ?? b.assignee.email}</span>
              </>
            ) : (
              <>
                <UserX className="size-4 text-warn" aria-hidden />
                <span className="text-warn">Sem promotor</span>
              </>
            )}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--m-lojas)_14%,transparent)] px-2.5 py-0.5 text-[var(--m-lojas-text)]">
            <Store className="size-3.5" aria-hidden />
            {b._count?.outlets ?? 0} lojas
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--m-rotas)_14%,transparent)] px-2.5 py-0.5 text-[var(--m-rotas-text)]">
            <RouteIcon className="size-3.5" aria-hidden />
            {b._count?.routes ?? 0} rotas
          </span>
        </div>
      </Card>
    </motion.li>
  );
}
