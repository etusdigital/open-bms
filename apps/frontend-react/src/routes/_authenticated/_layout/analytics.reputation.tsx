import { createFileRoute } from '@tanstack/react-router';
import PostmasterPage from '@/features/postmaster/postmaster-page';

export const Route = createFileRoute('/_authenticated/_layout/analytics/reputation')({
  component: PostmasterPage,
});
