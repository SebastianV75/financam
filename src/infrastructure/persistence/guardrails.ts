export type PersistenceTarget = 'sqlite' | 'mmkv' | 'zustand';
export type DataScope = 'financial' | 'preferences' | 'ui-cache';

export function assertPersistenceAllowed(target: PersistenceTarget, scope: DataScope) {
  if (scope === 'financial' && target !== 'sqlite') {
    throw new Error('Los datos financieros canónicos solo pueden persistirse en SQLite.');
  }

  return true;
}
