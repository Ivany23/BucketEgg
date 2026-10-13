/**
 * Cliente da API BucketEgg (NestJS). O token JWT fica no localStorage deste browser e vai no
 * cabeçalho Authorization; um 401 termina a sessão e leva ao ecrã de entrada.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

const TOKEN_KEY = 'bucketegg.token';
export const UNAUTHORIZED_EVENT = 'bucketegg:unauthorized';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Armazenamento bloqueado (modo privado): a sessão dura só esta página.
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  form?: FormData;
  signal?: AbortSignal;
}

export function buildUrl(path: string, query?: Query): string {
  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  return url.toString();
}

/** Mensagem legível a partir da resposta de erro do NestJS ({ message: string | string[] }). */
function errorMessage(status: number, body: unknown): string {
  const raw = (body as { message?: unknown } | null)?.message;
  if (Array.isArray(raw)) return raw.join(' · ');
  if (typeof raw === 'string' && raw) return raw;
  if (status === 403) return 'Não tem permissão para esta ação.';
  if (status === 404) return 'Não encontrado.';
  if (status === 429) return 'Demasiados pedidos. Aguarde um momento e tente de novo.';
  if (status >= 500) return 'O servidor teve um problema. Tente de novo dentro de instantes.';
  return `Pedido falhou (${status}).`;
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    return await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'Sem ligação ao servidor. Verifique a internet e tente de novo.');
  }
}

async function check(res: Response): Promise<Response> {
  if (res.ok) return res;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // corpo vazio ou não-JSON
  }
  if (res.status === 401 && getToken()) {
    setToken(null);
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  throw new ApiError(res.status, errorMessage(res.status, body), body);
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await check(await send(path, opts));
  // Corpo vazio (204, ou 200 sem conteúdo como GET /visits/active sem visita) = null.
  if (res.status === 204) return null as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Descarrega um ficheiro autenticado (ex.: exportação XLSX/CSV) e oferece-o ao utilizador. */
export async function download(path: string, query: Query, fallbackName: string) {
  const res = await check(await send(path, { query }));
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
