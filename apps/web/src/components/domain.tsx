'use client';

import {
  Ban,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock,
  FolderKanban,
  Hourglass,
  PackageCheck,
  ShieldCheck,
  Truck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useProject } from '@/lib/project';
import {
  JOB_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  OUTLET_STATUS_LABEL,
  ROLE_LABEL,
  TASK_STATUS_LABEL,
  type JobStatus,
  type OrderStatus,
  type OutletStatus,
  type Role,
  type TaskStatus,
  type Project,
} from '@/lib/types';
import { Badge, ButtonLink, EmptyState, ListSkeleton, type Tone } from './ui';

/* Estados: cor + ícone + texto (nunca só cor). */

const orderMeta: Record<OrderStatus, [Tone, LucideIcon]> = {
  DRAFT: ['neutral', CircleDashed],
  SUBMITTED: ['info', Clock],
  CONFIRMED: ['brand', PackageCheck],
  DELIVERED: ['ok', Truck],
  CANCELLED: ['bad', Ban],
};
export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => (
  <Badge tone={orderMeta[status][0]} icon={orderMeta[status][1]}>
    {ORDER_STATUS_LABEL[status]}
  </Badge>
);

const taskMeta: Record<TaskStatus, [Tone, LucideIcon]> = {
  PENDING: ['neutral', CircleDashed],
  IN_PROGRESS: ['info', CircleDot],
  COMPLETED: ['ok', CheckCircle2],
  MISSED: ['bad', XCircle],
  CANCELLED: ['warn', Ban],
};
export const TaskStatusBadge = ({ status }: { status: TaskStatus }) => (
  <Badge tone={taskMeta[status][0]} icon={taskMeta[status][1]}>
    {TASK_STATUS_LABEL[status]}
  </Badge>
);
/** Cor do marcador no mapa para cada estado de paragem. */
export const taskColor = (status: TaskStatus) =>
  ({ PENDING: 'var(--m-rotas)', IN_PROGRESS: 'var(--m-dia)', COMPLETED: 'var(--ok)', MISSED: 'var(--bad)', CANCELLED: 'var(--text-3)' })[status];

const outletMeta: Record<OutletStatus, [Tone, LucideIcon]> = {
  PENDING_APPROVAL: ['warn', Hourglass],
  ACTIVE: ['ok', CheckCircle2],
  INACTIVE: ['neutral', CircleDashed],
  REJECTED: ['bad', XCircle],
};
export const OutletStatusBadge = ({ status }: { status: OutletStatus }) => (
  <Badge tone={outletMeta[status][0]} icon={outletMeta[status][1]}>
    {OUTLET_STATUS_LABEL[status]}
  </Badge>
);

const jobMeta: Record<JobStatus, [Tone, LucideIcon]> = {
  QUEUED: ['neutral', Clock],
  PROCESSING: ['info', CircleDot],
  COMPLETED: ['ok', CheckCircle2],
  FAILED: ['bad', XCircle],
  CANCELLED: ['warn', Ban],
};
export const JobStatusBadge = ({ status }: { status: JobStatus }) => (
  <Badge tone={jobMeta[status][0]} icon={jobMeta[status][1]}>
    {JOB_STATUS_LABEL[status]}
  </Badge>
);

const roleTone: Record<Role, Tone> = { OWNER: 'brand', ADMIN: 'info', MANAGER: 'accent', ANALYST: 'warn', FIELD_REP: 'ok' };
export const RoleBadge = ({ role }: { role: Role }) => (
  <Badge tone={roleTone[role]} icon={role === 'OWNER' ? ShieldCheck : undefined}>
    {ROLE_LABEL[role]}
  </Badge>
);

/**
 * Páginas que trabalham sobre um projeto: espera pelo projeto ativo e mostra um convite
 * para criar um quando ainda não existe nenhum.
 */
export function RequireProject({ children }: { children: (project: Project) => ReactNode }) {
  const { project, loading } = useProject();
  if (loading) return <ListSkeleton rows={4} />;
  if (!project) {
    return (
      <EmptyState
        illustration="egg"
        title="Ainda não há projetos"
        description="Os projetos (campanhas) agrupam lojas, rotas, encomendas e formulários. Crie o primeiro para começar."
        action={
          <ButtonLink href="/projetos" variant="primary" icon={FolderKanban}>
            Criar projeto
          </ButtonLink>
        }
      />
    );
  }
  return <>{children(project)}</>;
}
