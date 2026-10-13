import type { Metadata } from 'next';
import { OutletsScreen } from './screen';

export const metadata: Metadata = {
  title: 'Lojas',
  description: 'Clientes, mapa, aprovações, visitas em atraso e extratos de conta.',
};

export default function Page() {
  return <OutletsScreen />;
}
