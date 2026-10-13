import { haversineMeters, optimizeStopOrder } from './geo.js';

describe('geo utils', () => {
  it('calcula distâncias com Haversine', () => {
    // Maputo -> Matola (~11-13 km em linha reta)
    const d = haversineMeters({ lat: -25.9692, lng: 32.5732 }, { lat: -25.9622, lng: 32.4589 });
    expect(d).toBeGreaterThan(10_000);
    expect(d).toBeLessThan(13_000);
    expect(haversineMeters({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
  });

  it('ordena paragens numa linha pela ordem geográfica', () => {
    const stops = [
      { lat: 0, lng: 0.03 },
      { lat: 0, lng: 0.01 },
      { lat: 0, lng: 0.04 },
      { lat: 0, lng: 0.02 },
    ];
    const { order, distanceM } = optimizeStopOrder(stops, { lat: 0, lng: 0 });
    expect(order).toEqual([1, 3, 0, 2]);
    expect(distanceM).toBeGreaterThan(4000);
    expect(distanceM).toBeLessThan(5000);
  });

  it('melhora uma ordem má com 2-opt', () => {
    // Quadrado: a ordem ótima percorre o perímetro sem cruzar
    const stops = [
      { lat: 0, lng: 0 },
      { lat: 0.01, lng: 0.01 },
      { lat: 0, lng: 0.01 },
      { lat: 0.01, lng: 0 },
    ];
    const { order } = optimizeStopOrder(stops);
    expect(order[0]).toBe(0);
    expect(new Set(order).size).toBe(4);
  });

  it('lida com lista vazia', () => {
    expect(optimizeStopOrder([])).toEqual({ order: [], distanceM: 0 });
  });
});
