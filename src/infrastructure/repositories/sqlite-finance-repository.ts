import type {
  Account,
  AccountBalance,
  Category,
  CreateAccountInput,
  CreateCategoryInput,
  FinanceRepository,
  FinancialPlanRecord,
  OperationalMovementDraft,
  OperationalMovementRecord,
  QuincenaId,
} from '@/domain/finance';
import { DEFAULT_CURRENCY } from '@/shared/constants/app';

import type { DatabaseClient } from '@/infrastructure/db/types';

interface FinancialPlanRow {
  id: string;
  quincena_id: string;
  category_id: string;
  planned_amount: number;
  currency: string | null;
}

interface OperationalMovementRow {
  id: string;
  quincena_id: string;
  occurred_at: string;
  kind: 'expense' | 'income' | 'transfer';
  amount: number;
  currency: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
  category_id: string | null;
  note: string | null;
}

interface AccountRow {
  id: string;
  name: string;
  type: 'cash' | 'debit' | 'savings' | 'credit_card';
  is_active: number;
}

interface CategoryRow {
  id: string;
  name: string;
  icon: string | null;
  is_active: number;
}

interface AccountBalanceRow {
  account_id: string;
  balance: number;
}

export class SQLiteFinanceRepository implements FinanceRepository {
  constructor(private readonly db: DatabaseClient) {}

  async listAccounts(): Promise<Account[]> {
    const rows = await this.db.getAllAsync<AccountRow>(
      `SELECT id, name, type, is_active FROM accounts ORDER BY created_at DESC;`,
    );

    return rows.map((row) => ({ id: row.id, name: row.name, type: row.type, isActive: row.is_active === 1 }));
  }

  async createAccount(input: CreateAccountInput): Promise<Account> {
    await this.db.execAsync(
      `INSERT INTO accounts (id, name, type, is_active) VALUES ('${input.id}', '${input.name.replace(/'/g, "''")}', '${input.type}', 1);`,
    );
    return { id: input.id, name: input.name, type: input.type, isActive: true };
  }

  async listCategories(): Promise<Category[]> {
    const rows = await this.db.getAllAsync<CategoryRow>(
      `SELECT id, name, icon, is_active FROM categories ORDER BY created_at DESC;`,
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      icon: row.icon,
      isActive: row.is_active === 1,
    }));
  }

  async createCategory(input: CreateCategoryInput): Promise<Category> {
    const iconValue = input.icon ? `'${input.icon.replace(/'/g, "''")}'` : 'NULL';
    await this.db.execAsync(
      `INSERT INTO categories (id, name, icon, is_active) VALUES ('${input.id}', '${input.name.replace(/'/g, "''")}', ${iconValue}, 1);`,
    );

    return { id: input.id, name: input.name, icon: input.icon ?? null, isActive: true };
  }

  async createOperationalMovement(input: OperationalMovementDraft): Promise<OperationalMovementRecord> {
    return this.db.withTransaction(async () => {
      const fromValue = input.fromAccountId ? `'${input.fromAccountId}'` : 'NULL';
      const toValue = input.toAccountId ? `'${input.toAccountId}'` : 'NULL';
      const categoryValue = input.categoryId ? `'${input.categoryId}'` : 'NULL';
      const noteValue = input.note ? `'${input.note.replace(/'/g, "''")}'` : 'NULL';
      await this.db.execAsync(`
        INSERT INTO operational_movements (
          id, quincena_id, occurred_at, kind, amount, currency, from_account_id, to_account_id, category_id, note
        ) VALUES (
          '${input.id}',
          '${input.quincenaId}',
          '${input.occurredAt}',
          '${input.kind}',
          ${input.amount.amount},
          '${input.amount.currency}',
          ${fromValue},
          ${toValue},
          ${categoryValue},
          ${noteValue}
        );
      `);

      return {
        id: input.id,
        quincenaId: input.quincenaId,
        occurredAt: input.occurredAt,
        kind: input.kind,
        amount: input.amount,
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        categoryId: input.categoryId,
        note: input.note ?? null,
      };
    });
  }

  async listPlanByQuincena(quincenaId: QuincenaId): Promise<FinancialPlanRecord[]> {
    const rows = await this.db.getAllAsync<FinancialPlanRow>(
      `SELECT id, quincena_id, category_id, planned_amount, currency
       FROM financial_plans
       WHERE quincena_id = ?
       ORDER BY id ASC;`,
      [quincenaId],
    );

    return rows.map((row) => ({
      id: row.id,
      quincenaId: row.quincena_id,
      categoryId: row.category_id,
      planned: {
        amount: row.planned_amount,
        currency: row.currency === DEFAULT_CURRENCY ? DEFAULT_CURRENCY : DEFAULT_CURRENCY,
      },
    }));
  }

  async listMovementsByQuincena(quincenaId: QuincenaId): Promise<OperationalMovementRecord[]> {
    const rows = await this.db.getAllAsync<OperationalMovementRow>(
      `SELECT id, quincena_id, occurred_at, kind, amount, currency, from_account_id, to_account_id, category_id, note
       FROM operational_movements
       WHERE quincena_id = ?
       ORDER BY occurred_at DESC;`,
      [quincenaId],
    );

    return rows.map((row) => ({
      id: row.id,
      quincenaId: row.quincena_id,
      occurredAt: row.occurred_at,
        kind: row.kind,
        amount: {
          amount: row.amount,
          currency: row.currency === DEFAULT_CURRENCY ? DEFAULT_CURRENCY : DEFAULT_CURRENCY,
        },
        fromAccountId: row.from_account_id,
        toAccountId: row.to_account_id,
        categoryId: row.category_id,
        note: row.note,
      }));
  }

  async getAccountBalances(): Promise<AccountBalance[]> {
    const rows = await this.db.getAllAsync<AccountBalanceRow>(`
      SELECT
        a.id as account_id,
        COALESCE(SUM(
          CASE
            WHEN m.kind = 'income' AND m.to_account_id = a.id THEN m.amount
            WHEN m.kind = 'expense' AND m.from_account_id = a.id THEN -m.amount
            WHEN m.kind = 'transfer' AND m.to_account_id = a.id THEN m.amount
            WHEN m.kind = 'transfer' AND m.from_account_id = a.id THEN -m.amount
            ELSE 0
          END
        ), 0) as balance
      FROM accounts a
      LEFT JOIN operational_movements m
        ON (m.to_account_id = a.id OR m.from_account_id = a.id)
      GROUP BY a.id
      ORDER BY a.name ASC;
    `);

    return rows.map((row) => ({
      accountId: row.account_id,
      balance: { amount: row.balance, currency: DEFAULT_CURRENCY },
    }));
  }
}
