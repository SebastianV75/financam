const mockStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

jest.mock('@/infrastructure/persistence/preferences-storage', () => ({
  createPreferencesStateStorage: jest.fn(() => mockStorage),
}));

import { usePreferencesStore } from './preferences-store';

describe('usePreferencesStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePreferencesStore.setState({ currency: 'MXN', hasSeenOnboarding: false });
  });

  it('inicializa con valores por defecto esperados', () => {
    const state = usePreferencesStore.getState();

    expect(state.currency).toBe('MXN');
    expect(state.hasSeenOnboarding).toBe(false);
  });

  it('actualiza onboarding sin tocar moneda', () => {
    usePreferencesStore.getState().setHasSeenOnboarding(true);

    const state = usePreferencesStore.getState();
    expect(state.currency).toBe('MXN');
    expect(state.hasSeenOnboarding).toBe(true);
  });

  it('usa storage de infraestructura al rehidratar persistencia', async () => {
    mockStorage.getItem.mockReturnValueOnce(null);

    await usePreferencesStore.persist.rehydrate();

    expect(mockStorage.getItem).toHaveBeenCalledWith('financam-preferences');
  });

  it('persiste solamente campos permitidos por partialize', () => {
    const partialized = usePreferencesStore.persist.getOptions().partialize?.({
      currency: 'MXN',
      hasSeenOnboarding: true,
      setHasSeenOnboarding: jest.fn(),
    });

    expect(partialized).toEqual({
      currency: 'MXN',
      hasSeenOnboarding: true,
    });
    expect(partialized).not.toHaveProperty('setHasSeenOnboarding');
  });
});
