import type { Metadata } from 'next';
import { ProductsScreen } from './screen';

export const metadata: Metadata = { title: 'Produtos' };

export default function Page() {
  return <ProductsScreen />;
}
