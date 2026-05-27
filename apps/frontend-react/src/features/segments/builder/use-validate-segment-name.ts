import { useState, useRef, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid';

interface UseValidateSegmentNameReturn {
  state: ValidationState;
  canSubmit: boolean;
  validate: (name: string) => void;
  reset: () => void;
}

const DEBOUNCE_MS = 300;
const MIN_NAME_LENGTH = 3;

/**
 * Name validation state machine hook.
 * States: IDLE → VALIDATING → VALID | INVALID
 * Uses request counter to discard stale responses.
 *
 * @param excludeId - Segment ID to exclude from uniqueness check (edit mode)
 */
export function useValidateSegmentName(excludeId?: number): UseValidateSegmentNameReturn {
  const [state, setState] = useState<ValidationState>('idle');
  const requestCounterRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const validate = useCallback(
    (name: string) => {
      // Clear any pending debounce
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // Reset to idle for empty or short names
      if (!name || name.trim().length < MIN_NAME_LENGTH) {
        setState('idle');
        return;
      }

      // Debounce the API call
      timerRef.current = setTimeout(async () => {
        const requestId = ++requestCounterRef.current;
        setState('validating');

        try {
          const { data } = await apiClient.get<{ exists: boolean }>('/tags/validate-name', {
            params: {
              titleCreate: name.trim(),
              ...(excludeId && { id: excludeId }),
            },
          });

          // Discard stale response (a newer request has been made)
          if (requestId !== requestCounterRef.current) return;

          setState(data.exists ? 'invalid' : 'valid');
        } catch {
          // On error, fall back to idle (don't block the user)
          if (requestId === requestCounterRef.current) {
            setState('idle');
          }
        }
      }, DEBOUNCE_MS);
    },
    [excludeId],
  );

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    requestCounterRef.current++;
    setState('idle');
  }, []);

  return {
    state,
    canSubmit: state !== 'validating' && state !== 'invalid',
    validate,
    reset,
  };
}
