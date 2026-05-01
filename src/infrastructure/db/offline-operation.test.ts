/**
 * Offline/Local-First Operation Tests
 *
 * Verifica que el foundation opera sin requerir conectividad de red.
 * Estas pruebas demuestran el escenario "Operación sin red" de la spec.
 */

// Mock expo-sqlite para simular DB local
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

import * as ExpoSqlite from 'expo-sqlite';
import { SQLiteFinanceRepository } from '@/infrastructure/repositories/sqlite-finance-repository';

const MockedOpenDatabase = ExpoSqlite.openDatabaseAsync as jest.MockedFunction<
  typeof ExpoSqlite.openDatabaseAsync
>;

describe('Offline/Local-First Operation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Scenario: Operación sin red', () => {
    it('lee datos del plan financiero sin requerir red', async () => {
      // GIVEN: DB local con datos
      const mockDb = {
        execAsync: jest.fn().mockResolvedValue(undefined),
        getFirstAsync: jest.fn().mockResolvedValue({ user_version: 1 }),
        getAllAsync: jest.fn().mockResolvedValue([
          {
            id: 'plan-1',
            quincena_id: 'q-2024-01',
            category_id: 'cat-food',
            planned_amount: 50000,
            currency: 'MXN',
          },
        ]),
      };
      MockedOpenDatabase.mockResolvedValue(mockDb as never);

      // WHEN: Abrimos DB y leemos plan
      const { openFinanceDatabase, toDatabaseClient } = await import('@/infrastructure/db/client');
      const db = await openFinanceDatabase();
      const client = toDatabaseClient(db);
      const repository = new SQLiteFinanceRepository(client);
      const plan = await repository.listPlanByQuincena('q-2024-01');

      // THEN: Lectura exitosa sin red
      expect(plan).toHaveLength(1);
      expect(plan[0].planned.amount).toBe(50000);

      // AND: No hay llamadas de red (solo SQLite local)
      expect(mockDb.getAllAsync).toHaveBeenCalled();
      // Verificamos que solo usamos SQLite local
      expect(MockedOpenDatabase).toHaveBeenCalledWith('financam.db');
    });

    it('lee movimientos operativos sin requerir red', async () => {
      // GIVEN: DB local con movimientos
      const mockDb = {
        execAsync: jest.fn().mockResolvedValue(undefined),
        getFirstAsync: jest.fn().mockResolvedValue({ user_version: 1 }),
        getAllAsync: jest.fn().mockResolvedValue([
          {
            id: 'mov-1',
            quincena_id: 'q-2024-01',
            occurred_at: '2024-01-15T10:00:00Z',
            kind: 'expense',
            amount: 25000,
            currency: 'MXN',
          },
        ]),
      };
      MockedOpenDatabase.mockResolvedValue(mockDb as never);

      // WHEN: Leemos movimientos
      const { openFinanceDatabase, toDatabaseClient } = await import('@/infrastructure/db/client');
      const db = await openFinanceDatabase();
      const client = toDatabaseClient(db);
      const repository = new SQLiteFinanceRepository(client);
      const movements = await repository.listMovementsByQuincena('q-2024-01');

      // THEN: Movimientos disponibles offline
      expect(movements).toHaveLength(1);
      expect(movements[0].kind).toBe('expense');
      expect(movements[0].amount.amount).toBe(25000);

      // AND: Todo desde SQLite local
      const allCalls = mockDb.getAllAsync.mock.calls;
      expect(allCalls.length).toBeGreaterThan(0);
      const sqlCall = allCalls[0][0] as string;
      expect(sqlCall).toContain('FROM operational_movements');
    });

    it('lista cuentas offline desde SQLite', async () => {
      const mockDb = {
        execAsync: jest.fn().mockResolvedValue(undefined),
        getFirstAsync: jest.fn().mockResolvedValue({ user_version: 2 }),
        getAllAsync: jest.fn().mockResolvedValue([
          {
            id: 'acc-1',
            name: 'Efectivo',
            type: 'cash',
            is_active: 1,
          },
        ]),
      };
      MockedOpenDatabase.mockResolvedValue(mockDb as never);

      const { openFinanceDatabase, toDatabaseClient } = await import('@/infrastructure/db/client');
      const db = await openFinanceDatabase();
      const client = toDatabaseClient(db);
      const repository = new SQLiteFinanceRepository(client);

      const accounts = await repository.listAccounts();

      expect(accounts).toEqual([{ id: 'acc-1', name: 'Efectivo', type: 'cash', isActive: true }]);
      expect(MockedOpenDatabase).toHaveBeenCalledWith('financam.db');
    });

    it('permite alta offline de ingreso y gasto válidos', async () => {
      const mockDb = {
        execAsync: jest.fn().mockResolvedValue(undefined),
        getFirstAsync: jest.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('PRAGMA user_version')) return { user_version: 2 };
          if (sql.includes('FROM quincenas')) {
            return {
              id: 'q-2024-01',
              starts_at: '2024-01-01',
              ends_at: '2024-01-15',
              label: '2024-01-01 al 2024-01-15',
            };
          }
          return null;
        }),
        getAllAsync: jest.fn().mockResolvedValue([]),
      };
      MockedOpenDatabase.mockResolvedValue(mockDb as never);

      const { openFinanceDatabase, toDatabaseClient } = await import('@/infrastructure/db/client');
      const db = await openFinanceDatabase();
      const client = toDatabaseClient(db);
      const repository = new SQLiteFinanceRepository(client);

      await repository.createOperationalMovement({
        id: 'income-1',
        quincenaId: 'q-2024-01',
        occurredAt: '2024-01-01T10:00:00Z',
        kind: 'income',
        amount: { amount: 12000, currency: 'MXN' },
        fromAccountId: null,
        toAccountId: 'acc-1',
        categoryId: 'cat-1',
      });

      await repository.createOperationalMovement({
        id: 'expense-1',
        quincenaId: 'q-2024-01',
        occurredAt: '2024-01-01T12:00:00Z',
        kind: 'expense',
        amount: { amount: 3000, currency: 'MXN' },
        fromAccountId: 'acc-1',
        toAccountId: null,
        categoryId: 'cat-2',
      });

      const sqlCalls = mockDb.execAsync.mock.calls.map((call) => String(call[0]));
      expect(sqlCalls.some((sql) => sql.includes('BEGIN TRANSACTION;'))).toBe(true);
      expect(sqlCalls.some((sql) => sql.includes('COMMIT;'))).toBe(true);
      expect(
        sqlCalls.some(
          (sql) =>
            sql.includes('INSERT INTO operational_movements') &&
            sql.includes("'income'") &&
            sql.includes("'expense'"),
        ),
      ).toBe(false);
      expect(
        sqlCalls.filter((sql) => sql.includes('INSERT INTO operational_movements')).length,
      ).toBeGreaterThanOrEqual(2);
    });

    it('arquitectura no asume sincronización remota en foundation', async () => {
      // GIVEN: Solo tenemos métodos de persistencia local
      const mockDb = {
        execAsync: jest.fn(),
        getFirstAsync: jest.fn().mockResolvedValue({ user_version: 1 }),
        getAllAsync: jest.fn().mockResolvedValue([]),
      };
      MockedOpenDatabase.mockResolvedValue(mockDb as never);

      // WHEN: Verificamos que el módulo de persistencia solo exporta operaciones locales
      const DbModule = await import('@/infrastructure/db/client');
      const exports = Object.keys(DbModule);

      // THEN: Solo exports relacionados con SQLite local
      expect(exports).toContain('openFinanceDatabase');
      expect(exports).toContain('toDatabaseClient');

      // AND: No hay métodos de sincronización o remoto
      const syncMethods = exports.filter((e) =>
        /sync|remote|cloud|upload|download|fetch/i.test(e),
      );
      expect(syncMethods).toHaveLength(0);
    });
  });

  describe('Evolución de esquema sin red', () => {
    it('migraciones aplican sobre DB local sin requerir red', async () => {
      // GIVEN: DB en versión 0
      const mockDb = {
        execAsync: jest.fn().mockResolvedValue(undefined),
        getFirstAsync: jest.fn().mockResolvedValue({ user_version: 0 }),
        getAllAsync: jest.fn().mockResolvedValue([]),
      };
      MockedOpenDatabase.mockResolvedValue(mockDb as never);

      // WHEN: Ejecutamos migraciones
      const { openFinanceDatabase } = await import('@/infrastructure/db/client');
      const { bootstrapDatabase } = await import('@/infrastructure/db/bootstrap');
      const db = await openFinanceDatabase();
      await bootstrapDatabase(db);

      // THEN: Migraciones aplicadas localmente
      expect(mockDb.execAsync).toHaveBeenCalledWith(
        expect.stringContaining('PRAGMA journal_mode'),
      );
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith('PRAGMA user_version;');
    });
  });
});
