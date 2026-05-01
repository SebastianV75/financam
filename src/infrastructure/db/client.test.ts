import { toDatabaseClient } from './client';

describe('toDatabaseClient.withTransaction', () => {
  it('hace rollback cuando la operación falla', async () => {
    const db = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      getAllAsync: jest.fn(),
      getFirstAsync: jest.fn(),
    };

    const client = toDatabaseClient(db as never);

    await expect(
      client.withTransaction(async () => {
        throw new Error('fallo intermedio');
      }),
    ).rejects.toThrow('fallo intermedio');

    expect(db.execAsync).toHaveBeenNthCalledWith(1, 'BEGIN TRANSACTION;');
    expect(db.execAsync).toHaveBeenLastCalledWith('ROLLBACK;');
  });
});
