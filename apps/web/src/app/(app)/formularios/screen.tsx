'use client';

import { ClipboardList, FileSpreadsheet, ListChecks, Plus, Rows3, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { DatasetCard } from '@/components/data/dataset-card';
import { DatasetView } from '@/components/data/dataset-view';
import { isImported, schemaFields } from '@/components/data/field-types';
import { FormBuilderModal } from '@/components/data/form-builder';
import { RequireProject } from '@/components/domain';
import { Button, ButtonLink, EmptyState, ErrorState, PageHeader, Skeleton, StatTile } from '@/components/ui';
import { compact, int } from '@/lib/format';
import { useApi } from '@/lib/query';
import { useSession } from '@/lib/session';
import type { Dataset, Project } from '@/lib/types';

/** Dataset pedido no URL (ex.: "Ver dados" nas importações). O ecrã só é desenhado no browser. */
function datasetFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('dataset');
}

export function FormsScreen() {
  return <RequireProject>{(project) => <FormsContent key={project.id} project={project} />}</RequireProject>;
}

function FormsContent({ project }: { project: Project }) {
  const { canEditData } = useSession();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(datasetFromUrl);
  const viewRef = useRef<HTMLDivElement>(null);
  const q = useApi<Dataset[]>(['datasets', project.id], `/datasets/project/${project.id}`);

  const datasets = q.data ?? [];
  const selected = datasets.find((d) => d.id === selectedId) ?? null;
  const forms = datasets.filter((d) => !isImported(d)).length;
  const totalRows = datasets.reduce((s, d) => s + d.rowCount, 0);
  const totalFields = datasets.reduce((s, d) => s + schemaFields(d.schema, true).length, 0);

  const select = (id: string) => {
    const next = selectedId === id ? null : id;
    setSelectedId(next);
    if (next) setTimeout(() => viewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  return (
    <div>
      <PageHeader
        icon={ClipboardList}
        eyebrow={project.name}
        title="Formulários e dados"
        description={
          canEditData
            ? 'Auditorias e inquéritos do terreno e dados importados: consulte, corrija com histórico e exporte.'
            : 'Preencha os formulários no terreno e consulte as recolhas que submeteu.'
        }
        actions={
          canEditData ? (
            <>
              <ButtonLink href="/importacoes" icon={Upload}>
                Importar Excel/CSV
              </ButtonLink>
              <Button variant="primary" icon={Plus} onClick={() => setBuilderOpen(true)}>
                Novo formulário
              </Button>
            </>
          ) : undefined
        }
      />

      {q.isPending ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-52" />
            ))}
          </div>
        </>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !datasets.length ? (
        <EmptyState
          illustration="clipboard"
          title="Ainda não há formulários nem dados"
          description={
            canEditData
              ? 'Crie um formulário (ex.: auditoria de prateleira) para a equipa preencher no terreno, ou importe uma folha de Excel.'
              : 'Quando o seu supervisor criar um formulário para este projeto, aparece aqui para preencher.'
          }
          action={
            canEditData ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" icon={Plus} onClick={() => setBuilderOpen(true)}>
                  Novo formulário
                </Button>
                <ButtonLink href="/importacoes" icon={Upload}>
                  Importar ficheiro
                </ButtonLink>
              </div>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile index={0} label="Formulários" value={forms} icon={ClipboardList} color="var(--m-dados)" hint="Criados para o terreno" />
            <StatTile index={1} label="Importados" value={datasets.length - forms} icon={FileSpreadsheet} color="var(--m-import)" hint="De Excel ou CSV" />
            <StatTile
              index={2}
              label={canEditData ? 'Registos' : 'As minhas recolhas'}
              value={totalRows}
              format={(v) => (totalRows >= 100_000 ? compact(v) : int(v))}
              icon={Rows3}
              color="var(--m-vendas)"
            />
            <StatTile index={3} label="Campos ativos" value={totalFields} icon={ListChecks} color="var(--m-dia)" />
          </div>

          <h2 className="sr-only">Lista de formulários e datasets</h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {datasets.map((d, i) => (
              <li key={d.id}>
                <DatasetCard dataset={d} index={i} selected={d.id === selectedId} onSelect={() => select(d.id)} rowsLabel={canEditData ? 'Registos' : 'As minhas'} />
              </li>
            ))}
          </ul>

          <div ref={viewRef} className="scroll-mt-24 pt-6">
            {selected ? (
              <DatasetView key={selected.id} dataset={selected} projectId={project.id} onClose={() => setSelectedId(null)} onDeleted={() => setSelectedId(null)} />
            ) : (
              <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-3">
                Escolha um formulário ou dataset acima para ver os registos{canEditData ? ', corrigir e exportar' : ' e submeter recolhas'}.
              </p>
            )}
          </div>
        </>
      )}

      {canEditData ? <FormBuilderModal open={builderOpen} onClose={() => setBuilderOpen(false)} projectId={project.id} onCreated={(d) => select(d.id)} /> : null}
    </div>
  );
}
