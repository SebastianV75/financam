import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { createPreferencesStateStorage } from '@/infrastructure/persistence/preferences-storage';

interface PreferencesStore {
  currency: 'MXN';
  hasSeenOnboarding: boolean;
  setHasSeenOnboarding: (value: boolean) => void;
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      currency: 'MXN',
      hasSeenOnboarding: false,
      setHasSeenOnboarding: (value) => set({ hasSeenOnboarding: value }),
    }),
    {
      name: 'financam-preferences',
      storage: createJSONStorage(createPreferencesStateStorage),
      partialize: (state) => ({
        currency: state.currency,
        hasSeenOnboarding: state.hasSeenOnboarding,
      }),
    },
  ),
);
