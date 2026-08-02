import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Dev-only "extras" list of proposal IDs that the home screen renders
// alongside the main allowlist. Used by app/(tabs)/index.tsx (merges
// extraIds into the fetched proposal list when enabled) and
// app/parametres.tsx (dev-tools section exposes the toggle + text input).

const DEFAULT_IDS = ['48', '47'];

interface ExtraProposalsState {
  extraEnabled: boolean;
  setExtraEnabled: (next: boolean) => void;
  extraIds: string[];
  /** Replace the entire list. Caller is responsible for de-duping and for
   * ensuring each entry parses as a positive integer (the home screen and
   * SDK call sites will throw on garbage). */
  setExtraIds: (next: string[]) => void;
}

export const useExtraProposalsStore = create<ExtraProposalsState>()(
  persist(
    (set) => ({
      extraEnabled: false,
      setExtraEnabled: (extraEnabled) => set({ extraEnabled }),
      extraIds: DEFAULT_IDS,
      setExtraIds: (extraIds) => set({ extraIds }),
    }),
    {
      name: 'extra_proposals_store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
