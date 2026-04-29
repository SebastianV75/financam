import { DATABASE_VERSION } from '@/shared/config/database';

import type { DatabaseClient } from './types';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const FOUNDATION_MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '0001_initial_foundation',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS quincenas (
        id TEXT PRIMARY KEY NOT NULL,
        starts_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        label TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS financial_plans (
        id TEXT PRIMARY KEY NOT NULL,
        quincena_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        planned_amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'MXN',
        FOREIGN KEY (quincena_id) REFERENCES quincenas (id)
      );

      CREATE TABLE IF NOT EXISTS operational_movements (
        id TEXT PRIMARY KEY NOT NULL,
        quincena_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('expense', 'income', 'transfer')),
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'MXN',
        FOREIGN KEY (quincena_id) REFERENCES quincenas (id)
      );
    `,
  },
];

export async function migrateDatabase(
  db: DatabaseClient,
  currentVersion: number,
  targetVersion = DATABASE_VERSION,
) {
  const pendingMigrations = FOUNDATION_MIGRATIONS.filter(
    (migration) => migration.version > currentVersion && migration.version <= targetVersion,
  );

  for (const migration of pendingMigrations) {
    await db.execAsync(migration.sql);
    await db.execAsync(
      `INSERT OR REPLACE INTO schema_migrations (version, name) VALUES (${migration.version}, '${migration.name}');`,
    );
    await db.execAsync(`PRAGMA user_version = ${migration.version};`);
  }

  return pendingMigrations.map((migration) => migration.version);
}
