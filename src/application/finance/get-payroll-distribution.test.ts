import { getPayrollDistribution } from './get-payroll-distribution';

describe('getPayrollDistribution', () => {
  it('consulta por quincena', async () => {
    const repository = {
      getPayrollDistributionByQuincena: jest.fn().mockResolvedValue({ id: 'pd-1' }),
      getPayrollDistributionById: jest.fn(),
    };

    const result = await getPayrollDistribution(repository as never, { quincenaId: 'q1' });
    expect(repository.getPayrollDistributionByQuincena).toHaveBeenCalledWith('q1');
    expect(result).toEqual({ id: 'pd-1' });
  });

  it('rechaza consulta vacía', async () => {
    await expect(
      getPayrollDistribution({ getPayrollDistributionByQuincena: jest.fn(), getPayrollDistributionById: jest.fn() } as never, {}),
    ).rejects.toThrow('Se requiere distributionId o quincenaId');
  });
});
