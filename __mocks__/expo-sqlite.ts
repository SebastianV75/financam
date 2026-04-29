// Mock de expo-sqlite para tests
export interface SQLiteDatabase {
  execAsync: (sql: string) => Promise<void>;
  getFirstAsync: <T>(sql: string) => Promise<T | null>;
  getAllAsync: <T>(sql: string, ...params: unknown[]) => Promise<T[]>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function openDatabaseAsync(name: string): Promise<SQLiteDatabase> {
  return {
    execAsync: jest.fn().mockResolvedValue(undefined),
    getFirstAsync: jest.fn().mockResolvedValue({ user_version: 0 }),
    getAllAsync: jest.fn().mockResolvedValue([]),
  } as unknown as SQLiteDatabase;
}
