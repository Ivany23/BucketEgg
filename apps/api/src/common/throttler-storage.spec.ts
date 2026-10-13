import { FastThrottlerStorage } from './throttler-storage.js';

describe('FastThrottlerStorage', () => {
  afterEach(() => vi.useRealTimers());

  it('conta por chave e bloqueia ao ultrapassar o limite', async () => {
    const s = new FastThrottlerStorage();
    for (let i = 1; i <= 3; i++) {
      const r = await s.increment('user:a', 60_000, 3, 60_000, 'default');
      expect(r).toMatchObject({ totalHits: i, isBlocked: false });
    }
    const blocked = await s.increment('user:a', 60_000, 3, 60_000, 'default');
    expect(blocked.isBlocked).toBe(true);
    expect(blocked.timeToBlockExpire).toBe(60);
    // Outra chave não é afetada
    expect((await s.increment('user:b', 60_000, 3, 60_000, 'default')).isBlocked).toBe(false);
    s.onModuleDestroy();
  });

  it('a janela recomeça depois de expirar', async () => {
    vi.useFakeTimers();
    const s = new FastThrottlerStorage();
    for (let i = 0; i < 4; i++) await s.increment('k', 1000, 3, 1000, 'default');
    expect((await s.increment('k', 1000, 3, 1000, 'default')).isBlocked).toBe(true);
    vi.advanceTimersByTime(1001);
    expect(await s.increment('k', 1000, 3, 1000, 'default')).toMatchObject({ totalHits: 1, isBlocked: false });
    s.onModuleDestroy();
  });

  it('custo constante: 1 milhão de pedidos da mesma chave em menos de 1 segundo', async () => {
    const s = new FastThrottlerStorage();
    const t = Date.now();
    for (let i = 0; i < 1_000_000; i++) await s.increment('user:x', 60_000, 1e9, 60_000, 'default');
    expect(Date.now() - t).toBeLessThan(1000);
    s.onModuleDestroy();
  });
});
