'use client';

import { BarChart3, Crown, type LucideIcon, ShieldCheck, UserCog, UserRound } from 'lucide-react';
import { useId } from 'react';
import { cn } from '@/components/ui';
import { ROLE_LABEL, type Member, type Role } from '@/lib/types';

/** Ordem de apresentação (do mais ao menos privilegiado). */
export const ROLE_ORDER: Role[] = ['OWNER', 'ADMIN', 'MANAGER', 'ANALYST', 'FIELD_REP'];

/** Papéis que podem supervisionar outros membros (igual a SUPERVISOR_ROLES na API). */
export const SUPERVISOR_ROLES: Role[] = ['OWNER', 'ADMIN', 'MANAGER'];

/**
 * Papéis que cada papel pode atribuir ou gerir — espelho de `MANAGEABLE` / `assertCanManageRole`
 * em apps/api/src/users/users.service.ts (a API devolve 403 nos restantes casos).
 */
const MANAGEABLE: Record<Role, Role[]> = {
  OWNER: ['OWNER', 'ADMIN', 'MANAGER', 'ANALYST', 'FIELD_REP'],
  ADMIN: ['ADMIN', 'MANAGER', 'ANALYST', 'FIELD_REP'],
  MANAGER: ['FIELD_REP'],
  ANALYST: [],
  FIELD_REP: [],
};

export const assignableRoles = (actor: Role | null): Role[] => (actor ? MANAGEABLE[actor] : []);
export const canManageRole = (actor: Role | null, target: Role) => !!actor && MANAGEABLE[actor].includes(target);

export const ROLE_META: Record<Role, { color: string; soft: string; text: string; icon: LucideIcon; description: string }> = {
  OWNER: {
    color: 'var(--m-painel)',
    soft: 'var(--m-painel-soft)',
    text: 'var(--m-painel-text)',
    icon: Crown,
    description: 'Controlo total: definições, projetos, catálogo e equipa.',
  },
  ADMIN: {
    color: 'var(--m-rotas)',
    soft: 'var(--m-rotas-soft)',
    text: 'var(--m-rotas-text)',
    icon: ShieldCheck,
    description: 'Gere a organização, o catálogo e todos os membros exceto donos.',
  },
  MANAGER: {
    color: 'var(--m-equipa)',
    soft: 'var(--m-equipa-soft)',
    text: 'var(--m-equipa-text)',
    icon: UserCog,
    description: 'Planeia rotas, aprova lojas e acompanha os seus promotores.',
  },
  ANALYST: {
    color: 'var(--m-dia)',
    soft: 'var(--m-dia-soft)',
    text: 'var(--m-dia-text)',
    icon: BarChart3,
    description: 'Corrige, importa e exporta os dados recolhidos.',
  },
  FIELD_REP: {
    color: 'var(--m-visitas)',
    soft: 'var(--m-visitas-soft)',
    text: 'var(--m-visitas-text)',
    icon: UserRound,
    description: 'Trabalho de terreno: rotas, visitas, encomendas e cobranças.',
  },
};

/** Cores dos ramos do organigrama (uma por supervisor). */
export const BRANCH_COLORS = [
  'var(--m-equipa)',
  'var(--m-rotas)',
  'var(--m-lojas)',
  'var(--m-vendas)',
  'var(--m-dia)',
  'var(--m-dados)',
  'var(--m-visitas)',
  'var(--m-produtos)',
  'var(--m-import)',
];

/** Supervisores ativos (por ordem da lista) → cor estável para cada um. */
export function branchColorMap(members: Member[]): Map<string, string> {
  const map = new Map<string, string>();
  members
    .filter((m) => m.isActive && SUPERVISOR_ROLES.includes(m.role) && (m.supervising.length > 0 || m.role === 'MANAGER'))
    .forEach((m, i) => map.set(m.id, BRANCH_COLORS[i % BRANCH_COLORS.length]));
  return map;
}

export const displayName = (u: { name: string | null; email?: string }) => u.name?.trim() || u.email || 'Sem nome';

/** Escolha de papel em cartões (radio acessível). */
export function RolePicker({
  value,
  onChange,
  roles,
  disabled,
  legend = 'Papel',
}: {
  value: Role;
  onChange: (r: Role) => void;
  roles: Role[];
  disabled?: boolean;
  legend?: string;
}) {
  const name = useId();
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-1.5 text-[13px] font-semibold text-ink-2">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {roles.map((r) => {
          const meta = ROLE_META[r];
          const checked = value === r;
          const Icon = meta.icon;
          return (
            <label
              key={r}
              className={cn(
                'relative flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-[border,box-shadow,background] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--ring)]',
                checked ? 'border-transparent shadow-soft' : 'border-line hover:border-line-strong',
                disabled && 'cursor-not-allowed opacity-60',
              )}
              style={checked ? { background: meta.soft, boxShadow: `0 0 0 2px ${meta.color}` } : undefined}
            >
              <input
                type="radio"
                name={name}
                value={r}
                checked={checked}
                onChange={() => onChange(r)}
                className="sr-only"
              />
              <span
                aria-hidden
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `color-mix(in oklab, ${meta.color} 18%, transparent)`, color: meta.text }}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink">{ROLE_LABEL[r]}</span>
                <span className="block text-xs leading-snug text-ink-2">{meta.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
