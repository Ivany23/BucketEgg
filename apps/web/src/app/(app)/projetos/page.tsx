import type { Metadata } from 'next';
import { ProjectsScreen } from './screen';

export const metadata: Metadata = { title: 'Projetos' };

export default function Page() {
  return <ProjectsScreen />;
}
