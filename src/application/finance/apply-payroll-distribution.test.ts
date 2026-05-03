import { applyPayrollDistribution } from './apply-payroll-distribution';

describe('applyPayrollDistribution', () => {
  it('aplica distribución explícitamente y materializa movimientos vía repositorio', async () => {
    const repository = {
      getPayrollDistributionById: jest.fn().mockResolvedValue({ id: 'pd-1', status: 'draft', entries: [{ id: 'e1' }] }),
      applyPayrollDistribution: jest
        .fn()
        .mockResolvedValue({ distribution: { id: 'pd-1', status: 'applied' }, createdMovementIds: ['m1'], alreadyApplied: false }),
    };

    const result = await applyPayrollDistribution(repository as never, {
      applicationId: 'app-1',
      distributionId: 'pd-1',
      incomeMovementId: 'income-1',
      appliedAt: '2026-05-10T10:00:00Z',
    });

    expect(repository.applyPayrollDistribution).toHaveBeenCalled();
    expect(result.createdMovementIds).toEqual(['m1']);
  });

  it('rechaza apply sin entries', async () => {
    const repository = {
      getPayrollDistributionById: jest.fn().mockResolvedValue({ id: 'pd-1', status: 'draft', entries: [] }),
      applyPayrollDistribution: jest.fn(),
    };

    await expect(
      applyPayrollDistribution(repository as never, {
        applicationId: 'app-1',
        distributionId: 'pd-1',
        incomeMovementId: 'income-1',
        appliedAt: '2026-05-10',
      }),
    ).rejects.toThrow('sin destinos');
  });
});
