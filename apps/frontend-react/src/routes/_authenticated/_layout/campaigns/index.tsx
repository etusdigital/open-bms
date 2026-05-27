import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import {
  campaignsSearchSchema,
  serializeCsvIds,
  serializeCsvStrings,
} from '@/features/campaigns/campaigns-search-schema';
import { loadSavedFilters } from '@/features/campaigns/components/campaigns-filter-bar';
import CampaignsPage from '@/features/campaigns/campaigns-page';

export const Route = createFileRoute('/_authenticated/_layout/campaigns/')({
  validateSearch: campaignsSearchSchema,
  component: CampaignsRoute,
});

function CampaignsRoute() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const restored = useRef(false);

  // Restore saved filters on first load when URL has no filters
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const hasUrlFilters =
      searchParams.status || searchParams.types || searchParams.messages || searchParams.tags || searchParams.segments;
    if (hasUrlFilters) return;
    const saved = loadSavedFilters();
    if (!saved) return;
    const { filters } = saved;
    void navigate({
      to: '.',
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        status: serializeCsvIds(filters.status),
        types: serializeCsvStrings(filters.types),
        messages: serializeCsvStrings(filters.messages),
        tags: serializeCsvIds(filters.tags),
        segments: serializeCsvIds(filters.segments),
      }),
      replace: true,
    } as never);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally run once on mount

  return <CampaignsPage searchParams={searchParams} />;
}
