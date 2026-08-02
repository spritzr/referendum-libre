import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_NETWORK, Network } from '@/constants/rarimo/config';

// Changing the network mid-session invalidates the BJJ-identity / proposal
// cache stored against the previous network. We don't wipe those caches
// here (cheap to refetch + the user expects re-init), but consumers should
// re-create their Rarime/FreedomTool instances when `network` changes.
// See voting-flow.tsx: the SDK refs are nulled out on network change so the
// next entry into Step 7 re-initialises against the new addresses.

interface NetworkState {
  network: Network;
  setNetwork: (n: Network) => void;
}

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set) => ({
      network: DEFAULT_NETWORK,
      setNetwork: (network) => set({ network }),
    }),
    {
      name: '@referendum/network',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
