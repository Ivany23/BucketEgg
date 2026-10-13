import type { Metadata } from 'next';
import { DashboardScreen } from './screen';

export const metadata: Metadata = { title: 'Painel' };

export default function Page() {
  return <DashboardScreen />;
}
