import type { Metadata } from 'next';
import { FormsScreen } from './screen';

export const metadata: Metadata = { title: 'Formulários e dados' };

export default function Page() {
  return <FormsScreen />;
}
