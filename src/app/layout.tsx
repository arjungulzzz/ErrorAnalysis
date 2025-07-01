import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Circana | AS Errors Dashboard',
  description: 'Errors from AS Logs DB',
  icons: {
    icon: `data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='%235A287D'%3e%3cpath d='M50 0C22.38 0 0 22.38 0 50C0 77.62 22.38 100 50 100C77.62 100 100 77.62 100 50C100 22.38 77.62 0 50 0ZM50 88.24C28.9 88.24 11.76 71.1 11.76 50C11.76 28.9 28.9 11.76 50 11.76C71.1 11.76 88.24 28.9 88.24 50C88.24 71.1 71.1 88.24 50 88.24Z' /%3e%3cpath d='M50 23.53C35.39 23.53 23.53 35.39 23.53 50C23.53 64.61 35.39 76.47 50 76.47C64.61 76.47 76.47 64.61 76.47 50C76.47 35.39 64.61 23.53 50 23.53ZM50 64.71C41.88 64.71 35.29 58.12 35.29 50C35.29 41.88 41.88 35.29 50 35.29C58.12 35.29 64.71 41.88 64.71 50C64.71 58.12 58.12 64.71 50 64.71Z' /%3e%3c/svg%3e`
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
