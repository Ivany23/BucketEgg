/** Normaliza texto para comparação: minúsculas, sem acentos nem pontuação. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Semelhança entre 0 e 1 baseada na distância de Levenshtein. */
export function similarity(a: string, b: string): number {
  const s = normalizeText(a);
  const t = normalizeText(b);
  if (!s.length && !t.length) return 1;
  const prev = Array.from({ length: t.length + 1 }, (_, j) => j);
  for (let i = 1; i <= s.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (s[i - 1] === t[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return 1 - prev[t.length] / Math.max(s.length, t.length);
}

/** Mantém apenas dígitos (útil para comparar telefones escritos de formas diferentes). */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** Chave indexável do telefone: últimos 9 dígitos (ignora indicativo do país e formatação). */
export function phoneKey(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = digitsOnly(phone);
  return digits.length >= 6 ? digits.slice(-9) : null;
}

/** Chave indexável do código externo: minúsculas e sem espaços. */
export function codeKey(code?: string | null): string | null {
  const key = code?.trim().toLowerCase().replace(/\s+/g, '');
  return key || null;
}
