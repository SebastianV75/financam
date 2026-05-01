import { bootstrapDatabase } from './bootstrap';

describe('bootstrapDatabase', () => {
  it('activa WAL, foreign_keys y ejecuta migraciones desde la versión actual', async () => {
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const getFirstAsync = jest.fn().mockResolvedValue({ user_version: 0 });
    const getAllAsync = jest.fn().mockResolvedValue([]);

    const db = {
      execAsync,
      getFirstAsync,
      getAllAsync,
    };

    await bootstrapDatabase(db as never);

    expect(execAsync).toHaveBeenCalledWith("PRAGMA journal_mode = 'wal';");
    expect(execAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON;');
    expect(getFirstAsync).toHaveBeenCalledWith('PRAGMA user_version;');
    expect(execAsync).toHaveBeenCalledWith('PRAGMA user_version = 2;');
  });
});
