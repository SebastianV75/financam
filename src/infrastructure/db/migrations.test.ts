import { FOUNDATION_MIGRATIONS, migrateDatabase } from './migrations';

describe('migrateDatabase', () => {
  it('aplica las migraciones pendientes y actualiza user_version', async () => {
    const execAsync = jest.fn().mockResolvedValue(undefined);

    const applied = await migrateDatabase({ execAsync, getAllAsync: jest.fn() }, 0);

    expect(applied).toEqual([1]);
    expect(execAsync).toHaveBeenCalledWith(FOUNDATION_MIGRATIONS[0].sql);
    expect(execAsync).toHaveBeenCalledWith(
      "INSERT OR REPLACE INTO schema_migrations (version, name) VALUES (1, '0001_initial_foundation');",
    );
    expect(execAsync).toHaveBeenCalledWith('PRAGMA user_version = 1;');
  });
});
