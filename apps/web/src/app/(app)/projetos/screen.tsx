'use client';

import { Archive, ChevronDown, FolderKanban, FolderPlus } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useId, useMemo, useState } from 'react';
import { Button, EmptyState, ErrorState, PageHeader, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { useProject } from '@/lib/project';
import { useApi, useApiMutation } from '@/lib/query';
import { useSession } from '@/lib/session';
import type { Project } from '@/lib/types';
import { DeleteProjectModal } from './delete-project-modal';
import { PROJECT_COLORS, ProjectCard } from './project-card';
import { ProjectFormModal } from './project-form-modal';

export function ProjectsScreen() {
  const { organizationId, organizationName, isManager, isAdmin } = useSession();
  const { projectId, setProjectId } = useProject();
  const toast = useToast();
  const reduce = useReducedMotion();
  const archivedId = useId();
  const q = useApi<Project[]>(['projects', organizationId, 'all'], organizationId ? '/projects' : null, { includeArchived: true });

  const [form, setForm] = useState<{ open: boolean; project: Project | null }>({ open: false, project: null });
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const all = useMemo(() => q.data ?? [], [q.data]);
  // Cor estável por projeto (ordem de criação, independente de filtros/arquivo).
  const colorOf = useMemo(() => {
    const sorted = [...all].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return new Map(sorted.map((p, i) => [p.id, PROJECT_COLORS[i % PROJECT_COLORS.length]]));
  }, [all]);
  const current = all.filter((p) => !p.isArchived);
  const archived = all.filter((p) => p.isArchived);
  const categories = Array.from(new Set(all.map((p) => p.category).filter((c): c is string => !!c)));

  const archive = useApiMutation(
    (p: Project) => api<Project>(`/projects/${p.id}`, { method: 'PATCH', body: { isArchived: !p.isArchived } }),
    {
      invalidate: [['projects']],
      onSuccess: (p) =>
        toast.success(
          p.isArchived ? 'Projeto arquivado' : 'Projeto desarquivado',
          p.isArchived ? `${p.name} deixa de aparecer na escolha de projeto.` : `${p.name} voltou à lista de projetos.`,
        ),
      onError: (e) => toast.error('Não foi possível alterar o projeto', e.message),
    },
  );

  const use = (p: Project) => {
    setProjectId(p.id);
    toast.success('Projeto ativo alterado', `Agora está a trabalhar em ${p.name}.`);
  };

  const renderCard = (p: Project, i: number) => (
    <motion.li
      key={p.id}
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(i, 8) * 0.05, type: 'spring', stiffness: 260, damping: 24 }}
    >
      <ProjectCard
        project={p}
        color={colorOf.get(p.id) ?? PROJECT_COLORS[0]}
        active={!p.isArchived && p.id === projectId}
        canManage={isManager}
        canDelete={isAdmin}
        busy={archive.isPending && archive.variables?.id === p.id}
        onUse={() => use(p)}
        onEdit={() => setForm({ open: true, project: p })}
        onToggleArchive={() => archive.mutate(p)}
        onDelete={() => setDeleting(p)}
      />
    </motion.li>
  );

  return (
    <div>
      <PageHeader
        icon={FolderKanban}
        eyebrow={organizationName ?? undefined}
        title="Projetos"
        description="Campanhas e projetos da organização. O projeto ativo define o que vê nas rotas, lojas, encomendas e formulários."
        actions={
          isManager ? (
            <Button variant="primary" icon={FolderPlus} onClick={() => setForm({ open: true, project: null })}>
              Novo projeto
            </Button>
          ) : null
        }
      />

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="A carregar projetos">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : (
        <>
          {current.length === 0 ? (
            <EmptyState
              illustration="egg"
              title={archived.length ? 'Todos os projetos estão arquivados' : 'Ainda não há projetos'}
              description="Os projetos (campanhas) agrupam lojas, rotas, encomendas e formulários. Crie um para começar a trabalhar."
              action={
                isManager ? (
                  <Button variant="primary" icon={FolderPlus} onClick={() => setForm({ open: true, project: null })}>
                    Criar projeto
                  </Button>
                ) : (
                  <p className="text-sm text-ink-3">Peça a um supervisor ou administrador para criar um projeto.</p>
                )
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Projetos ativos">
              <AnimatePresence initial={true}>{current.map(renderCard)}</AnimatePresence>
            </ul>
          )}

          {archived.length > 0 ? (
            <section className="mt-8">
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                aria-expanded={showArchived}
                aria-controls={archivedId}
                className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-line-strong px-4 py-3 text-left transition-colors hover:bg-surface-2"
              >
                <span className="inline-flex size-9 items-center justify-center rounded-xl bg-surface-2 text-ink-2">
                  <Archive className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">Arquivados ({archived.length})</span>
                  <span className="block text-xs text-ink-3">Escondidos da escolha de projeto; os dados ficam guardados.</span>
                </span>
                <motion.span animate={{ rotate: showArchived ? 180 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
                  <ChevronDown className="size-5 text-ink-3" aria-hidden />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {showArchived ? (
                  <motion.div
                    id={archivedId}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    animate={reduce ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <ul className="grid gap-4 pt-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Projetos arquivados">
                      <AnimatePresence>{archived.map(renderCard)}</AnimatePresence>
                    </ul>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </section>
          ) : null}
        </>
      )}

      <ProjectFormModal
        open={form.open}
        project={form.project}
        categories={categories}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onCreated={(p) => {
          setProjectId(p.id);
          toast.success('Projeto criado', `${p.name} é agora o projeto ativo.`);
        }}
      />
      <DeleteProjectModal project={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}
