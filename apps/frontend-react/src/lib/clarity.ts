import Clarity from '@microsoft/clarity';

const CLARITY_PROJECT_ID = import.meta.env.VITE_CLARITY_PROJECT_ID;

let initialized = false;

export function initClarity() {
  if (import.meta.env.PROD && CLARITY_PROJECT_ID) {
    Clarity.init(CLARITY_PROJECT_ID);
    initialized = true;
  }
}

export function grantClarityConsent() {
  if (!initialized) return;
  Clarity.consent();
}

export function identifyClarityUser(userId: string) {
  if (!initialized) return;
  Clarity.identify(userId);
}

export { Clarity };
