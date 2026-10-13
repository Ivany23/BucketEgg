import type { Metadata } from 'next';
import { TeamScreen } from './screen';

export const metadata: Metadata = { title: 'Equipa' };

export default function Page() {
  return <TeamScreen />;
}
