import type { SQLiteDatabase } from 'expo-sqlite';

import { migrateDatabase } from './migrations';
import { toDatabaseClient } from './client';

interface UserVersionRow {
  user_version: number;
}

export async function bootstrapDatabase(db: SQLiteDatabase) {
  await db.execAsync("PRAGMA journal_mode = 'wal';");
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const current = await db.getFirstAsync<UserVersionRow>('PRAGMA user_version;');
  const currentVersion = current?.user_version ?? 0;

  await migrateDatabase(toDatabaseClient(db), currentVersion);

  return db;
}
