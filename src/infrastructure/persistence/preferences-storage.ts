import type { StateStorage } from 'zustand/middleware';

import { createMMKVStateStorage } from './mmkv-storage';

export type PreferencesStorageBackend = 'mmkv';

export interface PreferencesStateStorage {
  getItem(name: string): string | null;
  setItem(name: string, value: string): void;
  removeItem(name: string): void;
}

export function createPreferencesStateStorage(
  backend: PreferencesStorageBackend = 'mmkv',
): StateStorage {
  if (backend === 'mmkv') {
    return createMMKVStateStorage();
  }

  return createMMKVStateStorage();
}
