import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { assertPersistenceAllowed } from '@/infrastructure/persistence/guardrails';
import { preferencesStorage } from '@/infrastructure/persistence/mmkv-storage';

const mmkvJsonStorage: StateStorage = {
  getItem: (name) => {
    const value = preferencesStorage.getString(name);
    return value ?? null;
  },
  setItem: (name, value) => {
    assertPersistenceAllowed('mmkv', 'preferences');
    preferencesStorage.set(name, value);
  },
  removeItem: (name) => {
    preferencesStorage.delete(name);
  },
};

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
      storage: createJSONStorage(() => mmkvJsonStorage),
      partialize: (state) => ({
        currency: state.currency,
        hasSeenOnboarding: state.hasSeenOnboarding,
      }),
    },
  ),
);
