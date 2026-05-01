import type {
  Account,
  AccountBalance,
  Category,
  CreateAccountInput,
  CreateCategoryInput,
  FinanceRepository,
  FinancialPlanRecord,
  OperationalSnapshot,
  OperationalMovementDraft,
  OperationalMovementRecord,
  Quincena,
  QuincenaId,
} from '@/domain/finance';
import {
  buildQuincenaId,
  isDateWithinQuincena,
  normalizeToLocalDate,
  resolveQuincenaRange,
} from '@/domain/finance/rules/pay-cycle';
import { DEFAULT_CURRENCY } from '@/shared/constants/app';

import type { DatabaseClient } from '@/infrastructure/db/types';

interface FinancialPlanRow {
  id: string;
  quincena_id: string;
  category_id: string;
  planned_amount: number;
  currency: string | null;
}

interface QuincenaRow {
  id: string;
  starts_at: string;
  ends_at: string;
  label: string;
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

  async getQuincenaById(id: QuincenaId): Promise<Quincena | null> {
    const row = await this.db.getFirstAsync<QuincenaRow>(
      `SELECT id, starts_at, ends_at, label FROM quincenas WHERE id = ? LIMIT 1;`,
      [id],
    );
    if (!row || !row.starts_at || !row.ends_at) return null;
    return this.mapQuincena(row);
  }

  async listQuincenasByMonth(month: `${number}-${number}`): Promise<Quincena[]> {
    const monthStart = `${month}-01`;
    const [year, monthRaw] = month.split('-').map(Number);
    const monthEndDate = new Date(year, monthRaw, 0);
    const monthEnd = `${month}-${String(monthEndDate.getDate()).padStart(2, '0')}`;

    const rows = await this.db.getAllAsync<QuincenaRow>(
      `SELECT id, starts_at, ends_at, label
       FROM quincenas
       WHERE starts_at <= ? AND ends_at >= ?
       ORDER BY starts_at ASC;`,
      [monthEnd, monthStart],
    );

    return rows.map((row) => this.mapQuincena(row));
  }

  async ensureQuincenaForDate(date: string | Date): Promise<Quincena> {
    const range = resolveQuincenaRange(date);
    const id = buildQuincenaId(range);
    const existing = await this.getQuincenaById(id);
    if (existing) return existing;

    return this.db.withTransaction(async () => {
      const inTxExisting = await this.db.getFirstAsync<QuincenaRow>(
        `SELECT id, starts_at, ends_at, label FROM quincenas WHERE id = ? LIMIT 1;`,
        [id],
      );
      if (inTxExisting) return this.mapQuincena(inTxExisting);

      const overlap = await this.db.getFirstAsync<{ id: string }>(
        `SELECT id
         FROM quincenas
         WHERE starts_at <= ?
           AND ends_at >= ?
         LIMIT 1;`,
        [range.endsAt, range.startsAt],
      );
      if (overlap) {
        throw new Error('Quincena inválida: rango solapado con periodo existente.');
      }

      const label = `${range.startsAt} al ${range.endsAt}`;
      await this.db.execAsync(
        `INSERT INTO quincenas (id, starts_at, ends_at, label) VALUES ('${id}', '${range.startsAt}', '${range.endsAt}', '${label}');`,
      );

      return { id, startsAt: range.startsAt, endsAt: range.endsAt, label };
    });
  }

  async getOperationalSnapshotByQuincena(id: QuincenaId): Promise<OperationalSnapshot> {
    const quincena = await this.getQuincenaById(id);
    if (!quincena) throw new Error('Quincena no encontrada para snapshot operativo.');

    const movements = await this.listMovementsByQuincena(id);
    return { quincena, movements };
  }

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
      const quincena = await this.getQuincenaById(input.quincenaId as QuincenaId);
      if (!quincena) throw new Error('Movimiento inválido: quincena no existe.');
      if (!isDateWithinQuincena(input.occurredAt, quincena)) {
        throw new Error('Movimiento inválido: occurredAt fuera del rango de la quincena.');
      }

      const occurredOn = normalizeToLocalDate(input.occurredAt);
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
          '${occurredOn}',
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
        occurredAt: occurredOn,
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

  private mapQuincena(row: QuincenaRow): Quincena {
    return {
      id: row.id as QuincenaId,
      startsAt: row.starts_at as Quincena['startsAt'],
      endsAt: row.ends_at as Quincena['endsAt'],
      label: row.label,
    };
  }
}
