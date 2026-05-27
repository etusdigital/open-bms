import { useRouterState } from '@tanstack/react-router';

export function PlaceholderPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <h1 className="text-lg font-semibold">Em construção</h1>
      <p className="text-muted-foreground text-sm">
        Página <code className="bg-muted rounded px-1">{pathname}</code> será implementada em breve.
      </p>
    </div>
  );
}
