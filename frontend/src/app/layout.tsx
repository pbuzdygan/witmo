import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WITMO — What is the movie about?',
  description:
    'Wyszukaj film, sprawdź rating IMDb, plakat, opis fabuły i trailer w jednym miejscu.',
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
