import { createFileRoute } from '@tanstack/react-router';
import { AppLayout } from '@/components/layout/app-layout';

export const Route = createFileRoute('/_authenticated/_layout')({
  component: AppLayout,
});
