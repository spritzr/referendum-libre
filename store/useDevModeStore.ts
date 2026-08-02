import { create } from 'zustand';

interface DevModeState {
  devMode: boolean;
  setDevMode: (value: boolean) => void;
  _tapCount: number;
  _tapTimer: ReturnType<typeof setTimeout> | null;
  handleVersionTap: () => void;
}

export const useDevModeStore = create<DevModeState>((set, get) => ({
  devMode: false,
  setDevMode: (devMode) => set({ devMode }),
  _tapCount: 0,
  _tapTimer: null,
  handleVersionTap: () => {
    const { _tapTimer } = get();
    if (_tapTimer) clearTimeout(_tapTimer);

    const tapCount = get()._tapCount + 1;
    if (tapCount >= 7) {
      set({ _tapCount: 0, _tapTimer: null, devMode: true });
    } else {
      const timer = setTimeout(() => set({ _tapCount: 0 }), 2000);
      set({ _tapCount: tapCount, _tapTimer: timer });
    }
  },
}));
