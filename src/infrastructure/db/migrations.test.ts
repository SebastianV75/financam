import { FOUNDATION_MIGRATIONS, migrateDatabase } from './migrations';

describe('migrateDatabase', () => {
  it('aplica las migraciones pendientes y actualiza user_version', async () => {
    const execAsync = jest.fn().mockResolvedValue(undefined);
    const withTransaction = jest.fn().mockImplementation(async (operation) => operation());

    const applied = await migrateDatabase(
      {
        execAsync,
        getAllAsync: jest.fn(),
        getFirstAsync: jest.fn(),
        withTransaction,
      },
      0,
    );

    expect(applied).toEqual([1, 2, 3, 4, 5]);
    expect(execAsync).toHaveBeenCalledWith(FOUNDATION_MIGRATIONS[0].sql);
    expect(execAsync).toHaveBeenCalledWith(FOUNDATION_MIGRATIONS[1].sql);
    expect(execAsync).toHaveBeenCalledWith(
      "INSERT OR REPLACE INTO schema_migrations (version, name) VALUES (1, '0001_initial_foundation');",
    );
    expect(execAsync).toHaveBeenCalledWith('PRAGMA user_version = 1;');
    expect(execAsync).toHaveBeenCalledWith('PRAGMA user_version = 2;');
    expect(execAsync).toHaveBeenCalledWith('PRAGMA user_version = 3;');
    expect(execAsync).toHaveBeenCalledWith('PRAGMA user_version = 4;');
    expect(execAsync).toHaveBeenCalledWith('PRAGMA user_version = 5;');
    expect(withTransaction).toHaveBeenCalledTimes(5);
  });

  it('define migración v2 con rebuild e índices', () => {
    const sql = FOUNDATION_MIGRATIONS[1].sql;

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS accounts');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS categories');
    expect(sql).toContain('CREATE TABLE operational_movements_v2');
    expect(sql).toContain('INSERT INTO operational_movements_v2');
    expect(sql).toContain('ALTER TABLE operational_movements_v2 RENAME TO operational_movements');
  });

  it('define migración v3 con índices de quincena y consulta operativa', () => {
    const sql = FOUNDATION_MIGRATIONS[2].sql;

    expect(sql).toContain('idx_quincenas_starts_at');
    expect(sql).toContain('idx_quincenas_ends_at');
    expect(sql).toContain('idx_operational_movements_quincena_occurred_at');
  });

  it('define migración v4 con payroll distributions y idempotencia de aplicación', () => {
    const sql = FOUNDATION_MIGRATIONS[3].sql;

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS payroll_distributions');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS payroll_distribution_entries');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS payroll_distribution_applications');
    expect(sql).toContain('distribution_id TEXT NOT NULL UNIQUE');
    expect(sql).toContain('idx_payroll_distribution_entries_distribution');
  });

  it('define migración v5 para presupuesto y gastos fijos sin backfill destructivo', () => {
    const sql = FOUNDATION_MIGRATIONS[4].sql;
    expect(sql).toContain('ALTER TABLE financial_plans ADD COLUMN account_id');
    expect(sql).toContain('ALTER TABLE financial_plans ADD COLUMN is_fixed');
    expect(sql).toContain('idx_financial_plans_quincena_category');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS fixed_expenses');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS fixed_expense_projections');
    expect(sql).toContain('idx_fixed_expense_projections_quincena');
  });
});
