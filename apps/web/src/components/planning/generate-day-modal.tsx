'use client';

import { AlertTriangle, ArrowRight, CalendarCheck2, CheckCircle2, CircleSlash, RotateCcw, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { Avatar, Button, ButtonLink, Modal, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { date, todayIso } from '@/lib/format';
import { useApiMutation } from '@/lib/query';
import { WEEKDAYS, type Beat } from '@/lib/types';
import { GenerateFields, buildGenerateBody, routesLink, weekdayOf, type GenerateBody } from './generate-route';
import { FormError, STEP_COLORS, StepTitle, warehouseDraft, type LocationDraft } from './shared';

interface GenerateDayResult {
  date: string;
  weekday: number;
  created: { beatId: string; routeId: string }[];
  skipped: { beatId: string; reason: string }[];
}

/** "Gerar plano do dia": uma rota por cada beat agendado nesse dia da semana. */
export function GenerateDayModal({ open, onClose, projectId, beats }: { open: boolean; onClose: () => void; projectId: string; beats: Beat[] }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      module="beats"
      title="Gerar plano do dia"
      description="Cria a rota otimizada de cada beat agendado para o dia escolhido (beats já gerados nesse dia são ignorados)."
    >
      <GenerateDayForm projectId={projectId} beats={beats} onClose={onClose} />
    </Modal>
  );
}

function GenerateDayForm({ projectId, beats, onClose }: { projectId: string; beats: Beat[]; onClose: () => void }) {
  const toast = useToast();
  const reduce = useReducedMotion();
  const [day, setDay] = useState(() => todayIso(1));
  const [startTime, setStartTime] = useState('08:00');
  const [location, setLocation] = useState<LocationDraft>(warehouseDraft);
  const [errors, setErrors] = useState<Partial<Record<'day' | 'time' | 'start', string>>>({});

  const gen = useApiMutation((body: GenerateBody) => api<GenerateDayResult>(`/projects/${projectId}/beats/generate-day`, { method: 'POST', body }), {
    invalidate: [['routes'], ['beats'], ['beat'], ['my-day'], ['dashboard']],
    onSuccess: (r) => {
      if (r.created.length) toast.success('Plano do dia gerado', `${r.created.length} ${r.created.length === 1 ? 'rota criada' : 'rotas criadas'}.`);
      else toast.info('Nenhuma rota criada', r.skipped.length ? 'Veja os motivos na lista.' : 'Não há beats com promotor para esse dia.');
    },
    onError: (e) => toast.error('Não foi possível gerar o plano', e.message),
  });

  const wd = day ? weekdayOf(day) : null;
  const scheduled = wd === null ? [] : beats.filter((b) => b.weekdays.includes(wd));
  const withRep = scheduled.filter((b) => b.assigneeId);
  const noRep = scheduled.filter((b) => !b.assigneeId);
  const byId = new Map(beats.map((b) => [b.id, b]));
  const result = gen.data;

  if (result) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-2xl bg-[var(--accent-soft)] p-4">
          <CalendarCheck2 className="size-6 shrink-0 text-[var(--accent-text)]" aria-hidden />
          <div>
            <p className="font-bold text-ink">
              {WEEKDAYS[result.weekday]}, {date(`${result.date}T12:00:00Z`)}
            </p>
            <p className="text-sm text-ink-2">
              {result.created.length} criadas · {result.skipped.length} ignoradas
            </p>
          </div>
        </div>
        {result.created.length || result.skipped.length ? (
          <ul className="flex flex-col gap-2" aria-label="Resultado por beat">
            {[
              ...result.created.map((c) => ({ kind: 'ok' as const, beatId: c.beatId, routeId: c.routeId, reason: '' })),
              ...result.skipped.map((s) => ({ kind: 'skip' as const, beatId: s.beatId, routeId: '', reason: s.reason })),
            ].map((row, i) => {
              const b = byId.get(row.beatId);
              const already = row.kind === 'skip' && /já existe/i.test(row.reason);
              const color = row.kind === 'ok' ? STEP_COLORS[i % STEP_COLORS.length] : already ? 'var(--info)' : 'var(--warn)';
              const Icon = row.kind === 'ok' ? CheckCircle2 : already ? CircleSlash : AlertTriangle;
              return (
                <motion.li
                  key={`${row.kind}-${row.beatId}`}
                  initial={reduce ? false : { opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.05, type: 'spring', stiffness: 300, damping: 26 }}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3"
                  style={{ borderLeft: `4px solid ${color}` }}
                >
                  <Icon className="size-5 shrink-0" style={{ color }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{b?.name ?? 'Beat'}</p>
                    <p className="text-xs text-ink-2">
                      {row.kind === 'ok' ? (
                        <span className="font-semibold text-ok">Rota criada</span>
                      ) : (
                        <>
                          <span className={already ? 'font-semibold text-info' : 'font-semibold text-warn'}>{already ? 'Já existia' : 'Ignorado'}</span> — {row.reason}
                        </>
                      )}
                      {b?.assignee ? ` · ${b.assignee.name ?? b.assignee.email}` : ''}
                    </p>
                  </div>
                  {row.kind === 'ok' ? (
                    <Link
                      href={routesLink(result.date, row.routeId)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-[var(--accent-text)] hover:bg-[var(--accent-soft)]"
                    >
                      Ver rota <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  ) : null}
                </motion.li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-ink-3">Não há beats com promotor agendados para este dia da semana.</p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" icon={RotateCcw} onClick={() => gen.reset()}>
            Outro dia
          </Button>
          {result.created.length ? (
            <ButtonLink href={routesLink(result.date)} variant="accent" iconRight={ArrowRight}>
              Ver rotas do dia
            </ButtonLink>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const r = buildGenerateBody(day, startTime, location);
        setErrors(r.errors);
        if (r.body) gen.mutate(r.body);
      }}
      className="flex flex-col gap-6"
    >
      <section>
        <StepTitle n={1} title="Dia e partida" />
        <GenerateFields
          day={day}
          onDay={setDay}
          startTime={startTime}
          onStartTime={setStartTime}
          location={location}
          onLocation={setLocation}
          errors={errors}
          dayHint={wd !== null ? `${WEEKDAYS[wd]}` : undefined}
        />
      </section>
      <section>
        <StepTitle n={2} title="Beats agendados" hint={wd !== null ? `Beats com ${WEEKDAYS[wd]} nos dias da semana` : undefined} />
        {withRep.length ? (
          <ul className="flex flex-col gap-1.5">
            {withRep.map((b, i) => (
              <li key={b.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: STEP_COLORS[i % STEP_COLORS.length] }} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{b.name}</span>
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
                  <Avatar name={b.assignee?.name} email={b.assignee?.email} size={20} />
                  {b.assignee?.name ?? b.assignee?.email}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-line p-3 text-sm text-ink-3">Nenhum beat com promotor está agendado para este dia da semana.</p>
        )}
        {noRep.length ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-warn">
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
            {noRep.length === 1 ? `“${noRep[0].name}” não tem promotor e não será gerado.` : `${noRep.length} beats sem promotor não serão gerados.`}
          </p>
        ) : null}
      </section>
      <FormError error={gen.error} />
      <div className="sticky -bottom-5 z-10 -mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t border-line bg-surface px-5 py-4 sm:-mx-6 sm:px-6">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" icon={Wand2} loading={gen.isPending} disabled={!withRep.length}>
          {gen.isPending ? 'A gerar rotas…' : `Gerar ${withRep.length || ''} ${withRep.length === 1 ? 'rota' : 'rotas'}`.replace(/\s+/g, ' ')}
        </Button>
      </div>
    </form>
  );
}
