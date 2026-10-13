'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Clock3, LogIn, LogOut, MapPinOff, PartyPopper, Sunrise } from 'lucide-react';
import { useState } from 'react';
import { GEO_MESSAGES, GeoError, useLocate, useNow, type Coords } from '@/components/field/geo';
import { GpsFailModal, errorText } from '@/components/field/shared';
import { Badge, Button, Card, Skeleton, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { minutes, time } from '@/lib/format';
import { useApi } from '@/lib/query';
import type { AttendanceDay } from '@/lib/types';
import { useToday } from '@/lib/today';

type Action = 'in' | 'out';

/** Presença do próprio utilizador hoje: registar entrada e saída com GPS. */
export function AttendanceCard({ projectId, projectName, meId }: { projectId: string; projectName: string; meId: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const day = useToday();
  const q = useApi<AttendanceDay>(['attendance', projectId, day], day ? `/projects/${projectId}/attendance` : null, { date: day ?? undefined });
  const mine = q.data?.records.find((r) => r.userId === meId);
  const { locate, locating } = useLocate();
  const [sending, setSending] = useState<Action | null>(null);
  const [gpsFail, setGpsFail] = useState<{ action: Action; message: string } | null>(null);

  const send = async (action: Action, pos: Coords | null) => {
    setSending(action);
    try {
      await api(`/attendance/${action === 'in' ? 'clock-in' : 'clock-out'}`, {
        method: 'POST',
        body: { projectId, lat: pos?.lat, lng: pos?.lng },
      });
      toast.success(action === 'in' ? 'Entrada registada. Bom trabalho!' : 'Saída registada. Até amanhã!', pos ? undefined : 'Registado sem localização GPS.');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.info(action === 'in' ? 'Já tinha registado a entrada hoje' : 'Já tinha registado a saída hoje');
      } else if (e instanceof ApiError && e.status === 404) {
        toast.error('Ainda não registou a entrada hoje', 'Registe primeiro a entrada.');
      } else {
        toast.error(action === 'in' ? 'Não foi possível registar a entrada' : 'Não foi possível registar a saída', errorText(e));
      }
    } finally {
      setSending(null);
      await Promise.all([qc.invalidateQueries({ queryKey: ['attendance'] }), qc.invalidateQueries({ queryKey: ['dashboard'] })]);
    }
  };

  const run = async (action: Action) => {
    setGpsFail(null);
    try {
      const pos = await locate();
      await send(action, pos);
    } catch (e) {
      setGpsFail({ action, message: e instanceof GeoError ? e.message : GEO_MESSAGES.unavailable });
    }
  };

  const busy = locating || sending !== null;

  return (
    <Card className="relative overflow-hidden p-4 sm:p-5">
      <span aria-hidden className="pointer-events-none absolute -top-12 -right-12 size-32 rounded-full opacity-20" style={{ background: 'var(--m-visitas)' }} />
      <div className="relative flex items-center gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-2xl" style={{ background: 'var(--m-visitas-soft)', color: 'var(--m-visitas-text)' }}>
          <Clock3 className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-ink">Presença de hoje</h2>
          <p className="truncate text-xs text-ink-3">{projectName}</p>
        </div>
        {mine ? (
          mine.clockOutAt ? (
            <Badge tone="neutral" icon={PartyPopper}>
              Dia terminado
            </Badge>
          ) : (
            <Badge tone="ok" icon={Sunrise}>
              Em serviço
            </Badge>
          )
        ) : null}
      </div>

      <div className="relative mt-4">
        {q.isPending ? (
          <Skeleton className="h-20" />
        ) : q.isError ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-bad-soft px-3 py-2 text-sm text-bad" role="alert">
            Não foi possível ler a presença.
            <Button size="sm" variant="secondary" onClick={() => q.refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : !mine ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-2">Ainda não registou a entrada. Faça-o ao começar o dia de trabalho.</p>
            <Button variant="primary" size="lg" icon={LogIn} loading={busy} onClick={() => run('in')}>
              {locating ? 'A obter localização…' : 'Registar entrada'}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <TimeBox label="Entrada" value={time(mine.clockInAt)} color="var(--m-visitas)" />
              <TimeBox label="Saída" value={mine.clockOutAt ? time(mine.clockOutAt) : '—'} color="var(--m-rotas)" />
              <WorkedBox from={mine.clockInAt} to={mine.clockOutAt} />
            </div>
            {mine.clockInLat === null ? (
              <p className="flex items-center gap-1.5 text-xs text-ink-3">
                <MapPinOff className="size-3.5" aria-hidden /> Entrada registada sem GPS.
              </p>
            ) : null}
            {!mine.clockOutAt ? (
              <Button variant="secondary" size="lg" icon={LogOut} loading={busy} onClick={() => run('out')}>
                {locating ? 'A obter localização…' : 'Registar saída'}
              </Button>
            ) : null}
          </div>
        )}
      </div>

      <GpsFailModal
        open={!!gpsFail}
        module="dia"
        message={gpsFail?.message ?? ''}
        onClose={() => setGpsFail(null)}
        retrying={locating}
        onRetry={() => gpsFail && run(gpsFail.action)}
        fallbacks={
          gpsFail
            ? [
                {
                  label: gpsFail.action === 'in' ? 'Registar entrada sem localização' : 'Registar saída sem localização',
                  hint: 'O supervisor verá que o registo foi feito sem GPS.',
                  onClick: () => {
                    const action = gpsFail.action;
                    setGpsFail(null);
                    void send(action, null);
                  },
                },
              ]
            : []
        }
      />
    </Card>
  );
}

function TimeBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl border border-line p-2" style={{ background: `color-mix(in oklab, ${color} 9%, transparent)` }}>
      <p className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-ink-3">
        <span aria-hidden className="size-2 rounded-full" style={{ background: color }} />
        {label}
      </p>
      <p className="mt-0.5 text-base font-extrabold text-ink tabular-nums">{value}</p>
    </div>
  );
}

/** Tempo trabalhado (a contar enquanto não houver saída). */
function WorkedBox({ from, to }: { from: string; to: string | null }) {
  const now = useNow();
  const end = to ? Date.parse(to) : now;
  return <TimeBox label="Trabalhado" value={minutes(Math.max(0, end - Date.parse(from)) / 60_000)} color="var(--m-dia)" />;
}
