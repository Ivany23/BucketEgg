import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthLayout } from '@/components/auth-layout';
import { Skeleton } from '@/components/ui';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Entrar' };

export default function LoginPage() {
  return (
    <AuthLayout title="Bem-vindo de volta 👋" subtitle="Entre para ver as rotas, lojas e vendas da sua equipa.">
      {/* O formulário lê ?expirou=1 do URL: fica dentro de Suspense (Next 16 / Cache Components). */}
      <Suspense fallback={<Skeleton className="h-72" />}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
