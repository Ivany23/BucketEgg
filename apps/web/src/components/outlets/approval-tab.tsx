'use client';

import { Check, Hourglass, UserRound, X } from 'lucide-react';
import { useMemo } from 'react';
import { MapView, type MapPoint } from '@/components/map';
import { Button, EmptyState, ErrorState, ListSkeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { ago } from '@/lib/format';
import { useApi, useApiMutation } from '@/lib/query';
import { useSession } from '@/lib/session';
import type { Member, Outlet, Page } from '@/lib/types';
import { OutletCard, OutletGrid } from './outlet-card';
import { STATUS_HEX, hasCoords } from './meta';

export type ReviewStatus = 'ACTIVE' | 'REJECTED';

/** Aprovar/rejeitar uma loja pendente (gestores). */
export function useReviewOutlet(onDone?: (status: ReviewStatus) => void) {
  const toast = useToast();
  return useApiMutation(
    ({ id, status }: { id: string; status: ReviewStatus; name: string }) =>
      api<Outlet>(`/outlets/${id}/review`, { method: 'POST', body: { status } }),
    {
      invalidate: [['outlets'], ['outlet'], ['dashboard']],
      onSuccess: (_d, v) => {
        if (v.status === 'ACTIVE') toast.success('Loja aprovada', `${v.name} já pode ser visitada e entrar em rotas.`);
        else toast.info('Loja rejeitada', v.name);
        onDone?.(v.status);
      },
      onError: (e) => toast.error('Não foi possível rever a loja', e.message),
    },
  );
}

export function usePendingOutlets(projectId: string) {
  return useApi<Page<Outlet>>(['outlets', projectId, 'pending'], `/projects/${projectId}/outlets`, {
    status: 'PENDING_APPROVAL',
    limit: 100,
  });
}

export function ApprovalTab({ projectId, onOpen }: { projectId: string; onOpen: (id: string) => void }) {
  const { isManager } = useSession();
  const q = usePendingOutlets(projectId);
  const team = useApi<Member[]>(['team'], isManager ? '/team' : null);
  const review = useReviewOutlet();

  const names = useMemo(() => new Map((team.data ?? []).map((m) => [m.user.id, m.user.name ?? m.user.email])), [team.data]);
  const rows = useMemo(() => q.data?.data ?? [], [q.data]);
  const points = useMemo<MapPoint[]>(
    () =>
      rows.filter(hasCoords).map((o, i) => ({
        id: o.id,
        lat: o.latitude,
        lng: o.longitude,
        label: o.name,
        number: i + 1,
        color: STATUS_HEX.PENDING_APPROVAL,
      })),
    [rows],
  );

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.isPending) return <ListSkeleton rows={3} />;
  if (!rows.length)
    return (
      <EmptyState
        illustration="success"
        title="Nada por aprovar"
        description="Quando um promotor registar uma loja nova no terreno, ela aparece aqui para revisão."
      />
    );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <div className="flex flex-col gap-3">
        <p className="inline-flex items-center gap-2 text-sm text-ink-2">
          <Hourglass className="size-4 text-warn" aria-hidden />
          {isManager
            ? 'Confirme que a loja existe e não é duplicada antes de aprovar.'
            : 'Estas lojas aguardam a revisão de um supervisor.'}
        </p>
        <OutletGrid className="xl:grid-cols-2">
          {rows.map((o, i) => {
            const creator = o.createdById ? names.get(o.createdById) : null;
            const busy = review.isPending && review.variables?.id === o.id;
            return (
              <OutletCard
                key={o.id}
                outlet={o}
                index={i}
                onOpen={onOpen}
                hideCredit
                aside={
                  points.some((p) => p.id === o.id) ? (
                    <span
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-[#1a1208]"
                      style={{ background: STATUS_HEX.PENDING_APPROVAL }}
                      title="Número no mapa"
                    >
                      {points.findIndex((p) => p.id === o.id) + 1}
                    </span>
                  ) : null
                }
                footer={
                  <div className="flex flex-col gap-3">
                    <p className="inline-flex items-center gap-1.5 text-xs text-ink-2">
                      <UserRound className="size-3.5 text-ink-3" aria-hidden />
                      {creator ? `Registada por ${creator}` : 'Registada no terreno'} · {ago(o.createdAt)}
                    </p>
                    {isManager ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="accent"
                          icon={Check}
                          className="flex-1"
                          loading={busy && review.variables?.status === 'ACTIVE'}
                          disabled={busy}
                          onClick={() => review.mutate({ id: o.id, status: 'ACTIVE', name: o.name })}
                        >
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={X}
                          className="flex-1 text-bad"
                          loading={busy && review.variables?.status === 'REJECTED'}
                          disabled={busy}
                          onClick={() => review.mutate({ id: o.id, status: 'REJECTED', name: o.name })}
                        >
                          Rejeitar
                        </Button>
                      </div>
                    ) : null}
                  </div>
                }
              />
            );
          })}
        </OutletGrid>
      </div>
      <div className="lg:sticky lg:top-4 lg:self-start">
        {points.length ? (
          <MapView points={points} height={360} onSelect={onOpen} />
        ) : (
          <EmptyState illustration="map" title="Sem GPS" description="As lojas pendentes não têm coordenadas." compact />
        )}
      </div>
    </div>
  );
}
