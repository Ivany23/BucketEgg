'use client';

import { ClipboardList, History, Lightbulb, RefreshCw, Upload } from 'lucide-react';
import { useState } from 'react';
import { RequireProject } from '@/components/domain';
import { Button, ButtonLink, EmptyState, ErrorState, ListSkeleton, PageHeader, Pagination } from '@/components/ui';
import { int } from '@/lib/format';
import { useApi } from '@/lib/query';
import { useSession } from '@/lib/session';
import type { ImportJob, Page, Project } from '@/lib/types';
import { ACTIVE_STATUSES, JobCard } from './job-list';
import { ImportPipeline, type PipelineState } from './pipeline';
import { UploadCard } from './upload-card';

export function ImportsScreen() {
  const { loading, canEditData } = useSession();
  if (loading) return <ListSkeleton rows={4} />;
  if (!canEditData) {
    return (
      <div>
        <PageHeader icon={Upload} title="Importações" description="Importação de ficheiros Excel e CSV de grandes dimensões." />
        <EmptyState
          illustration="upload"
          title="Esta área é para supervisores e analistas"
          description="As importações de Excel/CSV são feitas por supervisores, analistas e administradores. Pode continuar a preencher formulários no terreno."
          action={
            <ButtonLink href="/formularios" variant="primary" icon={ClipboardList}>
              Ir para Formulários
            </ButtonLink>
          }
        />
      </div>
    );
  }
  return <RequireProject>{(project) => <ImportsContent key={project.id} project={project} />}</RequireProject>;
}

function ImportsContent({ project }: { project: Project }) {
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const q = useApi<Page<ImportJob>>(
    ['imports', project.id, page],
    '/imports',
    { projectId: project.id, page, limit: 20 },
    {
      // Enquanto houver importações em fila/em curso, atualiza a cada 2 s.
      refetchInterval: (query) => (query.state.data?.data.some((j) => ACTIVE_STATUSES.includes(j.status)) ? 2000 : false),
    },
  );
  const jobs = q.data?.data ?? [];
  const activeCount = jobs.filter((j) => ACTIVE_STATUSES.includes(j.status)).length;

  const latest = jobs[0];
  const pipeline: PipelineState = uploading
    ? { step: 0 }
    : !latest
      ? { step: null }
      : latest.status === 'QUEUED'
        ? { step: 1 }
        : latest.status === 'PROCESSING'
          ? { step: 2 }
          : latest.status === 'COMPLETED'
            ? { step: 3 }
            : { step: latest.startedAt ? 2 : 1, failed: true };

  return (
    <div>
      <PageHeader
        icon={Upload}
        eyebrow={project.name}
        title="Importações"
        description="Envie folhas de Excel ou CSV (até 500 MB) com dados de vendas, auditorias ou a lista de lojas. O processamento continua em segundo plano."
      />

      <div className="mb-6">
        <ImportPipeline state={pipeline} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-4">
          <UploadCard
            projectId={project.id}
            onUploading={setUploading}
            onUploaded={() => {
              setPage(1);
            }}
          />
          <div className="rounded-2xl border border-line bg-surface-2/60 p-4 text-[13px] text-ink-2">
            <p className="mb-1.5 flex items-center gap-2 font-bold text-ink">
              <Lightbulb className="size-4" style={{ color: 'var(--m-dia)' }} aria-hidden /> Dicas
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>A primeira linha deve ter os nomes das colunas.</li>
              <li>CSV é o formato mais rápido para milhões de linhas.</li>
              <li>Pode fechar esta página: a importação continua no servidor.</li>
            </ul>
          </div>
        </div>

        <section aria-labelledby="imports-history">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="imports-history" className="flex items-center gap-2 text-base font-bold text-ink">
              <History className="size-5 text-[var(--accent-text)]" aria-hidden /> Histórico
              {q.data ? <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs text-[var(--accent-text)] tabular-nums">{int(q.data.meta.total)}</span> : null}
            </h2>
            <div className="flex items-center gap-2">
              {activeCount ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-info" aria-live="polite">
                  <span className="size-2 animate-pulse rounded-full bg-info" aria-hidden />
                  {activeCount} em curso
                </span>
              ) : null}
              <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => void q.refetch()} loading={q.isFetching && !q.isPending}>
                Atualizar
              </Button>
            </div>
          </div>

          {q.isPending ? (
            <ListSkeleton rows={3} className="[&>div]:h-40" />
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={() => void q.refetch()} />
          ) : !jobs.length ? (
            <div className="rounded-2xl border border-dashed border-line-strong">
              <EmptyState compact illustration="upload" title="Ainda não há importações" description="Os ficheiros que enviar aparecem aqui, com o progresso em tempo real." />
            </div>
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {jobs.map((j, i) => (
                  <JobCard key={j.id} job={j} index={i} />
                ))}
              </ul>
              <Pagination page={page} pages={q.data.meta.pages ?? 1} total={q.data.meta.total} onChange={setPage} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
