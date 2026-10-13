'use client';

import { Building2, UserX } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Avatar, EmptyState, cn } from '@/components/ui';
import { ROLE_META, SUPERVISOR_ROLES, displayName } from '@/components/org/roles';
import { ROLE_LABEL, type Member } from '@/lib/types';

interface Branch {
  key: string;
  head: Member | null;
  color: string;
  members: Member[];
}

/**
 * Organigrama: organização → supervisores → os seus membros.
 * Cada ramo tem a sua cor. Em ecrãs largos desenha-se na horizontal (linhas em "T");
 * no telemóvel, como árvore vertical com o tronco à esquerda.
 */
export function OrgChart({
  members,
  colors,
  organizationName,
  onOpen,
}: {
  members: Member[];
  colors: Map<string, string>;
  organizationName: string | null;
  onOpen: (m: Member) => void;
}) {
  const reduce = useReducedMotion();
  const active = members.filter((m) => m.isActive);
  const byId = new Map(active.map((m) => [m.id, m]));

  const branches: Branch[] = active
    .filter((m) => colors.has(m.id))
    .map((head) => ({
      key: head.id,
      head,
      color: colors.get(head.id) ?? 'var(--m-equipa)',
      members: head.supervising.map((ref) => byId.get(ref.id)).filter((m): m is Member => !!m),
    }));
  const orphans = active.filter((m) => m.role === 'FIELD_REP' && m.supervisors.filter((s) => byId.has(s.id)).length === 0);
  if (orphans.length) branches.push({ key: 'orphans', head: null, color: 'var(--warn)', members: orphans });

  // Direção (donos/admins sem equipa direta) e analistas ficam junto à raiz.
  const leadership = active.filter((m) => !colors.has(m.id) && SUPERVISOR_ROLES.includes(m.role));
  const analysts = active.filter((m) => m.role === 'ANALYST');

  if (!branches.length) {
    return (
      <EmptyState
        illustration="team"
        title="Ainda não há supervisores"
        description="Atribua supervisores aos promotores para ver aqui a estrutura da equipa."
      />
    );
  }

  return (
    <div className="shadow-soft rounded-2xl border border-line bg-surface p-4 sm:p-6">
      <div className="scrollbar-thin overflow-x-auto pb-2">
        <div className="flex min-w-full flex-col md:inline-flex md:items-center">
          {/* Raiz */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="relative z-10 flex w-full max-w-md flex-col gap-3 self-start rounded-2xl border border-line bg-surface-2 p-4 md:self-center"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)]">
                <Building2 className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-ink">{organizationName ?? 'Organização'}</p>
                <p className="text-xs text-ink-3">
                  {active.length} membros ativos · {branches.filter((b) => b.head).length} equipas
                </p>
              </div>
            </div>
            {leadership.length + analysts.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5" aria-label="Direção e análise">
                {[...leadership, ...analysts].map((m) => (
                  <li key={m.id}>
                    <PersonChip member={m} color={ROLE_META[m.role].color} onOpen={onOpen} />
                  </li>
                ))}
              </ul>
            ) : null}
          </motion.div>

          {/* Tronco */}
          <span aria-hidden className="ml-6 h-6 w-0.5 bg-line-strong md:ml-0" />

          <ul className="ml-6 flex flex-col gap-5 border-l-2 border-line-strong pl-5 md:ml-0 md:flex-row md:gap-0 md:border-l-0 md:pl-0">
            {branches.map((b, i) => (
              <motion.li
                key={b.key}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.06, type: 'spring', stiffness: 260, damping: 24 }}
                className="relative flex flex-col md:w-64 md:shrink-0 md:items-stretch md:px-3 md:pt-6"
              >
                {/* Ligações horizontais (largo) */}
                <span aria-hidden className={cn('absolute top-0 left-0 hidden h-0.5 w-1/2 md:block', i === 0 ? 'bg-transparent' : 'bg-line-strong')} />
                <span
                  aria-hidden
                  className={cn('absolute top-0 right-0 hidden h-0.5 w-1/2 md:block', i === branches.length - 1 ? 'bg-transparent' : 'bg-line-strong')}
                />
                <span aria-hidden className="absolute top-0 left-1/2 hidden h-6 w-0.5 -translate-x-1/2 md:block" style={{ background: b.color }} />
                {/* Ligação ao tronco (telemóvel) */}
                <span aria-hidden className="absolute top-8 -left-5 h-0.5 w-5 md:hidden" style={{ background: b.color }} />

                <BranchHead branch={b} onOpen={onOpen} />

                {b.members.length ? (
                  <ul className="relative mt-2 ml-5 flex flex-col gap-2 pt-1 pl-5" aria-label={`Equipa de ${b.head ? displayName(b.head.user) : 'sem supervisor'}`}>
                    <span aria-hidden className="absolute top-0 bottom-5 left-0 w-0.5 rounded-full" style={{ background: b.color }} />
                    {b.members.map((m, j) => (
                      <motion.li
                        key={m.id}
                        initial={reduce ? false : { opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.06 + j * 0.035, type: 'spring', stiffness: 300, damping: 26 }}
                        className="relative"
                      >
                        <span aria-hidden className="absolute top-1/2 -left-5 h-0.5 w-5" style={{ background: b.color }} />
                        <PersonRow member={m} color={b.color} onOpen={onOpen} shared={m.supervisors.length > 1} />
                      </motion.li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 ml-5 text-xs text-ink-3">Sem membros atribuídos.</p>
                )}
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function BranchHead({ branch, onOpen }: { branch: Branch; onOpen: (m: Member) => void }) {
  const { head, color, members } = branch;
  if (!head) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed p-3" style={{ borderColor: color }}>
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-warn-soft text-warn">
          <UserX className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">Sem supervisor</p>
          <p className="text-xs text-ink-2">{members.length} promotor(es) por atribuir</p>
        </div>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(head)}
      className="flex w-full items-center gap-3 rounded-2xl p-3 text-left text-ink transition-transform hover:-translate-y-0.5"
      style={{ background: `color-mix(in oklab, ${color} 14%, var(--surface))`, boxShadow: `inset 0 0 0 1.5px ${color}` }}
    >
      <Avatar name={head.user.name} email={head.user.email} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{displayName(head.user)}</span>
        <span className="block text-xs text-ink-2">
          {ROLE_LABEL[head.role]} · {members.length} {members.length === 1 ? 'membro' : 'membros'}
        </span>
      </span>
    </button>
  );
}

function PersonRow({ member, color, onOpen, shared }: { member: Member; color: string; onOpen: (m: Member) => void; shared: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(member)}
      className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-2.5 py-2 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      <Avatar name={member.user.name} email={member.user.email} size={30} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-ink">{displayName(member.user)}</span>
        <span className="block truncate text-[11px] text-ink-3">
          {ROLE_LABEL[member.role]}
          {shared ? ` · ${member.supervisors.length} supervisores` : ''}
        </span>
      </span>
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: color }} />
    </button>
  );
}

function PersonChip({ member, color, onOpen }: { member: Member; color: string; onOpen: (m: Member) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(member)}
      className="inline-flex items-center gap-1.5 rounded-full bg-surface py-0.5 pr-2.5 pl-0.5 text-xs font-semibold text-ink transition-colors hover:brightness-95"
      style={{ boxShadow: `inset 0 0 0 1.5px color-mix(in oklab, ${color} 55%, transparent)` }}
    >
      <Avatar name={member.user.name} email={member.user.email} size={22} />
      <span className="max-w-32 truncate">{displayName(member.user)}</span>
      <span className="text-[10px] font-medium text-ink-3">{ROLE_LABEL[member.role]}</span>
    </button>
  );
}
