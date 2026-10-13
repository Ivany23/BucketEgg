import { digitsOnly, normalizeText, similarity } from './text.js';

describe('text utils', () => {
  it('normaliza acentos e pontuação', () => {
    expect(normalizeText('  Mercearia São-João!! ')).toBe('mercearia sao joao');
  });

  it('mede semelhança de nomes', () => {
    expect(similarity('Loja do Zé', 'loja do ze')).toBe(1);
    expect(similarity('Mercearia Central', 'Mercaria Central')).toBeGreaterThan(0.9);
    expect(similarity('Farmácia Popular', 'Bottle Store Matola')).toBeLessThan(0.5);
  });

  it('extrai dígitos de telefones', () => {
    expect(digitsOnly('+258 84-000 0000')).toBe('258840000000');
  });
});
