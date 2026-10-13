import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

// SWC é necessário para emitir metadata de decorators (injeção de dependências do Nest).
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
  },
});
