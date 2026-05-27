import { createFileRoute } from '@tanstack/react-router';
import { listSearchSchema } from '@/hooks/use-list-search-params';
import { z } from 'zod';
import SegmentsPage from '@/features/segments/segments-page';

const segmentsSearchSchema = listSearchSchema.extend({
  status: z.string().default('active').catch('active'),
});

export const Route = createFileRoute('/_authenticated/_layout/segments/')({
  validateSearch: segmentsSearchSchema,
  component: SegmentsRoute,
});

function SegmentsRoute() {
  const searchParams = Route.useSearch();
  return <SegmentsPage searchParams={searchParams} />;
}
