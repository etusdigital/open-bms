import { apiClient } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

export interface FeatureFlags {
  /**
   * True → WhatsApp goes through EvoHub (api.evohub.ai/meta/*); the UI must
   *        render the "Conectar via EvoHub" button.
   * False → Direct Meta Cloud (graph.facebook.com); the UI must render
   *         the "Entrar com Facebook" (Embedded Signup) button.
   *
   * Driven server-side by EVOLUTION_HUB_ENABLED. Changes only on env update
   * + restart — `staleTime: Infinity` is safe.
   */
  evolution_hub_enabled: boolean;

  /** Public Meta App id (NOT a secret). Empty string while admin has not configured the Meta App tab. */
  whatsapp_app_id: string;

  /** Public Embedded Signup config id. Empty string while not configured. */
  whatsapp_config_id: string;

  /** Default Graph API version, e.g. v18.0. */
  whatsapp_graph_version: string;

  /** Public URL the BMS backend is reachable at. Used by Super Admin guides to render the webhook URL admins paste into Meta App. */
  bms_public_url: string;
}

export async function fetchFeatureFlags(): Promise<FeatureFlags> {
  const { data } = await apiClient.get<FeatureFlags>('/feature-flags');
  return data;
}

/**
 * React Query hook returning the install-wide feature flags. The endpoint is
 * public (no Bearer token), so this hook is safe to use on login pages.
 */
export function useFeatureFlags() {
  return useQuery({
    queryKey: queryKeys.featureFlags.all,
    queryFn: fetchFeatureFlags,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/**
 * Convenience hook for the most common call site — render branching by mode.
 */
export function useEvolutionHubEnabled() {
  const { data, isLoading, isError } = useFeatureFlags();
  return {
    enabled: data?.evolution_hub_enabled ?? false,
    isLoading,
    isError,
  };
}
