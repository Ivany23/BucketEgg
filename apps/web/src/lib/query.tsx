'use client';

import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { useContext, useState, type ReactNode } from 'react';
import { ApiError, api, type RequestOptions } from './api';
import { TokenContext } from './token-context';

/**
 * Cache de pedidos: mostra logo o que já tem (rápido) e atualiza em segundo plano.
 * Erros 4xx não se repetem (o pedido está errado ou sem permissão); falhas de rede/5xx tentam mais 2 vezes.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: true,
            retry: (count, error) => {
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
              return count < 2;
            },
          },
          mutations: { retry: false },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

type Query = RequestOptions['query'];

/**
 * GET à API com cache. `path = null` desliga o pedido (ex.: ainda sem projeto escolhido).
 * Sem sessão (token) não pede nada: os ecrãs podem montar enquanto a sessão é lida.
 */
export function useApi<T>(
  key: QueryKey,
  path: string | null,
  query?: Query,
  options?: Omit<UseQueryOptions<T, ApiError>, 'queryKey' | 'queryFn'>,
) {
  const token = useContext(TokenContext);
  return useQuery<T, ApiError>({
    ...options,
    queryKey: [...key, query ?? {}],
    queryFn: ({ signal }) => api<T>(path as string, { query, signal }),
    enabled: path !== null && !!token && (options?.enabled ?? true),
  });
}

/**
 * POST/PATCH/DELETE com invalidação automática das listas afetadas (`invalidate` = prefixos de chaves).
 */
export function useApiMutation<TVars, TResult = unknown>(
  request: (vars: TVars) => Promise<TResult>,
  opts: { invalidate?: QueryKey[]; onSuccess?: (data: TResult, vars: TVars) => void; onError?: (e: ApiError) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation<TResult, ApiError, TVars>({
    mutationFn: request,
    onSuccess: async (data, vars) => {
      await Promise.all((opts.invalidate ?? []).map((queryKey) => qc.invalidateQueries({ queryKey })));
      opts.onSuccess?.(data, vars);
    },
    onError: (e) => opts.onError?.(e),
  });
}
