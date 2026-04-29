import type {
  FinanceRepository,
  FinancialPlanRecord,
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
}

export class SQLiteFinanceRepository implements FinanceRepository {
  constructor(private readonly db: DatabaseClient) {}

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
      `SELECT id, quincena_id, occurred_at, kind, amount, currency
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
    }));
  }
}
