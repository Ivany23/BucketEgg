import type { Metadata } from 'next';
import { VisitsScreen } from './screen';

export const metadata: Metadata = { title: 'Visitas' };

export default function Page() {
  return <VisitsScreen />;
}
