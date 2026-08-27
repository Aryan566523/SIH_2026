import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { ThemeInit } from './theme-init';

export const metadata: Metadata = {
  title: 'ChainSentinel',
  description: 'Crypto Fraud Intelligence Platform',
  icons: {
    icon: '/images/ChainSentinel_AI.png',
    shortcut: '/images/ChainSentinel_AI.png',
    apple: '/images/ChainSentinel_AI.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeInit />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
