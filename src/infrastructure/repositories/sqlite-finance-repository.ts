import type {
  Account,
  AccountBalance,
  Category,
  Debt,
  DebtDraft,
  DebtSummary,
  CreateAccountInput,
  CreateCategoryInput,
  SavingsGoal,
  SavingsGoalDraft,
  SavingsGoalSummary,
  FinanceRepository,
  FinancialPlanRecord,
  SaveFinancialPlanInput,
  CreateFixedExpenseInput,
  UpdateFixedExpenseInput,
  FixedExpense,
  FixedExpenseProjection,
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
import {
  calculateDebtPaidAmount,
  calculateDebtProgress,
  calculatePendingSavingsAmount,
  calculateSavingsGoalProgress,
  calculateSuggestedBiweeklyContribution,
} from '@/domain/finance/rules/goals-and-debts';
import { DEFAULT_CURRENCY } from '@/shared/constants/app';

import type { DatabaseClient } from '@/infrastructure/db/types';

interface FinancialPlanRow {
  id: string;
  quincena_id: string;
  category_id: string;
  account_id: string | null;
  is_fixed: number;
  fixed_expense_id: string | null;
  planned_amount: number;
  currency: string | null;
}

interface FixedExpenseRow {
  id: string;
  name: string;
  amount: number;
  currency: string | null;
  category_id: string;
  account_id: string | null;
  frequency: 'quincenal' | 'mensual';
  is_active: number;
}

interface FixedExpenseProjectionRow {
  id: string;
  fixed_expense_id: string;
  quincena_id: string;
  category_id: string;
  account_id: string | null;
  amount: number;
  currency: string | null;
  status: 'pending' | 'linked';
  financial_plan_id: string | null;
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
  goal_id: string | null;
  debt_id: string | null;
  note: string | null;
}

interface SavingsGoalRow {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  currency: string | null;
  target_date: string | null;
  account_id: string | null;
  category_id: string | null;
}

interface DebtRow {
  id: string;
  account_id: string;
  principal_amount: number;
  current_balance: number;
  currency: string | null;
  interest_rate: number | null;
  min_payment: number | null;
  due_day: number | null;
  status: 'active' | 'paid';
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
      const goalValue = input.goalId ? `'${input.goalId}'` : 'NULL';
      const debtValue = input.debtId ? `'${input.debtId}'` : 'NULL';
      const noteValue = input.note ? `'${input.note.replace(/'/g, "''")}'` : 'NULL';
      await this.db.execAsync(`
        INSERT INTO operational_movements (
          id, quincena_id, occurred_at, kind, amount, currency, from_account_id, to_account_id, category_id, goal_id, debt_id, note
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
          ${goalValue},
          ${debtValue},
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
        goalId: input.goalId ?? null,
        debtId: input.debtId ?? null,
        note: input.note ?? null,
      };
    });
  }

  async listPlanByQuincena(quincenaId: QuincenaId): Promise<FinancialPlanRecord[]> {
    return this.listFinancialPlansByQuincena(quincenaId);
  }

  async saveFinancialPlan(input: SaveFinancialPlanInput): Promise<FinancialPlanRecord> {
    if (input.isFixed && !input.fixedExpenseId) {
      throw new Error('Plan inválido: is_fixed requiere fixed_expense_id.');
    }

    await this.db.execAsync(`
      INSERT INTO financial_plans (id, quincena_id, category_id, account_id, is_fixed, fixed_expense_id, planned_amount, currency)
      VALUES (
        '${input.id.replace(/'/g, "''")}',
        '${input.quincenaId.replace(/'/g, "''")}',
        '${input.categoryId.replace(/'/g, "''")}',
        ${input.accountId ? `'${input.accountId.replace(/'/g, "''")}'` : 'NULL'},
        ${input.isFixed ? 1 : 0},
        ${input.fixedExpenseId ? `'${input.fixedExpenseId.replace(/'/g, "''")}'` : 'NULL'},
        ${input.planned.amount},
        '${input.planned.currency}'
      )
      ON CONFLICT(quincena_id, category_id) DO UPDATE SET
        id = excluded.id,
        account_id = excluded.account_id,
        is_fixed = excluded.is_fixed,
        fixed_expense_id = excluded.fixed_expense_id,
        planned_amount = excluded.planned_amount,
        currency = excluded.currency;
    `);

    const saved = await this.db.getFirstAsync<FinancialPlanRow>(
      `SELECT id, quincena_id, category_id, account_id, is_fixed, fixed_expense_id, planned_amount, currency
       FROM financial_plans
       WHERE quincena_id = ? AND category_id = ?
       LIMIT 1;`,
      [input.quincenaId, input.categoryId],
    );

    if (!saved) throw new Error('No se pudo guardar el plan financiero.');
    return this.mapFinancialPlan(saved);
  }

  async listFinancialPlansByQuincena(quincenaId: QuincenaId): Promise<FinancialPlanRecord[]> {
    const rows = await this.db.getAllAsync<FinancialPlanRow>(
      `SELECT id, quincena_id, category_id, account_id, is_fixed, fixed_expense_id, planned_amount, currency
       FROM financial_plans
       WHERE quincena_id = ?
       ORDER BY id ASC;`,
      [quincenaId],
    );

    return rows.map((row) => this.mapFinancialPlan(row));
  }

  async createFixedExpense(input: CreateFixedExpenseInput): Promise<FixedExpense> {
    await this.db.execAsync(`
      INSERT INTO fixed_expenses (id, name, amount, currency, category_id, account_id, frequency, is_active, updated_at)
      VALUES (
        '${input.id.replace(/'/g, "''")}',
        '${input.name.replace(/'/g, "''")}',
        ${input.amount.amount},
        '${input.amount.currency}',
        '${input.categoryId.replace(/'/g, "''")}',
        ${input.accountId ? `'${input.accountId.replace(/'/g, "''")}'` : 'NULL'},
        '${input.frequency}',
        1,
        CURRENT_TIMESTAMP
      );
    `);
    const row = await this.db.getFirstAsync<FixedExpenseRow>(
      `SELECT id, name, amount, currency, category_id, account_id, frequency, is_active FROM fixed_expenses WHERE id = ? LIMIT 1;`,
      [input.id],
    );
    if (!row) throw new Error('No se pudo crear el gasto fijo.');
    return this.mapFixedExpense(row);
  }

  async updateFixedExpense(input: UpdateFixedExpenseInput): Promise<FixedExpense> {
    await this.db.execAsync(`
      UPDATE fixed_expenses
      SET name = '${input.name.replace(/'/g, "''")}',
          amount = ${input.amount.amount},
          currency = '${input.amount.currency}',
          category_id = '${input.categoryId.replace(/'/g, "''")}',
          account_id = ${input.accountId ? `'${input.accountId.replace(/'/g, "''")}'` : 'NULL'},
          frequency = '${input.frequency}',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = '${input.id.replace(/'/g, "''")}';
    `);
    const row = await this.db.getFirstAsync<FixedExpenseRow>(
      `SELECT id, name, amount, currency, category_id, account_id, frequency, is_active FROM fixed_expenses WHERE id = ? LIMIT 1;`,
      [input.id],
    );
    if (!row) throw new Error('Gasto fijo no encontrado para actualizar.');
    return this.mapFixedExpense(row);
  }

  async deactivateFixedExpense(id: string): Promise<void> {
    await this.db.execAsync(
      `UPDATE fixed_expenses SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = '${id.replace(/'/g, "''")}';`,
    );
  }

  async listFixedExpenses(): Promise<FixedExpense[]> {
    const rows = await this.db.getAllAsync<FixedExpenseRow>(
      `SELECT id, name, amount, currency, category_id, account_id, frequency, is_active
       FROM fixed_expenses
       ORDER BY created_at DESC;`,
    );
    return rows.map((row) => this.mapFixedExpense(row));
  }

  async refreshFixedExpenseProjections(quincenaId: QuincenaId): Promise<void> {
    const quincena = await this.getQuincenaById(quincenaId);
    if (!quincena) throw new Error('Quincena no encontrada para proyección de gastos fijos.');

    await this.db.withTransaction(async () => {
      await this.db.execAsync(`DELETE FROM fixed_expense_projections WHERE quincena_id = '${quincenaId}' AND status = 'pending';`);

      const expenses = await this.db.getAllAsync<FixedExpenseRow>(
        `SELECT id, name, amount, currency, category_id, account_id, frequency, is_active
         FROM fixed_expenses
         WHERE is_active = 1
         ORDER BY created_at ASC;`,
      );

      for (const expense of expenses) {
        if (!this.isFrequencyApplicable(expense.frequency, quincena.startsAt)) continue;

        const linkedPlan = await this.db.getFirstAsync<{ id: string | null }>(
          `SELECT id FROM financial_plans WHERE quincena_id = ? AND fixed_expense_id = ? LIMIT 1;`,
          [quincenaId, expense.id],
        );

        await this.db.execAsync(`
          INSERT INTO fixed_expense_projections (id, fixed_expense_id, quincena_id, amount, currency, status, financial_plan_id, updated_at)
          VALUES (
            '${`fep-${quincenaId}-${expense.id}`.replace(/'/g, "''")}',
            '${expense.id.replace(/'/g, "''")}',
            '${quincenaId.replace(/'/g, "''")}',
            ${expense.amount},
            '${expense.currency ?? DEFAULT_CURRENCY}',
            ${linkedPlan?.id ? "'linked'" : "'pending'"},
            ${linkedPlan?.id ? `'${linkedPlan.id.replace(/'/g, "''")}'` : 'NULL'},
            CURRENT_TIMESTAMP
          )
          ON CONFLICT(fixed_expense_id, quincena_id) DO UPDATE SET
            amount = excluded.amount,
            currency = excluded.currency,
            status = CASE
              WHEN fixed_expense_projections.financial_plan_id IS NOT NULL THEN 'linked'
              ELSE excluded.status
            END,
            financial_plan_id = COALESCE(fixed_expense_projections.financial_plan_id, excluded.financial_plan_id),
            updated_at = CURRENT_TIMESTAMP;
        `);
      }
    });
  }

  async listFixedExpenseProjectionsByQuincena(quincenaId: QuincenaId): Promise<FixedExpenseProjection[]> {
    const rows = await this.db.getAllAsync<FixedExpenseProjectionRow>(
      `SELECT p.id, p.fixed_expense_id, p.quincena_id, f.category_id, f.account_id, p.amount, p.currency, p.status, p.financial_plan_id
       FROM fixed_expense_projections p
       INNER JOIN fixed_expenses f ON f.id = p.fixed_expense_id
       WHERE p.quincena_id = ?
       ORDER BY p.id ASC;`,
      [quincenaId],
    );
    return rows.map((row) => ({
      id: row.id,
      fixedExpenseId: row.fixed_expense_id,
      quincenaId: row.quincena_id,
      categoryId: row.category_id,
      accountId: row.account_id,
      amount: { amount: row.amount, currency: row.currency === DEFAULT_CURRENCY ? DEFAULT_CURRENCY : DEFAULT_CURRENCY },
      status: row.status,
      financialPlanId: row.financial_plan_id,
    }));
  }

  async listMovementsByQuincena(quincenaId: QuincenaId): Promise<OperationalMovementRecord[]> {
    const rows = await this.db.getAllAsync<OperationalMovementRow>(
      `SELECT id, quincena_id, occurred_at, kind, amount, currency, from_account_id, to_account_id, category_id, goal_id, debt_id, note
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
        goalId: row.goal_id,
        debtId: row.debt_id,
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
        `SELECT id, quincena_id, occurred_at, kind, amount, currency, from_account_id, to_account_id, category_id, goal_id, debt_id, note
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
              id, quincena_id, occurred_at, kind, amount, currency, from_account_id, to_account_id, category_id, goal_id, debt_id, note
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
              NULL,
              NULL,
              'payroll distribution apply'
            );
          `);
        } else {
          await this.db.execAsync(`
            INSERT INTO operational_movements (
              id, quincena_id, occurred_at, kind, amount, currency, from_account_id, to_account_id, category_id, goal_id, debt_id, note
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
              NULL,
              NULL,
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

  async createSavingsGoal(input: SavingsGoalDraft): Promise<SavingsGoal> {
    await this.db.execAsync(`
      INSERT INTO savings_goals (id, name, target_amount, current_amount, currency, target_date, account_id, category_id, updated_at)
      VALUES (
        '${input.id.replace(/'/g, "''")}',
        '${input.name.replace(/'/g, "''")}',
        ${input.targetAmount.amount},
        0,
        '${input.targetAmount.currency}',
        ${input.targetDate ? `'${input.targetDate}'` : 'NULL'},
        ${input.accountId ? `'${input.accountId.replace(/'/g, "''")}'` : 'NULL'},
        ${input.categoryId ? `'${input.categoryId.replace(/'/g, "''")}'` : 'NULL'},
        CURRENT_TIMESTAMP
      );
    `);
    const saved = await this.getSavingsGoalById(input.id);
    if (!saved) throw new Error('No se pudo crear la meta de ahorro.');
    return saved;
  }

  async updateSavingsGoal(input: SavingsGoalDraft): Promise<SavingsGoal> {
    await this.db.execAsync(`
      UPDATE savings_goals
      SET name = '${input.name.replace(/'/g, "''")}',
          target_amount = ${input.targetAmount.amount},
          target_date = ${input.targetDate ? `'${input.targetDate}'` : 'NULL'},
          account_id = ${input.accountId ? `'${input.accountId.replace(/'/g, "''")}'` : 'NULL'},
          category_id = ${input.categoryId ? `'${input.categoryId.replace(/'/g, "''")}'` : 'NULL'},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = '${input.id.replace(/'/g, "''")}';
    `);
    const saved = await this.getSavingsGoalById(input.id);
    if (!saved) throw new Error('Meta de ahorro no encontrada para actualizar.');
    return saved;
  }

  async getSavingsGoalById(goalId: string): Promise<SavingsGoal | null> {
    const row = await this.db.getFirstAsync<SavingsGoalRow>(
      `SELECT id, name, target_amount, current_amount, currency, target_date, account_id, category_id FROM savings_goals WHERE id = ? LIMIT 1;`,
      [goalId],
    );
    return row ? this.mapSavingsGoal(row) : null;
  }

  async listSavingsGoals(): Promise<SavingsGoal[]> {
    const rows = await this.db.getAllAsync<SavingsGoalRow>(
      `SELECT id, name, target_amount, current_amount, currency, target_date, account_id, category_id FROM savings_goals ORDER BY created_at DESC;`,
    );
    return rows.map((row) => this.mapSavingsGoal(row));
  }

  async createDebt(input: DebtDraft): Promise<Debt> {
    await this.assertDebtAccountEligible(input.accountId);
    await this.db.execAsync(`
      INSERT INTO debts (id, account_id, principal_amount, current_balance, currency, interest_rate, min_payment, due_day, status, updated_at)
      VALUES (
        '${input.id.replace(/'/g, "''")}',
        '${input.accountId.replace(/'/g, "''")}',
        ${input.principalAmount.amount},
        ${input.currentBalance.amount},
        '${input.principalAmount.currency}',
        ${input.interestRate ?? 'NULL'},
        ${input.minPayment?.amount ?? 'NULL'},
        ${input.dueDay ?? 'NULL'},
        CASE WHEN ${input.currentBalance.amount} <= 0 THEN 'paid' ELSE 'active' END,
        CURRENT_TIMESTAMP
      );
    `);
    const saved = await this.getDebtById(input.id);
    if (!saved) throw new Error('No se pudo crear la deuda.');
    return saved;
  }

  async updateDebt(input: DebtDraft): Promise<Debt> {
    await this.assertDebtAccountEligible(input.accountId);
    await this.db.execAsync(`
      UPDATE debts
      SET account_id = '${input.accountId.replace(/'/g, "''")}',
          principal_amount = ${input.principalAmount.amount},
          current_balance = ${input.currentBalance.amount},
          currency = '${input.principalAmount.currency}',
          interest_rate = ${input.interestRate ?? 'NULL'},
          min_payment = ${input.minPayment?.amount ?? 'NULL'},
          due_day = ${input.dueDay ?? 'NULL'},
          status = CASE WHEN ${input.currentBalance.amount} <= 0 THEN 'paid' ELSE 'active' END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = '${input.id.replace(/'/g, "''")}';
    `);
    const saved = await this.getDebtById(input.id);
    if (!saved) throw new Error('Deuda no encontrada para actualizar.');
    return saved;
  }

  async getDebtById(debtId: string): Promise<Debt | null> {
    const row = await this.db.getFirstAsync<DebtRow>(
      `SELECT id, account_id, principal_amount, current_balance, currency, interest_rate, min_payment, due_day, status FROM debts WHERE id = ? LIMIT 1;`,
      [debtId],
    );
    return row ? this.mapDebt(row) : null;
  }

  async listDebts(): Promise<Debt[]> {
    const rows = await this.db.getAllAsync<DebtRow>(
      `SELECT id, account_id, principal_amount, current_balance, currency, interest_rate, min_payment, due_day, status FROM debts ORDER BY created_at DESC;`,
    );
    return rows.map((row) => this.mapDebt(row));
  }

  async recordGoalContribution(input: OperationalMovementDraft): Promise<{ movement: OperationalMovementRecord; goal: SavingsGoal }> {
    return this.db.withTransaction(async () => {
      if (!input.goalId) throw new Error('Aporte inválido: goalId es requerido.');
      const goal = await this.getSavingsGoalById(input.goalId);
      if (!goal) throw new Error('Meta no encontrada para registrar aporte real.');

      const movement = await this.createOperationalMovement(input);
      await this.db.execAsync(`
        UPDATE savings_goals
        SET current_amount = current_amount + ${input.amount.amount}, updated_at = CURRENT_TIMESTAMP
        WHERE id = '${input.goalId.replace(/'/g, "''")}';
      `);
      const updatedGoal = await this.getSavingsGoalById(input.goalId);
      if (!updatedGoal) throw new Error('Meta inconsistente tras registrar aporte real.');
      return { movement, goal: updatedGoal };
    });
  }

  async recordDebtPayment(input: OperationalMovementDraft): Promise<{ movement: OperationalMovementRecord; debt: Debt }> {
    return this.db.withTransaction(async () => {
      if (!input.debtId) throw new Error('Pago inválido: debtId es requerido.');
      const debt = await this.getDebtById(input.debtId);
      if (!debt) throw new Error('Deuda no encontrada para registrar pago real.');

      const movement = await this.createOperationalMovement(input);
      await this.db.execAsync(`
        UPDATE debts
        SET current_balance = MAX(current_balance - ${input.amount.amount}, 0),
            status = CASE WHEN (current_balance - ${input.amount.amount}) <= 0 THEN 'paid' ELSE 'active' END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = '${input.debtId.replace(/'/g, "''")}';
      `);
      const updatedDebt = await this.getDebtById(input.debtId);
      if (!updatedDebt) throw new Error('Deuda inconsistente tras registrar pago real.');
      return { movement, debt: updatedDebt };
    });
  }

  async getSavingsGoalSummary(goalId: string, asOfDate: string): Promise<SavingsGoalSummary> {
    const goal = await this.getSavingsGoalById(goalId);
    if (!goal) throw new Error('Meta no encontrada para resumen.');
    const progress = calculateSavingsGoalProgress(goal.currentAmount.amount, goal.targetAmount.amount);
    const pendingAmount = calculatePendingSavingsAmount(goal.currentAmount.amount, goal.targetAmount.amount);
    const suggested = calculateSuggestedBiweeklyContribution({
      currentAmount: goal.currentAmount.amount,
      targetAmount: goal.targetAmount.amount,
      targetDate: goal.targetDate,
      asOfDate,
    });
    return {
      goalId,
      progress,
      pendingAmount: { amount: pendingAmount, currency: goal.targetAmount.currency },
      suggestedBiweeklyContribution: { amount: suggested, currency: goal.targetAmount.currency },
    };
  }

  async getDebtSummary(debtId: string): Promise<DebtSummary> {
    const debt = await this.getDebtById(debtId);
    if (!debt) throw new Error('Deuda no encontrada para resumen.');
    const progress = calculateDebtProgress(debt.currentBalance.amount, debt.principalAmount.amount);
    const paidAmount = calculateDebtPaidAmount(debt.currentBalance.amount, debt.principalAmount.amount);
    return {
      debtId,
      progress,
      paidAmount: { amount: paidAmount, currency: debt.principalAmount.currency },
      remainingBalance: debt.currentBalance,
    };
  }

  private mapQuincena(row: QuincenaRow): Quincena {
    return {
      id: row.id as QuincenaId,
      startsAt: row.starts_at as Quincena['startsAt'],
      endsAt: row.ends_at as Quincena['endsAt'],
      label: row.label,
    };
  }

  private mapFinancialPlan(row: FinancialPlanRow): FinancialPlanRecord {
    return {
      id: row.id,
      quincenaId: row.quincena_id,
      categoryId: row.category_id,
      accountId: row.account_id,
      isFixed: row.is_fixed === 1,
      fixedExpenseId: row.fixed_expense_id,
      planned: {
        amount: row.planned_amount,
        currency: row.currency === DEFAULT_CURRENCY ? DEFAULT_CURRENCY : DEFAULT_CURRENCY,
      },
    };
  }

  private mapSavingsGoal(row: SavingsGoalRow): SavingsGoal {
    return {
      id: row.id,
      name: row.name,
      targetAmount: { amount: row.target_amount, currency: row.currency === DEFAULT_CURRENCY ? DEFAULT_CURRENCY : DEFAULT_CURRENCY },
      currentAmount: { amount: row.current_amount, currency: row.currency === DEFAULT_CURRENCY ? DEFAULT_CURRENCY : DEFAULT_CURRENCY },
      targetDate: row.target_date,
      accountId: row.account_id,
      categoryId: row.category_id,
    };
  }

  private mapDebt(row: DebtRow): Debt {
    return {
      id: row.id,
      accountId: row.account_id,
      principalAmount: { amount: row.principal_amount, currency: row.currency === DEFAULT_CURRENCY ? DEFAULT_CURRENCY : DEFAULT_CURRENCY },
      currentBalance: { amount: row.current_balance, currency: row.currency === DEFAULT_CURRENCY ? DEFAULT_CURRENCY : DEFAULT_CURRENCY },
      interestRate: row.interest_rate,
      minPayment: row.min_payment === null ? null : { amount: row.min_payment, currency: row.currency === DEFAULT_CURRENCY ? DEFAULT_CURRENCY : DEFAULT_CURRENCY },
      dueDay: row.due_day,
      status: row.status,
    };
  }

  private async assertDebtAccountEligible(accountId: string): Promise<void> {
    const account = await this.db.getFirstAsync<{ id: string; type: string }>(
      `SELECT id, type FROM accounts WHERE id = ? LIMIT 1;`,
      [accountId],
    );
    if (!account || account.type !== 'credit_card') {
      throw new Error('Cuenta no elegible para deuda: debe ser credit_card.');
    }
  }

  private mapFixedExpense(row: FixedExpenseRow) {
    return {
      id: row.id,
      name: row.name,
      amount: { amount: row.amount, currency: row.currency === DEFAULT_CURRENCY ? DEFAULT_CURRENCY : DEFAULT_CURRENCY },
      categoryId: row.category_id,
      accountId: row.account_id,
      frequency: row.frequency,
      isActive: row.is_active === 1,
    };
  }

  private isFrequencyApplicable(frequency: 'quincenal' | 'mensual', quincenaStart: string): boolean {
    if (frequency === 'quincenal') return true;
    const day = Number(quincenaStart.split('-')[2]);
    return day <= 15;
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
