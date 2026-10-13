'use client';

import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/lib/query';
import { SessionProvider } from '@/lib/session';
import { ConfirmProvider, ToastProvider } from './ui/overlay';

/** Provedores globais. As animações respeitam "reduzir movimento" do sistema. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <QueryProvider>
        <SessionProvider>
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </SessionProvider>
      </QueryProvider>
    </MotionConfig>
  );
}
