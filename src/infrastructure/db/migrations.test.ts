import { FOUNDATION_MIGRATIONS, migrateDatabase } from './migrations';

describe('migrateDatabase', () => {
  it('aplica las migraciones pendientes y actualiza user_version', async () => {
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const withTransaction = jest.fn().mockImplementation(async (operation) => operation());

    const applied = await migrateDatabase(
      {
        execAsync,
        getAllAsync: jest.fn(),
        getFirstAsync: jest.fn(),
        withTransaction,
      },
      0,
    );

    expect(applied).toEqual([1, 2]);
    expect(execAsync).toHaveBeenCalledWith(FOUNDATION_MIGRATIONS[0].sql);
    expect(execAsync).toHaveBeenCalledWith(FOUNDATION_MIGRATIONS[1].sql);
    expect(execAsync).toHaveBeenCalledWith(
      "INSERT OR REPLACE INTO schema_migrations (version, name) VALUES (1, '0001_initial_foundation');",
    );
    expect(execAsync).toHaveBeenCalledWith('PRAGMA user_version = 1;');
    expect(execAsync).toHaveBeenCalledWith('PRAGMA user_version = 2;');
    expect(withTransaction).toHaveBeenCalledTimes(2);
  });

  it('define migración v2 con rebuild e índices', () => {
    const sql = FOUNDATION_MIGRATIONS[1].sql;

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS accounts');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS categories');
    expect(sql).toContain('CREATE TABLE operational_movements_v2');
    expect(sql).toContain('INSERT INTO operational_movements_v2');
    expect(sql).toContain('ALTER TABLE operational_movements_v2 RENAME TO operational_movements');
  });
});
