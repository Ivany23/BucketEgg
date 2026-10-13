'use client';

import { CircleCheck, CircleSlash, Mail, Phone, Users } from 'lucide-react';
import { Avatar, Badge, Card, cn } from '@/components/ui';
import { RoleBadge } from '@/components/domain';
import { ROLE_META, displayName } from '@/components/org/roles';
import type { Member } from '@/lib/types';

export function MemberCard({
  member,
  isSelf,
  colors,
  onOpen,
}: {
  member: Member;
  isSelf: boolean;
  /** Cor de cada supervisor (igual à do organigrama). */
  colors: Map<string, string>;
  onOpen: () => void;
}) {
  const meta = ROLE_META[member.role];
  const name = displayName(member.user);
  return (
    <Card interactive onClick={onOpen} className={cn('group relative h-full overflow-hidden p-4', !member.isActive && 'opacity-70')}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: meta.color }} />
      <div className="flex items-start gap-3">
        <span className="relative">
          <Avatar name={member.user.name} email={member.user.email} size={44} />
          <span
            aria-hidden
            className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-[var(--surface)]"
            style={{ background: member.isActive ? 'var(--ok)' : 'var(--text-3)' }}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[15px] font-bold text-ink">
            <span className="truncate">{name}</span>
            {isSelf ? <span className="shrink-0 rounded-md bg-surface-2 px-1.5 text-[11px] font-semibold text-ink-3">Você</span> : null}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-2">
            <Mail className="size-3.5 shrink-0 text-ink-3" aria-hidden />
            <span className="truncate">{member.user.email}</span>
          </p>
          {member.user.phone ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-2">
              <Phone className="size-3.5 shrink-0 text-ink-3" aria-hidden />
              {member.user.phone}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <RoleBadge role={member.role} />
        {member.isActive ? (
          <Badge tone="ok" icon={CircleCheck}>
            Ativo
          </Badge>
        ) : (
          <Badge tone="neutral" icon={CircleSlash}>
            Inativo
          </Badge>
        )}
        {member.supervising.length > 0 ? (
          <Badge tone="accent" icon={Users}>
            Supervisiona {member.supervising.length}
          </Badge>
        ) : null}
      </div>

      {member.supervisors.length > 0 ? (
        <div className="mt-3 border-t border-line pt-3">
          <p className="mb-1.5 text-[11px] font-bold tracking-wide text-ink-3 uppercase">Supervisão</p>
          <ul className="flex flex-wrap gap-1.5">
            {member.supervisors.map((s) => {
              const color = colors.get(s.id) ?? 'var(--m-config)';
              return (
                <li
                  key={s.id}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-xs font-semibold text-ink"
                  style={{ background: `color-mix(in oklab, ${color} 14%, transparent)` }}
                >
                  <Avatar name={s.user.name} email={s.user.email} size={20} />
                  <span className="truncate">{displayName(s.user)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
