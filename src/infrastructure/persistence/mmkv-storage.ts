import { MMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

import { assertPersistenceAllowed } from './guardrails';

export const preferencesStorage = new MMKV({
  id: 'financam.preferences',
});

export function createMMKVStateStorage(): StateStorage {
  return {
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
}
