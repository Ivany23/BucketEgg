import type { Metadata } from 'next';
import { OrdersScreen } from './screen';

export const metadata: Metadata = { title: 'Encomendas' };

export default function Page() {
  return <OrdersScreen />;
}
