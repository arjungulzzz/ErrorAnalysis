import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Circana | AS Errors Dashboard',
  description: 'Errors from AS Logs DB',
  icons: {
    icon: `data:image/svg+xml,%3csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' fill='%236750A4'/%3e%3cpath d='M12 8v4M12 16h.01' stroke-width='2' stroke='%23FFFFFF' stroke-linecap='round'/%3e%3c/svg%3e`
  }
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
