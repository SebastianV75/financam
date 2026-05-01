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
  {
    version: 2,
    name: '0002_accounts_transactions_core',
    sql: `
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('cash', 'debit', 'savings', 'credit_card')),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        icon TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE operational_movements_v2 (
        id TEXT PRIMARY KEY NOT NULL,
        quincena_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('expense', 'income', 'transfer')),
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'MXN',
        from_account_id TEXT,
        to_account_id TEXT,
        category_id TEXT,
        note TEXT,
        FOREIGN KEY (quincena_id) REFERENCES quincenas (id),
        FOREIGN KEY (from_account_id) REFERENCES accounts (id),
        FOREIGN KEY (to_account_id) REFERENCES accounts (id),
        FOREIGN KEY (category_id) REFERENCES categories (id)
      );

      INSERT INTO operational_movements_v2 (id, quincena_id, occurred_at, kind, amount, currency)
      SELECT id, quincena_id, occurred_at, kind, amount, currency
      FROM operational_movements;

      DROP TABLE operational_movements;
      ALTER TABLE operational_movements_v2 RENAME TO operational_movements;

      CREATE INDEX IF NOT EXISTS idx_operational_movements_quincena ON operational_movements(quincena_id);
      CREATE INDEX IF NOT EXISTS idx_operational_movements_occurred_at ON operational_movements(occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_operational_movements_from_account ON operational_movements(from_account_id);
      CREATE INDEX IF NOT EXISTS idx_operational_movements_to_account ON operational_movements(to_account_id);
      CREATE INDEX IF NOT EXISTS idx_operational_movements_category ON operational_movements(category_id);
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
    await db.withTransaction(async () => {
      await db.execAsync(migration.sql);
      await db.execAsync(
        `INSERT OR REPLACE INTO schema_migrations (version, name) VALUES (${migration.version}, '${migration.name}');`,
      );
      await db.execAsync(`PRAGMA user_version = ${migration.version};`);
    });
  }

  return pendingMigrations.map((migration) => migration.version);
}
