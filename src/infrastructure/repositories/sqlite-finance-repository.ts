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
  PayrollDistribution,
  PayrollDistributionApplication,
  PayrollDistributionEntry,
  Quincena,
  QuincenaId,
  SavePayrollDistributionDraftInput,
  ApplyPayrollDistributionInput,
  ApplyPayrollDistributionResult,
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

interface PayrollDistributionRow {
  id: string;
  quincena_id: string;
  total_amount: number;
  currency: string | null;
  status: 'draft' | 'applied';
  income_movement_id: string | null;
  applied_at: string | null;
}

interface PayrollDistributionEntryRow {
  id: string;
  distribution_id: string;
  target_type: 'account' | 'category';
  target_id: string;
  allocated_amount: number;
  currency: string | null;
  sort_order: number;
}

interface PayrollDistributionApplicationRow {
  id: string;
  distribution_id: string;
  income_movement_id: string | null;
  applied_at: string;
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

  async savePayrollDistributionDraft(input: SavePayrollDistributionDraftInput): Promise<PayrollDistribution> {
    return this.db.withTransaction(async () => {
      const existing = await this.db.getFirstAsync<PayrollDistributionRow>(
        `SELECT id, quincena_id, total_amount, currency, status, income_movement_id, applied_at
         FROM payroll_distributions
         WHERE quincena_id = ?
         LIMIT 1;`,
        [input.quincenaId],
      );

      if (existing && existing.status === 'applied') {
        throw new Error('No se puede editar una distribución ya aplicada.');
      }

      const distributionId = existing?.id ?? input.id;
      const escapedDistributionId = distributionId.replace(/'/g, "''");

      await this.db.execAsync(`
        INSERT INTO payroll_distributions (id, quincena_id, total_amount, currency, status, income_movement_id, applied_at, updated_at)
        VALUES ('${escapedDistributionId}', '${input.quincenaId}', ${input.total.amount}, '${input.total.currency}', 'draft', NULL, NULL, CURRENT_TIMESTAMP)
        ON CONFLICT(quincena_id) DO UPDATE SET
          total_amount = excluded.total_amount,
          currency = excluded.currency,
          updated_at = CURRENT_TIMESTAMP;
      `);

      await this.db.execAsync(`DELETE FROM payroll_distribution_entries WHERE distribution_id = '${escapedDistributionId}';`);

      for (const entry of input.entries) {
        await this.db.execAsync(`
          INSERT INTO payroll_distribution_entries (id, distribution_id, target_type, target_id, allocated_amount, currency, sort_order)
          VALUES (
            '${entry.id.replace(/'/g, "''")}',
            '${escapedDistributionId}',
            '${entry.targetType}',
            '${entry.targetId.replace(/'/g, "''")}',
            ${entry.allocated.amount},
            '${entry.allocated.currency}',
            ${entry.sortOrder}
          );
        `);
      }

      const sumRow = await this.db.getFirstAsync<{ allocated_total: number | null }>(
        `SELECT COALESCE(SUM(allocated_amount), 0) AS allocated_total
         FROM payroll_distribution_entries
         WHERE distribution_id = ?;`,
        [distributionId],
      );

      const allocatedTotal = sumRow?.allocated_total ?? 0;
      if (allocatedTotal > input.total.amount) {
        throw new Error('La suma de distribución excede el total de nómina.');
      }

      const saved = await this.getPayrollDistributionById(distributionId);
      if (!saved) throw new Error('No se pudo guardar la distribución de nómina.');
      return saved;
    });
  }

  async getPayrollDistributionByQuincena(quincenaId: QuincenaId): Promise<PayrollDistribution | null> {
    const row = await this.db.getFirstAsync<PayrollDistributionRow>(
      `SELECT id, quincena_id, total_amount, currency, status, income_movement_id, applied_at
       FROM payroll_distributions
       WHERE quincena_id = ?
       LIMIT 1;`,
      [quincenaId],
    );
    if (!row) return null;
    return this.mapPayrollDistribution(row);
  }

  async getPayrollDistributionById(distributionId: string): Promise<PayrollDistribution | null> {
    const row = await this.db.getFirstAsync<PayrollDistributionRow>(
      `SELECT id, quincena_id, total_amount, currency, status, income_movement_id, applied_at
       FROM payroll_distributions
       WHERE id = ?
       LIMIT 1;`,
      [distributionId],
    );
    if (!row) return null;
    return this.mapPayrollDistribution(row);
  }

  async listAppliedMovementsByDistribution(distributionId: string): Promise<OperationalMovementRecord[]> {
    const distribution = await this.getPayrollDistributionById(distributionId);
    if (!distribution) return [];

    const appliedMovementIds = new Set(distribution.entries.map((entry) => `${distribution.id}-${entry.id}`));
    if (appliedMovementIds.size === 0) return [];

    const movements = await this.listMovementsByQuincena(distribution.quincenaId);
    return movements.filter((movement) => appliedMovementIds.has(movement.id));
  }

  async applyPayrollDistribution(input: ApplyPayrollDistributionInput): Promise<ApplyPayrollDistributionResult> {
    return this.db.withTransaction(async () => {
      const distribution = await this.getPayrollDistributionById(input.distributionId);
      if (!distribution) throw new Error('Distribución de nómina no encontrada.');

      const existingApplication = await this.db.getFirstAsync<PayrollDistributionApplicationRow>(
        `SELECT id, distribution_id, income_movement_id, applied_at
         FROM payroll_distribution_applications
         WHERE distribution_id = ?
         LIMIT 1;`,
        [input.distributionId],
      );

      if (existingApplication) {
        const appliedDistribution = await this.getPayrollDistributionById(input.distributionId);
        if (!appliedDistribution) throw new Error('Distribución aplicada inconsistente.');
        return {
          distribution: appliedDistribution,
          application: this.mapPayrollDistributionApplication(existingApplication),
          createdMovementIds: [],
          alreadyApplied: true,
        };
      }

      if (distribution.status === 'applied') {
        throw new Error('La distribución ya está aplicada sin registro de aplicación.');
      }

      const incomeMovement = await this.db.getFirstAsync<OperationalMovementRow>(
        `SELECT id, quincena_id, occurred_at, kind, amount, currency, from_account_id, to_account_id, category_id, note
         FROM operational_movements
         WHERE id = ?
         LIMIT 1;`,
        [input.incomeMovementId],
      );
      if (!incomeMovement || incomeMovement.kind !== 'income' || !incomeMovement.to_account_id) {
        throw new Error('Ingreso real inválido para aplicar distribución.');
      }

      if (incomeMovement.quincena_id !== distribution.quincenaId) {
        throw new Error('Ingreso real inválido: quincena distinta a la distribución.');
      }

      const normalizedAppliedAt = normalizeToLocalDate(input.appliedAt);
      const distributionQuincena = await this.getQuincenaById(distribution.quincenaId);
      if (!distributionQuincena) {
        throw new Error('Quincena de distribución no encontrada para aplicar.');
      }

      if (!isDateWithinQuincena(normalizedAppliedAt, distributionQuincena)) {
        throw new Error('Fecha de aplicación fuera del rango de la quincena de la distribución.');
      }

      if (!isDateWithinQuincena(incomeMovement.occurred_at, distributionQuincena)) {
        throw new Error('Ingreso real inválido: occurredAt fuera de la quincena de la distribución.');
      }

      const entries = distribution.entries;
      const createdMovementIds: string[] = [];
      for (const entry of entries) {
        const movementId = `${input.distributionId}-${entry.id}`;
        const escapedMovementId = movementId.replace(/'/g, "''");
        if (entry.targetType === 'account') {
          await this.db.execAsync(`
            INSERT INTO operational_movements (
              id, quincena_id, occurred_at, kind, amount, currency, from_account_id, to_account_id, category_id, note
            ) VALUES (
              '${escapedMovementId}',
              '${distribution.quincenaId}',
              '${normalizedAppliedAt}',
              'transfer',
              ${entry.allocated.amount},
              '${entry.allocated.currency}',
              '${incomeMovement.to_account_id}',
              '${entry.targetId.replace(/'/g, "''")}',
              NULL,
              'payroll distribution apply'
            );
          `);
        } else {
          await this.db.execAsync(`
            INSERT INTO operational_movements (
              id, quincena_id, occurred_at, kind, amount, currency, from_account_id, to_account_id, category_id, note
            ) VALUES (
              '${escapedMovementId}',
              '${distribution.quincenaId}',
              '${normalizedAppliedAt}',
              'expense',
              ${entry.allocated.amount},
              '${entry.allocated.currency}',
              '${incomeMovement.to_account_id}',
              NULL,
              '${entry.targetId.replace(/'/g, "''")}',
              'payroll distribution apply'
            );
          `);
        }

        createdMovementIds.push(movementId);
      }

      await this.db.execAsync(`
        INSERT INTO payroll_distribution_applications (id, distribution_id, income_movement_id, applied_at)
        VALUES ('${input.applicationId.replace(/'/g, "''")}', '${input.distributionId.replace(/'/g, "''")}', '${input.incomeMovementId.replace(/'/g, "''")}', '${normalizedAppliedAt}');
      `);

      await this.db.execAsync(`
        UPDATE payroll_distributions
        SET status = 'applied', income_movement_id = '${input.incomeMovementId.replace(/'/g, "''")}', applied_at = '${normalizedAppliedAt}', updated_at = CURRENT_TIMESTAMP
        WHERE id = '${input.distributionId.replace(/'/g, "''")}';
      `);

      const appliedDistribution = await this.getPayrollDistributionById(input.distributionId);
      if (!appliedDistribution) throw new Error('No se pudo confirmar distribución aplicada.');

      return {
        distribution: appliedDistribution,
        application: {
          id: input.applicationId,
          distributionId: input.distributionId,
          incomeMovementId: input.incomeMovementId,
          appliedAt: normalizedAppliedAt,
        },
        createdMovementIds,
        alreadyApplied: false,
      };
    });
  }

  private mapQuincena(row: QuincenaRow): Quincena {
    return {
      id: row.id as QuincenaId,
      startsAt: row.starts_at as Quincena['startsAt'],
      endsAt: row.ends_at as Quincena['endsAt'],
      label: row.label,
    };
  }

  private async mapPayrollDistribution(row: PayrollDistributionRow): Promise<PayrollDistribution> {
    const entryRows = await this.db.getAllAsync<PayrollDistributionEntryRow>(
      `SELECT id, distribution_id, target_type, target_id, allocated_amount, currency, sort_order
       FROM payroll_distribution_entries
       WHERE distribution_id = ?
       ORDER BY sort_order ASC;`,
      [row.id],
    );

    return {
      id: row.id,
      quincenaId: row.quincena_id,
      total: {
        amount: row.total_amount,
        currency: row.currency === DEFAULT_CURRENCY ? DEFAULT_CURRENCY : DEFAULT_CURRENCY,
      },
      status: row.status,
      incomeMovementId: row.income_movement_id,
      appliedAt: row.applied_at,
      entries: entryRows.map((entry) => this.mapPayrollDistributionEntry(entry)),
    };
  }

  private mapPayrollDistributionEntry(row: PayrollDistributionEntryRow): PayrollDistributionEntry {
    return {
      id: row.id,
      distributionId: row.distribution_id,
      targetType: row.target_type,
      targetId: row.target_id,
      allocated: {
        amount: row.allocated_amount,
        currency: row.currency === DEFAULT_CURRENCY ? DEFAULT_CURRENCY : DEFAULT_CURRENCY,
      },
      sortOrder: row.sort_order,
    };
  }

  private mapPayrollDistributionApplication(row: PayrollDistributionApplicationRow): PayrollDistributionApplication {
    return {
      id: row.id,
      distributionId: row.distribution_id,
      incomeMovementId: row.income_movement_id,
      appliedAt: row.applied_at,
    };
  }
}
