jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>();

  return {
    MMKV: jest.fn().mockImplementation(() => ({
      getString: jest.fn((key: string) => store.get(key)),
      set: jest.fn((key: string, value: string) => {
        store.set(key, value);
      }),
      delete: jest.fn((key: string) => {
        store.delete(key);
      }),
    })),
  };
});

import { assertPersistenceAllowed } from './guardrails';
import { createPreferencesStateStorage } from './preferences-storage';

describe('createPreferencesStateStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lee y escribe preferencias serializadas en backend MMKV', () => {
    const storage = createPreferencesStateStorage();

    storage.setItem('financam-preferences', '{"state":{"currency":"MXN"}}');
    expect(storage.getItem('financam-preferences')).toBe('{"state":{"currency":"MXN"}}');
  });

  it('elimina preferencias persistidas', () => {
    const storage = createPreferencesStateStorage();

    storage.setItem('financam-preferences', '{"state":{"hasSeenOnboarding":true}}');
    storage.removeItem('financam-preferences');

    expect(storage.getItem('financam-preferences')).toBeNull();
  });

  it('mantiene guardrail: datos financieros no van en MMKV', () => {
    expect(() => assertPersistenceAllowed('mmkv', 'financial')).toThrow(
      'Los datos financieros canónicos solo pueden persistirse en SQLite.',
    );
  });
});
