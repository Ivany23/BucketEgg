import type { Metadata } from 'next';
import { BeatsScreen } from './screen';

export const metadata: Metadata = { title: 'Beats' };

export default function Page() {
  return <BeatsScreen />;
}
