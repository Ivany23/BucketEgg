import type { Metadata } from 'next';
import { MyDayScreen } from './screen';

export const metadata: Metadata = { title: 'O meu dia' };

export default function Page() {
  return <MyDayScreen />;
}
