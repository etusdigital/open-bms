import { createFileRoute } from '@tanstack/react-router';
import { WarmupFormPage } from '@/features/warmups/warmup-form-page';

export const Route = createFileRoute('/_authenticated/_layout/warmups/create')({
  component: WarmupCreateRoute,
});

function WarmupCreateRoute() {
  return <WarmupFormPage />;
}
