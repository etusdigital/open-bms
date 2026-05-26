import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { selectIsSuperAdmin, useAppStore } from '@/stores/app-store';
import ActivityPage from '@/features/super-admin/activity/activity-page';

const searchSchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
});

export const Route = createFileRoute('/_authenticated/_layout/super-admin/activity/')({
  validateSearch: searchSchema,
  beforeLoad: () => {
    const state = useAppStore.getState();
    if (state.auth.status !== 'authenticated') return;
    if (!selectIsSuperAdmin(state)) {
      throw redirect({ to: '/' });
    }
  },
  component: ActivityPage,
});
