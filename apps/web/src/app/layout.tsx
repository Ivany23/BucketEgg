import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from '@/components/providers';
import { themeBootScript } from '@/lib/theme';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'] });
const mono = JetBrains_Mono({ variable: '--font-mono-face', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'BucketEgg — Route-to-Market', template: '%s · BucketEgg' },
  description: 'Rotas, visitas, vendas e recolha de dados no terreno, numa só plataforma.',
  applicationName: 'BucketEgg',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf8f5' },
    { media: '(prefers-color-scheme: dark)', color: '#110d0a' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt" className={`${jakarta.variable} ${mono.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
