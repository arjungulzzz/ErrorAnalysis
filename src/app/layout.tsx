import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Circana | AS Errors Dashboard',
  description: 'Errors from AS Logs DB',
  icons: {
    icon: `data:image/svg+xml,%3csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3e%3cellipse cx='40' cy='50' rx='30' ry='48' fill='none' stroke='%236A2B8B' stroke-width='5'/%3e%3cellipse cx='45' cy='50' rx='30' ry='48' fill='none' stroke='%238A3187' stroke-width='5'/%3e%3cellipse cx='50' cy='50' rx='30' ry='48' fill='none' stroke='%23AC3883' stroke-width='5'/%3e%3cellipse cx='55' cy='50' rx='30' ry='48' fill='none' stroke='%23CA447F' stroke-width='5'/%3e%3cellipse cx='60' cy='50' rx='30' ry='48' fill='none' stroke='%23E15A6F' stroke-width='5'/%3e%3c/svg%3e`
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
