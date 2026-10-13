import { permanentDbError } from './import.worker.js';

describe('permanentDbError', () => {
  it('limite de armazenamento da Neon é permanente, com mensagem clara', () => {
    const neon = Object.assign(new Error('could not extend file because project size limit (1024 MB) has been exceeded'), {
      code: '53100',
    });
    expect(permanentDbError(neon)).toMatch(/limite de armazenamento do plano/);
    // Mesmo que o driver não traga o código, a mensagem chega.
    expect(permanentDbError(new Error('project size limit (1024 MB) has been exceeded'))).toMatch(/limite de armazenamento/);
  });

  it('dados inválidos e limites do PostgreSQL são permanentes', () => {
    const bad = Object.assign(new Error('invalid input syntax for type json'), { code: '22P02' });
    expect(permanentDbError(bad)).toBe('invalid input syntax for type json');
    expect(permanentDbError(Object.assign(new Error('x'), { code: '54000' }))).toBe('x');
  });

  it('falhas de rede ou da base a reiniciar podem ser repetidas', () => {
    expect(permanentDbError(Object.assign(new Error('Connection terminated unexpectedly'), {}))).toBeNull();
    expect(permanentDbError(Object.assign(new Error('terminating connection'), { code: '57P01' }))).toBeNull();
    expect(permanentDbError(Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }))).toBeNull();
    expect(permanentDbError(undefined)).toBeNull();
  });
});
