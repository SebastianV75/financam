import { assertPersistenceAllowed } from './guardrails';

describe('assertPersistenceAllowed', () => {
  it('permite datos financieros solo en sqlite', () => {
    expect(assertPersistenceAllowed('sqlite', 'financial')).toBe(true);
    expect(() => assertPersistenceAllowed('mmkv', 'financial')).toThrow(
      'Los datos financieros canónicos solo pueden persistirse en SQLite.',
    );
    expect(() => assertPersistenceAllowed('zustand', 'financial')).toThrow(
      'Los datos financieros canónicos solo pueden persistirse en SQLite.',
    );
  });

  it('permite preferencias y cache fuera de sqlite', () => {
    expect(assertPersistenceAllowed('mmkv', 'preferences')).toBe(true);
    expect(assertPersistenceAllowed('zustand', 'ui-cache')).toBe(true);
  });
});
