'use client';

import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  Pencil,
  Repeat,
  Route,
  ShoppingCart,
  Store,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Badge, Button, IconButton, cn } from '@/components/ui';
import { date, int } from '@/lib/format';
import type { Project } from '@/lib/types';

/** Cores dos cartões (uma por projeto, estável pela posição). */
export const PROJECT_COLORS = ['var(--m-painel)', 'var(--m-rotas)', 'var(--m-lojas)', 'var(--m-vendas)', 'var(--m-beats)', 'var(--m-dados)', 'var(--m-visitas)'];

const STATS: { key: keyof NonNullable<Project['_count']>; label: string; icon: LucideIcon; color: string }[] = [
  { key: 'outlets', label: 'Lojas', icon: Store, color: 'var(--m-lojas)' },
  { key: 'routes', label: 'Rotas', icon: Route, color: 'var(--m-rotas)' },
  { key: 'orders', label: 'Encomendas', icon: ShoppingCart, color: 'var(--m-vendas)' },
  { key: 'datasets', label: 'Formulários', icon: ClipboardList, color: 'var(--m-dados)' },
  { key: 'beats', label: 'Beats', icon: Repeat, color: 'var(--m-beats)' },
];

export function ProjectCard({
  project,
  color,
  active,
  canManage,
  canDelete,
  busy,
  onUse,
  onEdit,
  onToggleArchive,
  onDelete,
}: {
  project: Project;
  color: string;
  active: boolean;
  canManage: boolean;
  canDelete: boolean;
  busy: boolean;
  onUse: () => void;
  onEdit: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  const reduce = useReducedMotion();
  const archived = project.isArchived;
  return (
    <motion.article
      whileHover={reduce ? undefined : { y: -3 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      aria-label={project.name}
      className={cn(
        'shadow-soft hover:shadow-lift relative flex h-full flex-col overflow-hidden rounded-2xl border bg-surface transition-shadow',
        active ? 'border-transparent' : 'border-line',
        archived && 'opacity-80',
      )}
      style={active ? { boxShadow: `0 0 0 2px ${color}, 0 16px 40px -18px ${color}` } : undefined}
    >
      <div
        aria-hidden
        className="h-20 w-full"
        style={{
          background: archived
            ? 'repeating-linear-gradient(135deg, var(--surface-2) 0 10px, var(--surface-3) 10px 20px)'
            : `radial-gradient(14rem 6rem at 0% 0%, color-mix(in oklab, ${color} 45%, transparent), transparent 70%), linear-gradient(135deg, color-mix(in oklab, ${color} 22%, var(--surface)), var(--surface-2))`,
        }}
      />
      <div className="-mt-9 flex flex-1 flex-col px-4 pb-4">
        <div className="flex items-end justify-between gap-2">
          <span
            className="inline-flex size-14 items-center justify-center rounded-2xl border-4 border-[var(--surface)] shadow-soft"
            style={{ background: archived ? 'var(--surface-3)' : color, color: archived ? 'var(--text-3)' : '#1a1208' }}
          >
            {archived ? <Archive className="size-6" aria-hidden /> : <FolderKanban className="size-6" aria-hidden />}
          </span>
          <div className="flex flex-wrap justify-end gap-1.5 pb-1">
            {active ? (
              <Badge tone="ok" icon={CheckCircle2}>
                Ativo
              </Badge>
            ) : null}
            {archived ? (
              <Badge tone="neutral" icon={Archive}>
                Arquivado
              </Badge>
            ) : null}
          </div>
        </div>

        <h3 className="mt-3 text-lg leading-tight font-extrabold tracking-tight text-ink">{project.name}</h3>
        {project.category ? (
          <p className="mt-1">
            <span
              className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold text-ink"
              style={{ background: `color-mix(in oklab, ${color} 16%, transparent)` }}
            >
              {project.category}
            </span>
          </p>
        ) : null}
        <p className={cn('mt-2 line-clamp-2 text-sm', project.description ? 'text-ink-2' : 'text-ink-3 italic')}>
          {project.description || 'Sem descrição.'}
        </p>

        <ul className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Resumo do projeto">
          {STATS.map((s) => (
            <li
              key={s.key}
              className="flex flex-col items-center gap-0.5 rounded-xl px-1 py-2"
              style={{ background: `color-mix(in oklab, ${s.color} 10%, transparent)` }}
              title={s.label}
            >
              <s.icon className="size-4" style={{ color: s.color }} aria-hidden />
              <span className="text-[15px] leading-tight font-extrabold text-ink tabular-nums">{int(project._count?.[s.key] ?? 0)}</span>
              <span className="w-full truncate text-center text-[10px] font-semibold text-ink-3">{s.label}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          {!archived ? (
            active ? (
              <span className="inline-flex h-8 items-center gap-1.5 text-[13px] font-semibold text-ok">
                <CheckCircle2 className="size-4" aria-hidden /> Projeto em uso
              </span>
            ) : (
              <Button size="sm" variant="soft" onClick={onUse}>
                Usar este projeto
              </Button>
            )
          ) : (
            <span className="text-xs text-ink-3">Criado a {date(project.createdAt)}</span>
          )}
          <span className="flex-1" />
          {canManage ? (
            <>
              <IconButton label={`Editar ${project.name}`} icon={Pencil} onClick={onEdit} />
              <IconButton
                label={archived ? `Desarquivar ${project.name}` : `Arquivar ${project.name}`}
                icon={archived ? ArchiveRestore : Archive}
                onClick={onToggleArchive}
                disabled={busy}
              />
            </>
          ) : null}
          {canDelete ? <IconButton label={`Apagar ${project.name}`} icon={Trash2} tone="danger" onClick={onDelete} /> : null}
        </div>
      </div>
    </motion.article>
  );
}
