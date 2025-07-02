import ErrorDashboard from "@/components/error-dashboard";
import { Toaster } from "@/components/ui/toaster";
import fs from 'fs';
import path from 'path';

export default function Home() {
  const logoSrc = fs.existsSync(path.join(process.cwd(), 'public', 'favicon.ico'))
    ? '/favicon.ico'
    : '/favicon-32x32.png';

  return (
    <main className="min-h-screen w-full bg-background p-4 sm:p-6 lg:p-8">
      <ErrorDashboard logoSrc={logoSrc} />
      <Toaster />
    </main>
  );
}
