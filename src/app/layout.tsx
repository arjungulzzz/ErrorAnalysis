import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Circana | AS Errors Dashboard',
  description: 'Errors from AS Logs DB',
  icons: {
    icon: `data:image/svg+xml,%3csvg viewBox='0 0 190 200' xmlns='http://www.w3.org/2000/svg'%3e%3cdefs%3e%3clinearGradient id='logo-gradient-favicon' x1='0%25' y1='0%25' x2='100%25' y2='0%25'%3e%3cstop offset='0%25' stop-color='%236750A4' /%3e%3cstop offset='100%25' stop-color='%23EE6B6B' /%3e%3c/linearGradient%3e%3cmask id='logo-mask-favicon'%3e%3cg stroke='white' stroke-width='10' fill='none'%3e%3cellipse cx='45' cy='100' rx='40' ry='95' /%3e%3cellipse cx='60' cy='100' rx='40' ry='95' /%3e%3cellipse cx='75' cy='100' rx='40' ry='95' /%3e%3cellipse cx='90' cy='100' rx='40' ry='95' /%3e%3cellipse cx='105' cy='100' rx='40' ry='95' /%3e%3cellipse cx='120' cy='100' rx='40' ry='95' /%3e%3cellipse cx='135' cy='100' rx='40' ry='95' /%3e%3c/g%3e%3c/mask%3e%3c/defs%3e%3crect x='0' y='0' width='190' height='200' fill='url(%23logo-gradient-favicon)' mask='url(%23logo-mask-favicon)' /%3e%3c/svg%3e`
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
