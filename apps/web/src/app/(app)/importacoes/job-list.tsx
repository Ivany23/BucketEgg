'use client';

import { AlertTriangle, ArrowRight, Ban, ChevronDown, Database, FileSpreadsheet, Store, Timer } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useId, useState } from 'react';
import { JobStatusBadge } from '@/components/domain';
import { AnimatedNumber, Button, ButtonLink, Skeleton, cn, useConfirm, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { ago, bytes, dateTime, int } from '@/lib/format';
import { useApi, useApiMutation } from '@/lib/query';
import type { ImportJob, JobStatus } from '@/lib/types';

export const ACTIVE_STATUSES: JobStatus[] = ['QUEUED', 'PROCESSING'];

const STATUS_COLOR: Record<JobStatus, string> = {
  QUEUED: 'var(--m-dia)',
  PROCESSING: 'var(--m-beats)',
  COMPLETED: 'var(--m-visitas)',
  FAILED: 'var(--bad)',
  CANCELLED: 'var(--text-3)',
};

function duration(from: string | null, to: string | null): string | null {
  if (!from || !to) return null;
  const s = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, '0')} s`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

function RowErrors({ jobId }: { jobId: string }) {
  const q = useApi<ImportJob>(['imports', 'detail', jobId], `/imports/${jobId}`);
  if (q.isPending) return <Skeleton className="h-16" />;
  if (q.isError) return <p className="text-xs font-medium text-bad">Não foi possível carregar os erros: {q.error.message}</p>;
  const errors = q.data.rowErrors ?? [];
  if (!errors.length) return <p className="text-xs text-ink-3">Não há erros por linha registados.</p>;
  return (
    <div className="scrollbar-thin max-h-64 overflow-y-auto rounded-xl border border-line">
      <table className="w-full text-left text-[13px]">
        <caption className="sr-only">Erros por linha</caption>
        <thead className="sticky top-0 bg-surface-2">
          <tr>
            <th scope="col" className="w-20 px-3 py-2 text-xs font-bold text-ink-3">
              Linha
            </th>
            <th scope="col" className="px-3 py-2 text-xs font-bold text-ink-3">
              Problema
            </th>
          </tr>
        </thead>
        <tbody>
          {errors.map((e, i) => (
            <tr key={`${e.row}-${i}`} className="border-t border-line">
              <td className="px-3 py-1.5 font-bold text-bad tabular-nums">{e.row}</td>
              <td className="px-3 py-1.5 text-ink-2">{e.error}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(q.data.rowsFailed ?? 0) > errors.length ? (
        <p className="border-t border-line px-3 py-2 text-xs text-ink-3">
          A mostrar os primeiros {int(errors.length)} de {int(q.data.rowsFailed)} erros.
        </p>
      ) : null}
    </div>
  );
}

export function JobCard({ job, index }: { job: ImportJob; index: number }) {
  const reduce = useReducedMotion();
  const toast = useToast();
  const confirm = useConfirm();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const active = ACTIVE_STATUSES.includes(job.status);
  const color = STATUS_COLOR[job.status];
  const KindIcon = job.kind === 'OUTLETS' ? Store : Database;
  const took = duration(job.startedAt, job.finishedAt);
  const canExpand = job.rowsFailed > 0 || job.status === 'FAILED';

  const cancel = useApiMutation(() => api<ImportJob>(`/imports/${job.id}/cancel`, { method: 'POST' }), {
    invalidate: [['imports']],
    onSuccess: (j) => toast.info(j.status === 'CANCELLED' ? 'Importação cancelada' : 'Cancelamento pedido', j.status === 'CANCELLED' ? job.fileName : 'Pára no próximo lote de linhas.'),
    onError: (e) => toast.error('Não foi possível cancelar', e.message),
  });
  const onCancel = async () => {
    const ok = await confirm({
      title: 'Cancelar esta importação?',
      description: job.status === 'PROCESSING' ? 'As linhas já importadas mantêm-se; o resto do ficheiro não será lido.' : 'O ficheiro sai da fila e não será importado.',
      confirmLabel: 'Cancelar importação',
      danger: true,
    });
    if (ok) cancel.mutate();
  };

  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.04, type: 'spring', stiffness: 280, damping: 28 }}
      className="shadow-soft relative overflow-hidden rounded-2xl border border-line bg-surface"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} />
      <div className="p-4 pl-5">
        <div className="flex flex-wrap items-start gap-3">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: 'color-mix(in oklab, var(--m-import) 15%, transparent)', color: 'var(--m-import-text)' }}>
            <FileSpreadsheet className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-ink" title={job.fileName}>
              {job.fileName}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <JobStatusBadge status={job.status} />
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold"
                style={
                  job.kind === 'OUTLETS'
                    ? { background: 'color-mix(in oklab, var(--m-lojas) 15%, transparent)', color: 'var(--m-lojas-text)' }
                    : { background: 'color-mix(in oklab, var(--m-dados) 15%, transparent)', color: 'var(--m-dados-text)' }
                }
              >
                <KindIcon className="size-3.5" aria-hidden />
                {job.kind === 'OUTLETS' ? 'Lojas' : 'Dados'}
              </span>
              {job.targetName ? <span className="truncate text-xs text-ink-3">→ {job.targetName}</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {active ? (
              <Button size="sm" variant="ghost" icon={Ban} onClick={onCancel} loading={cancel.isPending} disabled={job.cancelRequested}>
                {job.cancelRequested ? 'A cancelar…' : 'Cancelar'}
              </Button>
            ) : null}
            {job.status === 'COMPLETED' && job.kind === 'DATASET' && job.datasetId ? (
              <ButtonLink size="sm" variant="soft" href={`/formularios?dataset=${job.datasetId}`} iconRight={ArrowRight}>
                Ver dados
              </ButtonLink>
            ) : null}
            {job.status === 'COMPLETED' && job.kind === 'OUTLETS' ? (
              <ButtonLink size="sm" variant="soft" href="/lojas" iconRight={ArrowRight}>
                Ver lojas
              </ButtonLink>
            ) : null}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl px-3 py-2" style={{ background: 'color-mix(in oklab, var(--m-visitas) 10%, transparent)' }}>
            <dt className="text-[11px] font-semibold text-ink-3">Linhas importadas</dt>
            <dd className="text-lg font-extrabold text-ink">
              <AnimatedNumber value={job.rowsProcessed} />
            </dd>
          </div>
          <div className={cn('rounded-xl px-3 py-2', job.rowsFailed > 0 ? 'bg-bad-soft' : 'bg-surface-2')}>
            <dt className="text-[11px] font-semibold text-ink-3">Com erro</dt>
            <dd className={cn('text-lg font-extrabold tabular-nums', job.rowsFailed > 0 ? 'text-bad' : 'text-ink')}>{int(job.rowsFailed)}</dd>
          </div>
          <div className="rounded-xl bg-surface-2 px-3 py-2">
            <dt className="text-[11px] font-semibold text-ink-3">Tamanho</dt>
            <dd className="text-sm leading-7 font-bold text-ink tabular-nums">
              {bytes(job.fileSize)} <span className="text-xs font-semibold text-ink-3 uppercase">{job.format}</span>
            </dd>
          </div>
          <div className="rounded-xl bg-surface-2 px-3 py-2">
            <dt className="flex items-center gap-1 text-[11px] font-semibold text-ink-3">
              <Timer className="size-3" aria-hidden /> Duração
            </dt>
            <dd className="text-sm leading-7 font-bold text-ink">{took ?? (job.status === 'PROCESSING' ? `desde ${ago(job.startedAt)}` : '—')}</dd>
          </div>
        </dl>

        {job.status === 'PROCESSING' ? (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label="A importar" aria-busy="true">
            <motion.div
              className="h-full w-1/3 rounded-full"
              style={{ background: 'linear-gradient(90deg, var(--m-import), var(--m-beats))' }}
              animate={reduce ? undefined : { x: ['-100%', '300%'] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        ) : null}

        <p className="mt-3 text-xs text-ink-3">
          Enviado {dateTime(job.createdAt)}
          {job.finishedAt ? ` · terminou ${dateTime(job.finishedAt)}` : ''}
          {job.sheetName ? ` · folha "${job.sheetName}"` : ''}
        </p>

        {job.error ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-bad/30 bg-bad-soft px-3 py-2 text-[13px] font-medium text-bad">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {job.error}
          </p>
        ) : null}

        {canExpand ? (
          <div className="mt-3">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg px-1 text-[13px] font-semibold text-[var(--accent-text)] hover:underline"
            >
              <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
              {open ? 'Esconder erros por linha' : 'Ver erros por linha'}
            </button>
            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  id={panelId}
                  initial={reduce ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                  className="overflow-hidden"
                >
                  <div className="pt-2">
                    <RowErrors jobId={job.id} />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}
      </div>
    </motion.li>
  );
}
