import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';

/** Área autenticada: barra lateral, topo e navegação inferior no telemóvel. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
