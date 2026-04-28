import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/lib/theme';
import { queryClient } from '@/lib/query-client';
import { LoadingScreen } from '@/components/loading-screen';
import type { RouterContext } from '@/lib/router-context';

export const Route = createRootRouteWithContext<RouterContext>()({
  pendingComponent: LoadingScreen,
  errorComponent: RootErrorComponent,
  component: RootComponent,
});

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Outlet />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function RootErrorComponent({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  return (
    <div className="bg-background flex h-screen flex-col items-center justify-center gap-4">
      <img src="/logo.png" alt="BMS" className="h-12 w-12 object-contain" />
      <p className="text-destructive text-sm">{message}</p>
      <button
        onClick={() => window.location.replace('/')}
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm"
      >
        Go Home
      </button>
    </div>
  );
}
