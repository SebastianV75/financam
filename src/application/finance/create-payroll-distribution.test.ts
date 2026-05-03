import { createPayrollDistribution } from './create-payroll-distribution';

describe('createPayrollDistribution', () => {
  it('crea borrador válido sin materializar movimientos', async () => {
    const repository = {
      savePayrollDistributionDraft: jest.fn().mockResolvedValue({ id: 'pd-1', status: 'draft', entries: [{ id: 'e1' }] }),
    };

    const result = await createPayrollDistribution(repository as never, {
      distributionId: 'pd-1',
      quincenaId: 'q1',
      totalAmount: 1000,
      currency: 'MXN',
      entries: [{ id: 'e1', targetType: 'account', targetId: 'a2', allocatedAmount: 1000, sortOrder: 1 }],
    });

    expect(repository.savePayrollDistributionDraft).toHaveBeenCalled();
    expect(result.status).toBe('draft');
  });

  it('rechaza suma excedida', async () => {
    await expect(
      createPayrollDistribution({ savePayrollDistributionDraft: jest.fn() } as never, {
        distributionId: 'pd-1',
        quincenaId: 'q1',
        totalAmount: 1000,
        currency: 'MXN',
        entries: [{ id: 'e1', targetType: 'account', targetId: 'a2', allocatedAmount: 1200, sortOrder: 1 }],
      }),
    ).rejects.toThrow('excede');
  });
});
