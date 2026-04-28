import { create } from 'zustand';
import type { CampaignConfig } from '@/features/campaign-rules/types';

interface CampaignRuleSchedule {
  date: string;
  configs: CampaignConfig[];
}

interface CampaignRuleStore {
  schedule: CampaignRuleSchedule | null;
  currentIndex: number;
  setSchedule: (schedule: CampaignRuleSchedule) => void;
  nextConfig: () => void;
  clear: () => void;
}

export const useCampaignRuleStore = create<CampaignRuleStore>((set) => ({
  schedule: null,
  currentIndex: 0,
  setSchedule: (schedule) => set({ schedule, currentIndex: 0 }),
  nextConfig: () => set((s) => ({ currentIndex: s.currentIndex + 1 })),
  clear: () => set({ schedule: null, currentIndex: 0 }),
}));
