import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WITMO — Know before you watch.',
  description:
    'Wyszukaj film, sprawdź rating IMDb, plakat, opis fabuły i trailer w jednym miejscu.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/branding/favicon-32.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [
      {
        url: '/branding/apple-touch-icon.png',
        type: 'image/png',
        sizes: '180x180',
      },
    ],
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'WITMO',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
