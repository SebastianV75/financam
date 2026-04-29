import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_NAME } from '@/shared/config/database';

import type { DatabaseClient } from './types';

export async function openFinanceDatabase() {
  const db = await openDatabaseAsync(DATABASE_NAME);
  return db;
}

export function toDatabaseClient(db: SQLiteDatabase): DatabaseClient {
  return {
    execAsync: (sql) => db.execAsync(sql),
    getAllAsync: (sql, params) => {
      if (!params || params.length === 0) {
        return db.getAllAsync(sql);
      }

      return db.getAllAsync(sql, ...(params as []));
    },
  };
}
