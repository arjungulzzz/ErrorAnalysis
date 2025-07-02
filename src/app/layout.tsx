import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import fs from 'fs';
import path from 'path';

const inter = Inter({ subsets: ['latin'] });

// Check if favicon.ico exists in the public directory. If so, use it.
// Otherwise, fall back to the default favicon.
const faviconPath = fs.existsSync(path.join(process.cwd(), 'public', 'favicon.ico'))
  ? '/favicon.ico'
  : '/favicon-32x32.png';

export const metadata: Metadata = {
  title: 'Circana | AS Errors Dashboard',
  description: 'Errors from AS Logs DB',
  icons: {
    icon: faviconPath,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
