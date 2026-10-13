'use client';

import { useInfiniteQuery, type InfiniteData, type QueryKey } from '@tanstack/react-query';
import {
  ChevronsDown,
  Columns3,
  FileDown,
  FileSpreadsheet,
  History,
  MapPin,
  PencilLine,
  RotateCcw,
  Send,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { Avatar, Badge, Button, EmptyState, ErrorState, IconButton, Skeleton, Switch, Textarea, cn, useConfirm, useToast } from '@/components/ui';
import { api, download, type ApiError } from '@/lib/api';
import { dateTime, int } from '@/lib/format';
import { useApiMutation } from '@/lib/query';
import { useSession } from '@/lib/session';
import type { DataRecord, Dataset, RecordsPage } from '@/lib/types';
import { DatasetStatusBadge, KindBadge, typeCounts } from './dataset-card';
import { CellValue, FieldTypeChip, FieldTypeDot, schemaFields } from './field-types';
import { EditRecordModal, SubmitRecordModal } from './record-forms';
import { RecordHistoryDrawer } from './record-history';
import { SchemaEditorModal } from './schema-editor';

const PAGE_SIZE = 50;

export function DatasetView({ dataset, projectId, onClose, onDeleted }: { dataset: Dataset; projectId: string; onClose: () => void; onDeleted: () => void }) {
  const { canEditData, isAdmin } = useSession();
  const toast = useToast();
  const confirm = useConfirm();
  const reduce = useReducedMotion();
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [history, setHistory] = useState<{ id: string; seq: string } | null>(null);
  const [exporting, setExporting] = useState<'xlsx' | 'csv' | null>(null);
  const showDeleted = canEditData && includeDeleted;

  const records = useInfiniteQuery<RecordsPage, ApiError, InfiniteData<RecordsPage, string | undefined>, QueryKey, string | undefined>({
    queryKey: ['dataset-records', dataset.id, { includeDeleted: showDeleted }],
    queryFn: ({ pageParam, signal }) =>
      api<RecordsPage>(`/datasets/${dataset.id}/records`, {
        query: { limit: PAGE_SIZE, cursor: pageParam, includeDeleted: showDeleted || undefined },
        signal,
      }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  });

  const pages = records.data?.pages ?? [];
  const schema = pages[0]?.schema ?? dataset.schema;
  const fields = schemaFields(schema, true);
  const rows = pages.flatMap((p) => p.data);
  const total = pages[0]?.meta.total ?? 0;
  const editing = editingId ? (rows.find((r) => r.id === editingId) ?? null) : null;
  const ready = dataset.status === 'READY';

  const invalidate = [['dataset-records', dataset.id], ['datasets'], ['record-history']];
  const removeRecord = useApiMutation(
    ({ id, reason }: { id: string; reason?: string }) => api(`/datasets/${dataset.id}/records/${id}`, { method: 'DELETE', query: { reason } }),
    { invalidate },
  );
  const restoreRecord = useApiMutation(
    ({ id, reason }: { id: string; reason?: string }) => api(`/datasets/${dataset.id}/records/${id}/restore`, { method: 'POST', query: { reason } }),
    { invalidate },
  );
  const deleteDataset = useApiMutation(() => api(`/datasets/${dataset.id}`, { method: 'DELETE' }), { invalidate: [['datasets']] });

  /** Pergunta de confirmação com um campo de motivo (opcional) dentro do diálogo. */
  const askReason = async (title: string, confirmLabel: string, danger: boolean) => {
    const box = { reason: '' };
    const ok = await confirm({
      title,
      danger,
      confirmLabel,
      description: (
        <label className="mt-2 block">
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">Motivo (fica no histórico)</span>
          <Textarea
            className="min-h-20"
            maxLength={500}
            placeholder={danger ? 'Ex.: registo duplicado' : 'Ex.: removido por engano'}
            onChange={(e) => {
              box.reason = e.target.value;
            }}
          />
        </label>
      ),
    });
    return ok ? box.reason.trim() || undefined : null;
  };

  const onRemove = async (r: DataRecord) => {
    const reason = await askReason(`Remover o registo #${r.seq}?`, 'Remover', true);
    if (reason === null) return;
    removeRecord.mutate(
      { id: r.id, reason },
      {
        onSuccess: () => toast.success('Registo removido', showDeleted ? 'Continua visível riscado; pode restaurá-lo.' : 'Ative "Mostrar removidos" para o restaurar.'),
        onError: (e) => toast.error('Não foi possível remover', e.message),
      },
    );
  };
  const onRestore = async (r: DataRecord) => {
    const reason = await askReason(`Restaurar o registo #${r.seq}?`, 'Restaurar', false);
    if (reason === null) return;
    restoreRecord.mutate(
      { id: r.id, reason },
      {
        onSuccess: () => toast.success('Registo restaurado'),
        onError: (e) => toast.error('Não foi possível restaurar', e.message),
      },
    );
  };
  const onDeleteDataset = async () => {
    const ok = await confirm({
      title: `Apagar "${dataset.name}"?`,
      description: `Os ${int(dataset.rowCount)} registos e todo o histórico serão apagados definitivamente. Exporte primeiro se precisar de uma cópia.`,
      confirmLabel: 'Apagar definitivamente',
      danger: true,
    });
    if (!ok) return;
    deleteDataset.mutate(undefined, {
      onSuccess: () => {
        toast.success('Dataset apagado', dataset.name);
        onDeleted();
      },
      onError: (e) => toast.error('Não foi possível apagar', e.message),
    });
  };
  const exportAs = async (format: 'xlsx' | 'csv') => {
    setExporting(format);
    try {
      // CSV com ";" abre bem no Excel em português.
      await download(`/datasets/${dataset.id}/download`, format === 'csv' ? { format, delimiter: 'semicolon' } : { format }, `${dataset.name}.${format}`);
      toast.success('Exportação concluída', `${dataset.name}.${format}`);
    } catch (e) {
      toast.error('Não foi possível exportar', (e as Error).message);
    } finally {
      setExporting(null);
    }
  };

  return (
    <motion.section
      aria-labelledby={`ds-${dataset.id}`}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className="shadow-soft overflow-hidden rounded-3xl border border-line bg-surface"
    >
      {/* Cabeçalho do dataset */}
      <div className="relative overflow-hidden border-b border-line p-4 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full opacity-70 blur-3xl" style={{ background: 'var(--accent-soft)' }} />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <KindBadge dataset={dataset} />
              <DatasetStatusBadge status={dataset.status} />
            </div>
            <h2 id={`ds-${dataset.id}`} className="mt-2 text-xl font-extrabold tracking-tight break-words text-ink sm:text-2xl">
              {dataset.name}
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              {canEditData ? (
                <>
                  <strong className="text-ink tabular-nums">{int(total || dataset.rowCount)}</strong> {showDeleted ? 'registos (incluindo removidos)' : 'registos'} · {fields.length} campos
                </>
              ) : (
                <>
                  Vê apenas as suas recolhas: <strong className="text-ink tabular-nums">{int(total)}</strong>
                </>
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {typeCounts({ schema }).map(([type, n]) => (
                <FieldTypeChip key={type} type={type} count={n} />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" icon={Send} onClick={() => setSubmitOpen(true)} disabled={!ready} title={ready ? undefined : 'O dataset ainda não está pronto'}>
              Nova recolha
            </Button>
            {canEditData ? (
              <>
                <Button variant="soft" icon={Columns3} onClick={() => setSchemaOpen(true)}>
                  Colunas
                </Button>
                <Button icon={FileSpreadsheet} loading={exporting === 'xlsx'} disabled={!ready || !!exporting} onClick={() => exportAs('xlsx')}>
                  XLSX
                </Button>
                <Button icon={FileDown} loading={exporting === 'csv'} disabled={!ready || !!exporting} onClick={() => exportAs('csv')}>
                  CSV
                </Button>
              </>
            ) : null}
            {isAdmin ? <IconButton label="Apagar dataset" icon={Trash2} tone="danger" onClick={onDeleteDataset} disabled={deleteDataset.isPending} /> : null}
            <IconButton label="Fechar dados" icon={X} onClick={onClose} />
          </div>
        </div>
        {canEditData ? (
          <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2/70 px-3 py-2">
            <Switch checked={includeDeleted} onChange={setIncludeDeleted} label="Mostrar removidos" />
            {records.isFetching && !records.isFetchingNextPage && !records.isPending ? <span className="text-xs text-ink-3">A atualizar…</span> : null}
          </div>
        ) : null}
      </div>

      {/* Registos */}
      <div className="p-3 sm:p-4">
        {records.isPending ? (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label="A carregar registos">
            <Skeleton className="h-10" />
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : records.isError ? (
          <ErrorState error={records.error} onRetry={() => void records.refetch()} />
        ) : !rows.length ? (
          <EmptyState
            compact
            illustration="clipboard"
            title={canEditData ? 'Ainda não há registos' : 'Ainda não submeteu recolhas'}
            description={ready ? 'Quando a equipa submeter recolhas, aparecem aqui.' : 'O dataset ainda não está pronto.'}
            action={
              ready ? (
                <Button variant="primary" icon={Send} onClick={() => setSubmitOpen(true)}>
                  Nova recolha
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="scrollbar-thin overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <caption className="sr-only">Registos de {dataset.name}</caption>
                <thead>
                  <tr className="border-b border-line bg-surface-2/60 text-left">
                    <th scope="col" className="sticky left-0 z-[1] bg-surface-2 px-3 py-3 text-xs font-bold text-ink-3 uppercase">
                      #
                    </th>
                    {fields.map((f) => (
                      <th key={f.key} scope="col" className={cn('px-3 py-3 text-xs font-bold text-ink-3', f.type === 'number' && 'text-right')}>
                        <span className={cn('inline-flex max-w-[14rem] items-center gap-1.5', f.type === 'number' && 'flex-row-reverse')}>
                          <FieldTypeDot type={f.type} size="sm" />
                          <span className="line-clamp-2">{f.label}</span>
                        </span>
                      </th>
                    ))}
                    <th scope="col" className="px-3 py-3 text-xs font-bold text-ink-3">
                      Recolhido por
                    </th>
                    <th scope="col" className="px-3 py-3 text-xs font-bold text-ink-3">
                      Data
                    </th>
                    <th scope="col" className="px-3 py-3 text-center text-xs font-bold text-ink-3">
                      Correções
                    </th>
                    {canEditData ? (
                      <th scope="col" className="px-3 py-3 text-right text-xs font-bold text-ink-3">
                        <span className="sr-only">Ações</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const deleted = !!r.deletedAt;
                    return (
                      <motion.tr
                        key={r.id}
                        initial={reduce ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i % PAGE_SIZE, 12) * 0.02 }}
                        className={cn('group border-b border-line last:border-0 hover:bg-[var(--accent-soft)]/40', deleted && 'bg-bad-soft/30')}
                      >
                        <th scope="row" className="sticky left-0 z-[1] bg-surface px-3 py-2.5 text-left text-xs font-bold text-ink-3 tabular-nums group-hover:bg-[color-mix(in_oklab,var(--accent-soft)_40%,var(--surface))]">
                          {r.seq}
                          {r.outletId || r.gpsLat !== null ? (
                            <span className="ml-1 inline-flex gap-0.5 align-middle">
                              {r.outletId ? <Store className="size-3" style={{ color: 'var(--m-lojas)' }} aria-label="Com loja" /> : null}
                              {r.gpsLat !== null ? <MapPin className="size-3" style={{ color: 'var(--m-rotas)' }} aria-label="Com GPS" /> : null}
                            </span>
                          ) : null}
                        </th>
                        {fields.map((f) => (
                          <td key={f.key} className={cn('px-3 py-2.5 align-middle text-ink', f.type === 'number' && 'text-right', deleted && 'text-ink-3 line-through decoration-bad/50')}>
                            <CellValue value={r.data[f.key]} type={f.type} />
                          </td>
                        ))}
                        <td className="px-3 py-2.5">
                          <span className="inline-flex max-w-[11rem] items-center gap-2">
                            <Avatar name={r.submittedBy?.name} email={r.submittedBy?.email} size={24} />
                            <span className="truncate text-[13px] text-ink-2">{r.submittedBy?.name ?? r.submittedBy?.email ?? '—'}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[13px] whitespace-nowrap text-ink-2">{dateTime(r.createdAt)}</td>
                        <td className="px-3 py-2.5 text-center">
                          {deleted ? (
                            <Badge tone="bad" icon={Trash2}>
                              Removido
                            </Badge>
                          ) : r.revisions > 0 ? (
                            <Badge tone="info" icon={PencilLine}>
                              {r.revisions}
                            </Badge>
                          ) : (
                            <span className="text-ink-3">—</span>
                          )}
                        </td>
                        {canEditData ? (
                          <td className="px-2 py-1.5">
                            <div className="flex justify-end">
                              {!deleted ? <IconButton label={`Corrigir registo ${r.seq}`} icon={PencilLine} onClick={() => setEditingId(r.id)} /> : null}
                              <IconButton label={`Histórico do registo ${r.seq}`} icon={History} onClick={() => setHistory({ id: r.id, seq: r.seq })} />
                              {deleted ? (
                                <IconButton label={`Restaurar registo ${r.seq}`} icon={RotateCcw} tone="soft" onClick={() => onRestore(r)} />
                              ) : (
                                <IconButton label={`Remover registo ${r.seq}`} icon={Trash2} tone="danger" onClick={() => onRemove(r)} />
                              )}
                            </div>
                          </td>
                        ) : null}
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-col items-center gap-2">
              <p className="text-xs text-ink-3" aria-live="polite">
                A mostrar <strong className="text-ink-2 tabular-nums">{int(rows.length)}</strong> de <span className="tabular-nums">{int(total)}</span>
              </p>
              {records.hasNextPage ? (
                <Button icon={ChevronsDown} loading={records.isFetchingNextPage} onClick={() => void records.fetchNextPage()}>
                  Carregar mais
                </Button>
              ) : null}
              {records.isFetchNextPageError ? <p className="text-xs text-bad">Não foi possível carregar mais registos. Tente de novo.</p> : null}
            </div>
          </>
        )}
      </div>

      <SubmitRecordModal open={submitOpen} onClose={() => setSubmitOpen(false)} dataset={{ ...dataset, schema }} projectId={projectId} />
      {canEditData ? (
        <>
          <EditRecordModal record={editing} datasetId={dataset.id} schema={schema} onClose={() => setEditingId(null)} />
          <RecordHistoryDrawer datasetId={dataset.id} recordId={history?.id ?? null} seq={history?.seq} schema={schema} onClose={() => setHistory(null)} />
          <SchemaEditorModal dataset={{ ...dataset, schema }} open={schemaOpen} onClose={() => setSchemaOpen(false)} />
        </>
      ) : null}
    </motion.section>
  );
}
