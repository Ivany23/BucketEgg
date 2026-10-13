import { parseCorsOrigins } from './cors.js';

const allows = (origins: (string | RegExp)[], origin: string) => origins.some((o) => (typeof o === 'string' ? o === origin : o.test(origin)));

describe('CORS_ORIGINS', () => {
  it('aceita origens exatas, sem espaços nem barra final', () => {
    const o = parseCorsOrigins(' http://localhost:3001 , https://bucketegg.vercel.app/ ');
    expect(o).toEqual(['http://localhost:3001', 'https://bucketegg.vercel.app']);
  });

  it('um * vale para um só segmento do domínio (pré-visualizações do Vercel)', () => {
    const o = parseCorsOrigins('https://bucketegg-*.vercel.app');
    expect(allows(o, 'https://bucketegg-git-main-ivany23.vercel.app')).toBe(true);
    expect(allows(o, 'https://bucketegg-abc123.vercel.app')).toBe(true);
    // não deixa passar outros domínios nem subdomínios encaixados
    expect(allows(o, 'https://bucketegg-x.evil.com')).toBe(false);
    expect(allows(o, 'https://bucketegg-a.b.vercel.app')).toBe(false);
    expect(allows(o, 'https://outro.vercel.app')).toBe(false);
    expect(allows(o, 'http://bucketegg-a.vercel.app')).toBe(false);
  });
});
