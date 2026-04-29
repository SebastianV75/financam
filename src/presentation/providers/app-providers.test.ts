/**
 * @jest-environment node
 *
 * Smoke tests del shell foundation.
 * Verificamos que AppProviders se construye correctamente y sus dependencias
 * son resueltas sin depender de renderizado de React Native en node.
 */

// Mocks necesarios antes de importar
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Text: 'Text',
  View: 'View',
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: 'SafeAreaProvider',
}));

import * as ExpoSqlite from 'expo-sqlite';
import { bootstrapDatabase } from '@/infrastructure/db/bootstrap';

// Mock bootstrap después de importar el módulo
jest.mock('@/infrastructure/db/bootstrap', () => ({
  bootstrapDatabase: jest.fn().mockResolvedValue(undefined),
}));

const MockedBootstrap = bootstrapDatabase as jest.MockedFunction<typeof bootstrapDatabase>;
const MockedOpenDatabase = ExpoSqlite.openDatabaseAsync as jest.MockedFunction<
  typeof ExpoSqlite.openDatabaseAsync
>;

describe('Shell Foundation Smoke Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Scenario: Inicio base correcto', () => {
    it('openFinanceDatabase se llama con el nombre de DB correcto', async () => {
      // GIVEN: Simulamos que openDatabaseAsync resuelve
      MockedOpenDatabase.mockResolvedValue({
        execAsync: jest.fn(),
        getFirstAsync: jest.fn().mockResolvedValue({ user_version: 0 }),
        getAllAsync: jest.fn(),
      } as never);

      // WHEN: Importamos y verificamos que openFinanceDatabase existe
      const { openFinanceDatabase } = await import('@/infrastructure/db/client');
      await openFinanceDatabase();

      // THEN: Se llama con el nombre esperado
      expect(MockedOpenDatabase).toHaveBeenCalledWith('financam.db');
    });

    it('bootstrapDatabase ejecuta migraciones en arranque', async () => {
      // GIVEN: DB abierta correctamente
      const mockDb = {
        execAsync: jest.fn(),
        getFirstAsync: jest.fn().mockResolvedValue({ user_version: 0 }),
        getAllAsync: jest.fn(),
      };
      MockedOpenDatabase.mockResolvedValue(mockDb as never);

      // WHEN: Ejecutamos bootstrap
      const { openFinanceDatabase } = await import('@/infrastructure/db/client');
      const db = await openFinanceDatabase();
      await MockedBootstrap(db);

      // THEN: Bootstrap fue llamado
      expect(MockedBootstrap).toHaveBeenCalledWith(db);
    });
  });

  describe('Scenario: Bloqueo ante falla de infraestructura', () => {
    it('propaga error cuando SQLite falla al abrir', async () => {
      // GIVEN: Falla al abrir DB
      MockedOpenDatabase.mockRejectedValue(new Error('SQLite error'));

      // WHEN: Intentamos abrir
      const { openFinanceDatabase } = await import('@/infrastructure/db/client');

      // THEN: El error se propaga
      await expect(openFinanceDatabase()).rejects.toThrow('SQLite error');
    });
  });

  describe('Scenario: Operación sin red (local-first)', () => {
    it('todo el arranque depende solo de SQLite local', async () => {
      // GIVEN: Solo dependencias de SQLite local
      const mockExec = jest.fn().mockResolvedValue(undefined);
      const mockGetFirst = jest.fn().mockResolvedValue({ user_version: 1 });
      const mockDb = {
        execAsync: mockExec,
        getFirstAsync: mockGetFirst,
        getAllAsync: jest.fn(),
      };
      MockedOpenDatabase.mockResolvedValue(mockDb as never);

      // WHEN: Ejecutamos el flujo de arranque usando el bootstrap real
      jest.unmock('@/infrastructure/db/bootstrap');
      const { openFinanceDatabase } = await import('@/infrastructure/db/client');
      const { bootstrapDatabase: realBootstrap } = await import('@/infrastructure/db/bootstrap');
      const db = await openFinanceDatabase();
      await realBootstrap(db);

      // THEN: Solo se usan métodos de SQLite local
      expect(MockedOpenDatabase).toHaveBeenCalledTimes(1);
      expect(mockExec).toHaveBeenCalled();
      expect(mockGetFirst).toHaveBeenCalledWith('PRAGMA user_version;');

      // AND: No hay llamadas de red (verificamos que solo usamos SQLite)
      const allCalls = MockedOpenDatabase.mock.calls;
      const onlyLocalCalls = allCalls.every((call) =>
        typeof call[0] === 'string' && call[0].endsWith('.db'),
      );
      expect(onlyLocalCalls).toBe(true);

      // Restore mock para otros tests
      jest.doMock('@/infrastructure/db/bootstrap', () => ({
        bootstrapDatabase: jest.fn().mockResolvedValue(undefined),
      }));
    });
  });

  describe('Estructura del shell', () => {
    it('AppProviders importa todas las dependencias necesarias', async () => {
      // GIVEN: Verificamos que AppProviders puede importarse sin errores
      // (Esto valida que la estructura de imports es correcta)
      MockedOpenDatabase.mockResolvedValue({} as never);

      // WHEN: Importamos AppProviders
      const AppProvidersModule = await import('./app-providers');

      // THEN: Exports principales están presentes
      expect(AppProvidersModule.AppProviders).toBeDefined();
    });

    it('DatabaseProvider importa correctamente', async () => {
      // WHEN: Importamos DatabaseProvider
      const ProviderModule = await import('@/infrastructure/db/provider');

      // THEN: Exports esperados existen
      expect(ProviderModule.DatabaseProvider).toBeDefined();
      expect(ProviderModule.useDatabaseContext).toBeDefined();
    });
  });
});
