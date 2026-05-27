import { useState, useCallback } from 'react';

const STORAGE_KEY = 'segments-column-visibility';

export interface ColumnVisibility {
  lastCountEmail: boolean;
  lastCountWebPush: boolean;
  lastCountMobilePush: boolean;
  lastCountPhone: boolean;
  lastCountWhatsapp: boolean;
}

const DEFAULT_VISIBILITY: ColumnVisibility = {
  lastCountEmail: true,
  lastCountWebPush: true,
  lastCountMobilePush: true,
  lastCountPhone: true,
  lastCountWhatsapp: true,
};

function loadVisibility(): ColumnVisibility {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_VISIBILITY;
    return { ...DEFAULT_VISIBILITY, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_VISIBILITY;
  }
}

function saveVisibility(visibility: ColumnVisibility) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
  } catch {
    // localStorage unavailable
  }
}

export function useColumnVisibility() {
  const [visibility, setVisibility] = useState<ColumnVisibility>(loadVisibility);

  const updateVisibility = useCallback((newVisibility: ColumnVisibility) => {
    setVisibility(newVisibility);
    saveVisibility(newVisibility);
  }, []);

  return { visibility, updateVisibility };
}
