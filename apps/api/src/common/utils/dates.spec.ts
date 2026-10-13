import { safeTimeZone, zonedCalendarDate, zonedDateTime, zonedDayRange, zonedPeriodRange } from './dates.js';

describe('datas no fuso da organização', () => {
  it('08:00 em Maputo (UTC+2) é 06:00 UTC', () => {
    expect(zonedDateTime('2026-10-15', '08:00', 'Africa/Maputo').toISOString()).toBe('2026-10-15T06:00:00.000Z');
    expect(zonedDateTime('2026-10-15', '00:30', 'Africa/Maputo').toISOString()).toBe('2026-10-14T22:30:00.000Z');
    expect(zonedDateTime('2026-10-15', '08:00', 'UTC').toISOString()).toBe('2026-10-15T08:00:00.000Z');
  });

  it('respeita a hora de verão (Lisboa: UTC+1 no verão, UTC no inverno)', () => {
    expect(zonedDateTime('2026-07-01', '08:00', 'Europe/Lisbon').toISOString()).toBe('2026-07-01T07:00:00.000Z');
    expect(zonedDateTime('2026-12-01', '08:00', 'Europe/Lisbon').toISOString()).toBe('2026-12-01T08:00:00.000Z');
  });

  it('o dia de Maputo vai das 22:00 UTC da véspera às 22:00 UTC', () => {
    const r = zonedDayRange('2026-10-15', 'Africa/Maputo');
    expect(r.day).toBe('2026-10-15');
    expect(r.start.toISOString()).toBe('2026-10-14T22:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-10-15T22:00:00.000Z');
  });

  it('um instante é lido no fuso (01:00 em Maputo ainda é "ontem" em UTC)', () => {
    expect(zonedDayRange('2026-10-14T23:00:00Z', 'Africa/Maputo').day).toBe('2026-10-15');
    expect(zonedDayRange('2026-10-14T23:00:00Z', 'UTC').day).toBe('2026-10-14');
  });

  it('muda de mês e de ano', () => {
    expect(zonedDayRange('2026-12-31', 'Africa/Maputo').end.toISOString()).toBe('2026-12-31T22:00:00.000Z');
    expect(zonedDayRange('2026-02-28', 'UTC').end.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('fuso inválido cai para UTC; data inválida dá erro 400', () => {
    expect(safeTimeZone('Marte/Olympus')).toBe('UTC');
    expect(safeTimeZone(undefined)).toBe('UTC');
    expect(safeTimeZone('Africa/Maputo')).toBe('Africa/Maputo');
    expect(zonedDayRange('2026-10-15', 'Marte/Olympus').start.toISOString()).toBe('2026-10-15T00:00:00.000Z');
    expect(() => zonedDayRange('ontem', 'UTC')).toThrow('Data inválida');
  });

  it('presenças: 01:00 em Maputo conta para o dia de Maputo (coluna DATE)', () => {
    expect(zonedCalendarDate('2026-10-14T23:00:00Z', 'Africa/Maputo')).toEqual({
      day: '2026-10-15',
      date: new Date('2026-10-15T00:00:00.000Z'),
    });
  });

  it('período por dias de Maputo, inclusivo, com a lista de dias', () => {
    const r = zonedPeriodRange('2026-10-01', '2026-10-03', 'Africa/Maputo');
    expect(r.start.toISOString()).toBe('2026-09-30T22:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-10-03T22:00:00.000Z');
    expect(r.days).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(zonedPeriodRange(undefined, '2026-10-30', 'UTC').days).toHaveLength(30);
    expect(() => zonedPeriodRange('2026-10-05', '2026-10-01', 'UTC')).toThrow('anterior');
  });
});
