import type { Metadata } from 'next';
import { ImportsScreen } from './screen';

export const metadata: Metadata = { title: 'Importações' };

export default function Page() {
  return <ImportsScreen />;
}
