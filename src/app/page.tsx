import ErrorDashboard from "@/components/error-dashboard";
import { Toaster } from "@/components/ui/toaster";

export default function Home() {
  const logoSrc = '/favicon.ico';
  const fallbackSrc = "data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='%2359459e' stroke='%23fafafa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z'/%3e%3cpath d='M12 9v4'/%3e%3cpath d='M12 17h.01'/%3e%3c/svg%3e";

  return (
    <main className="min-h-screen w-full bg-background p-4 sm:p-6 lg:p-8">
      <ErrorDashboard logoSrc={logoSrc} fallbackSrc={fallbackSrc} />
      <Toaster />
    </main>
  );
}
