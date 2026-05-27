import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Tracks the currently-running enterprise import so a global progress toast can
// follow the user across navigation (and survive a reload). Persisted to
// localStorage; cleared once the job reaches a terminal state.
interface ActiveImportState {
  jobId: string | null;
  setActiveImport: (jobId: string) => void;
  clearActiveImport: () => void;
}

export const useActiveImportStore = create<ActiveImportState>()(
  persist(
    (set) => ({
      jobId: null,
      setActiveImport: (jobId) => set({ jobId }),
      clearActiveImport: () => set({ jobId: null }),
    }),
    { name: 'bms-active-import', storage: createJSONStorage(() => localStorage) },
  ),
);
