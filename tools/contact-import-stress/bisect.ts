/**
 * Binary-search the limit between a known success and a known failure.
 *
 * Invariant: caller already proved `attempt(lastSuccess) = success` and
 * `attempt(firstFail) ∈ {timeout, http-5xx, container-oom}`. We narrow the gap
 * until it's <= step OR we hit maxIter.
 */

import { isLimitFailure, type FailureClass } from './failure-classifier';

export interface BisectOptions {
  lastSuccess: number;
  firstFail: number;
  step: number;
  maxIter: number;
  attempt: (n: number) => Promise<FailureClass>;
}

export interface BisectResult {
  lastSuccess: number;
  firstFail: number;
  iterations: number;
}

export async function bisect(opts: BisectOptions): Promise<BisectResult> {
  let { lastSuccess, firstFail } = opts;
  if (lastSuccess >= firstFail) {
    throw new Error(
      `bisect: lastSuccess (${lastSuccess}) must be < firstFail (${firstFail})`,
    );
  }
  const step = Math.max(1, Math.floor(opts.step));
  const maxIter = Math.max(1, Math.floor(opts.maxIter));

  let iterations = 0;
  while (firstFail - lastSuccess > step && iterations < maxIter) {
    const mid = Math.floor((lastSuccess + firstFail) / 2);
    // Defensive: if integer math collapses to a known endpoint, we're done.
    if (mid === lastSuccess || mid === firstFail) break;

    iterations += 1;
    const cls = await opts.attempt(mid);
    if (cls === 'http-4xx') {
      // Caller's contract: 4xx is a config bug, not a limit. Stop refining.
      throw new Error('bisect: http-4xx surfaced mid-bisection — aborting');
    }
    if (isLimitFailure(cls)) {
      firstFail = mid;
    } else {
      lastSuccess = mid;
    }
  }

  return { lastSuccess, firstFail, iterations };
}
