import { create } from 'zustand';

interface UiStore {
  isHydrated: boolean;
  markHydrated: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  isHydrated: false,
  markHydrated: () => set({ isHydrated: true }),
}));
