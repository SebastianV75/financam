export interface DatabaseClient {
  execAsync(sql: string): Promise<void>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  withTransaction<T>(operation: () => Promise<T>): Promise<T>;
}
