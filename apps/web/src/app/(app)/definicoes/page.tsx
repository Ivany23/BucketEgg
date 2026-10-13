import type { Metadata } from 'next';
import { SettingsScreen } from './screen';

export const metadata: Metadata = { title: 'Definições' };

export default function Page() {
  return <SettingsScreen />;
}
