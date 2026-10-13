import type { Metadata } from 'next';
import { RoutesScreen } from './screen';

export const metadata: Metadata = { title: 'Rotas' };

export default function Page() {
  return <RoutesScreen />;
}
