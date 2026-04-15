import type { Metadata, Viewport } from 'next';

import './globals.css';
import 'leaflet/dist/leaflet.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: {
    template: '%s | Nustech-AttendenX',
    default: 'Nustech-AttendenX — Sistem Absensi',
  },
  description: 'Sistem absensi, monitoring lapangan, dispatch tugas, dan manajemen cuti',
  keywords: ['absensi', 'attendance', 'nustech', 'monitoring', 'kunjungan'],
  robots: { index: false, follow: false }, // internal app
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F2F2F7' },
    { media: '(prefers-color-scheme: dark)',  color: '#0d1b2e' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
