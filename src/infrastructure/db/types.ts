export interface DatabaseClient {
  execAsync(sql: string): Promise<void>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
}
