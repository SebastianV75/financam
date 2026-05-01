import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_NAME } from '@/shared/config/database';

import type { DatabaseClient } from './types';

export async function openFinanceDatabase() {
  const db = await openDatabaseAsync(DATABASE_NAME);
  return db;
}

export function toDatabaseClient(db: SQLiteDatabase): DatabaseClient {
  const bindParams = (params?: unknown[]) => (params && params.length > 0 ? (params as []) : []);

  return {
    execAsync: (sql) => db.execAsync(sql),
    getAllAsync: (sql, params) => db.getAllAsync(sql, ...bindParams(params)),
    getFirstAsync: (sql, params) => db.getFirstAsync(sql, ...bindParams(params)),
    withTransaction: async (operation) => {
      await db.execAsync('BEGIN TRANSACTION;');
      try {
        const result = await operation();
        await db.execAsync('COMMIT;');
        return result;
      } catch (error) {
        await db.execAsync('ROLLBACK;');
        throw error;
      }
    },
  };
}
