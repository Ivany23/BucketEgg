'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { ApiError, UNAUTHORIZED_EVENT, api, getToken, setToken } from './api';
import { TokenContext } from './token-context';
import { ADMIN_ROLES, DATA_ROLES, MANAGEMENT_ROLES, type LoginResponse, type Me, type Role } from './types';

interface Session {
  /** Ainda a ler o token / perfil (primeira pintura no browser). */
  loading: boolean;
  token: string | null;
  me: Me | undefined;
  role: Role | null;
  organizationId: string | null;
  organizationName: string | null;
  isManager: boolean;
  canEditData: boolean;
  isAdmin: boolean;
  isFieldRep: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  register: (data: { email: string; password: string; name?: string; organizationName?: string }) => Promise<LoginResponse>;
  switchOrganization: (organizationId: string) => Promise<void>;
  /** Guarda um token novo (ex.: depois de criar uma organização). */
  adoptToken: (token: string) => Promise<void>;
  logout: () => void;
}

const SessionContext = createContext<Session | null>(null);

// O token vive no localStorage; esta "loja" permite reagir a mudanças (outro separador, 401).
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key?.startsWith('bucketegg.') && cb();
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
};

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  // No servidor (pré-renderização) não há token: `undefined` = "ainda não sei".
  const token = useSyncExternalStore(subscribe, getToken, () => undefined);
  const meQuery = useQuery<Me, ApiError>({
    queryKey: ['me', token ?? ''],
    queryFn: ({ signal }) => api<Me>('/auth/me', { signal }),
    enabled: !!token,
    staleTime: 5 * 60_000,
  });

  const applyToken = useCallback(
    async (next: string | null) => {
      setToken(next);
      qc.clear(); // dados de outra conta/organização nunca ficam visíveis
      notify();
    },
    [qc],
  );

  const logout = useCallback(() => {
    void applyToken(null);
    router.replace('/entrar');
  }, [applyToken, router]);

  useEffect(() => {
    const onUnauthorized = () => {
      notify();
      qc.clear();
      router.replace('/entrar?expirou=1');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [qc, router]);

  const value = useMemo<Session>(() => {
    const me = meQuery.data;
    const role = me?.activeRole ?? null;
    const activeOrg = me?.memberships.find((m) => m.organization.id === me.activeOrganizationId);
    const has = (roles: Role[]) => !!role && roles.includes(role);
    return {
      loading: token === undefined || (!!token && meQuery.isPending),
      token: token ?? null,
      me,
      role,
      organizationId: me?.activeOrganizationId ?? null,
      organizationName: activeOrg?.organization.name ?? null,
      isManager: has(MANAGEMENT_ROLES),
      canEditData: has(DATA_ROLES),
      isAdmin: has(ADMIN_ROLES),
      isFieldRep: role === 'FIELD_REP',
      login: async (email, password) => {
        const res = await api<LoginResponse>('/auth/login', { method: 'POST', body: { email, password } });
        await applyToken(res.access_token);
        return res;
      },
      register: async (data) => {
        const res = await api<LoginResponse>('/auth/register', { method: 'POST', body: data });
        await applyToken(res.access_token);
        return res;
      },
      switchOrganization: async (organizationId) => {
        const res = await api<{ access_token: string }>('/auth/switch-organization', { method: 'POST', body: { organizationId } });
        await applyToken(res.access_token);
      },
      adoptToken: (t) => applyToken(t),
      logout,
    };
  }, [token, meQuery.data, meQuery.isPending, applyToken, logout]);

  return (
    <SessionContext.Provider value={value}>
      <TokenContext.Provider value={token ?? null}>{children}</TokenContext.Provider>
    </SessionContext.Provider>
  );
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession fora do SessionProvider');
  return ctx;
}
