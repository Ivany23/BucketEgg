/**
 * Converte CORS_ORIGINS (separadas por vírgula) na lista aceite pelo `enableCors`.
 * Uma origem com `*` vale para um só segmento do nome (sem pontos), útil para as
 * pré-visualizações do Vercel: `https://bucketegg-*.vercel.app`.
 */
export function parseCorsOrigins(raw: string): (string | RegExp)[] {
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)
    .map((o) => {
      if (!o.includes('*')) return o;
      const pattern = o
        .split('*')
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('[a-z0-9-]+');
      return new RegExp(`^${pattern}$`, 'i');
    });
}
