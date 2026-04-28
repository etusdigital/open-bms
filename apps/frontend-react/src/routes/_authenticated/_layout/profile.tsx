import { createFileRoute } from '@tanstack/react-router';
import ProfilePage from '@/features/profile/profile-page';

export const Route = createFileRoute('/_authenticated/_layout/profile')({
  component: ProfilePage,
});
