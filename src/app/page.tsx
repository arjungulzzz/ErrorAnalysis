import ErrorDashboard from "@/components/error-dashboard";
import { Toaster } from "@/components/ui/toaster";

export default function Home() {
  return (
    <main className="min-h-screen w-full bg-background p-4 sm:p-6 lg:p-8">
      <ErrorDashboard />
      <Toaster />
    </main>
  );
}
