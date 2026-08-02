import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TERMS_VERSION } from '@/constants/terms';

// The root layout uses `acceptedVersion !== TERMS_VERSION` (once hydrated)
// to decide whether to render the `<TermsGate />` modal over the rest of
// the app. To force a re-acceptance after a CGU change, bump TERMS_VERSION
// in constants/terms.ts.

interface TermsState {
  /** Last version the user tapped "J'accepte" on. null = never accepted. */
  acceptedVersion: string | null;
  /** True once the persisted acceptedVersion has been read from
   * AsyncStorage. Renders that depend on `acceptedVersion` should wait for
   * this to avoid flashing the terms gate during app startup. */
  hydrated: boolean;
  accept: () => void;
  /** Forget the stored acceptance — used by "Tout supprimer". */
  clear: () => void;
}

export const useTermsStore = create<TermsState>()(
  persist(
    (set) => ({
      acceptedVersion: null,
      hydrated: false,
      accept: () => set({ acceptedVersion: TERMS_VERSION }),
      clear: () => set({ acceptedVersion: null }),
    }),
    {
      name: 'terms_accepted_version_store',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => () => useTermsStore.setState({ hydrated: true }),
    }
  )
);
