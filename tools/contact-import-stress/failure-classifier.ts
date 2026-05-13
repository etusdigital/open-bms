/**
 * Failure classifier. Precedence (highest first) — see AC8:
 *   1. container-oom  (preempts everything: the box was killed)
 *   2. timeout        (AbortController fired before a status came back)
 *   3. http-5xx       (server error)
 *   4. http-4xx       (config/auth issue — caller's fault, NOT a payload limit)
 *   5. success
 */

export type FailureClass =
  | 'success'
  | 'timeout'
  | 'http-5xx'
  | 'http-413'
  | 'http-4xx'
  | 'container-oom';

export interface ClassifyInput {
  status: number | null;
  aborted: boolean;
  oomKilled: boolean;
}

/**
 * 413 (Payload Too Large) is the binding constraint for THIS test, not a
 * caller misconfiguration. `apps/msgops-api/src/main.ts:72` caps body-parser at
 * 16 MB; a large enough N hits that cap and bounces with 413. We classify it
 * as a limit failure so the runner doesn't abort with `http-4xx` (exit 2) and
 * still bisects to refine the boundary.
 */
export function classify(input: ClassifyInput): FailureClass {
  if (input.oomKilled) return 'container-oom';
  if (input.aborted) return 'timeout';
  if (input.status === null) return 'http-5xx';
  if (input.status === 413) return 'http-413';
  if (input.status >= 500) return 'http-5xx';
  if (input.status >= 400) return 'http-4xx';
  return 'success';
}

/** Whether this class counts as the payload-size limit being hit. */
export function isLimitFailure(c: FailureClass): boolean {
  return (
    c === 'timeout' ||
    c === 'http-5xx' ||
    c === 'http-413' ||
    c === 'container-oom'
  );
}
