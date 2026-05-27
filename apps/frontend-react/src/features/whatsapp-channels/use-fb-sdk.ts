import { useEffect, useState } from 'react';

interface FBSDK {
  init(opts: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }): void;
  login(callback: (response: FBLoginResponse) => void, opts: { config_id: string; response_type: 'code'; override_default_response_type: true }): void;
}

export interface FBLoginResponse {
  authResponse?: {
    code?: string;
    accessToken?: string;
    userID?: string;
  };
  status?: 'connected' | 'not_authorized' | 'unknown';
}

declare global {
  interface Window {
    FB?: FBSDK;
    fbAsyncInit?: () => void;
  }
}

let sdkPromise: Promise<FBSDK> | null = null;

/**
 * Loads the Facebook JS SDK once per page load and resolves with the FB
 * global once `fbAsyncInit` has fired. Subsequent callers reuse the same
 * promise — never re-injects the script tag.
 */
function loadFbSdk(appId: string, version: string): Promise<FBSDK> {
  if (typeof window === 'undefined') return Promise.reject(new Error('FB SDK requires a browser'));
  if (window.FB) return Promise.resolve(window.FB);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<FBSDK>((resolve, reject) => {
    window.fbAsyncInit = () => {
      if (!window.FB) {
        reject(new Error('Facebook SDK loaded but FB global is missing'));
        return;
      }
      window.FB.init({ appId, cookie: true, xfbml: false, version });
      resolve(window.FB);
    };

    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => reject(new Error('Failed to load Facebook SDK (network / adblock?)'));
    document.body.appendChild(script);
  });
  return sdkPromise;
}

export interface UseFbSdkResult {
  fb: FBSDK | null;
  ready: boolean;
  error: string | null;
}

/**
 * Wave 7.4 — Facebook SDK loader hook.
 *
 * Returns `{ fb, ready, error }`. While `appId` is empty (Meta App not yet
 * configured in Super Admin) the hook stays in an idle state — the caller
 * shows a "configure first" hint instead of trying to load the SDK.
 */
export function useFbSdk(appId: string, graphVersion: string): UseFbSdkResult {
  const [state, setState] = useState<UseFbSdkResult>({ fb: null, ready: false, error: null });

  useEffect(() => {
    if (!appId) {
      setState({ fb: null, ready: false, error: null });
      return;
    }
    let cancelled = false;
    loadFbSdk(appId, graphVersion)
      .then((fb) => {
        if (!cancelled) setState({ fb, ready: true, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ fb: null, ready: false, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [appId, graphVersion]);

  return state;
}
