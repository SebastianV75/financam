import {
  buildQuincenaId,
  isDateWithinQuincena,
  normalizeToLocalDate,
  resolveQuincenaRange,
} from './pay-cycle';

describe('pay-cycle rules', () => {
  it('resuelve primera quincena 1-15', () => {
    expect(resolveQuincenaRange('2026-05-08T10:00:00Z')).toEqual({
      startsAt: '2026-05-01',
      endsAt: '2026-05-15',
    });
  });

  it('resuelve segunda quincena con fin variable (febrero no bisiesto)', () => {
    expect(resolveQuincenaRange('2026-02-27T10:00:00Z')).toEqual({
      startsAt: '2026-02-16',
      endsAt: '2026-02-28',
    });
  });

  it('genera id determinista', () => {
    expect(buildQuincenaId({ startsAt: '2026-05-01', endsAt: '2026-05-15' })).toBe('2026-05-01_2026-05-15');
  });

  it('normaliza fecha a YYYY-MM-DD e incluye validación de rango', () => {
    const occurredAt = normalizeToLocalDate('2026-05-16T23:59:59Z');
    expect(occurredAt).toMatch(/^2026-05-\d{2}$/);
    expect(isDateWithinQuincena(occurredAt, { startsAt: '2026-05-16', endsAt: '2026-05-31' })).toBe(true);
    expect(isDateWithinQuincena('2026-05-15', { startsAt: '2026-05-16', endsAt: '2026-05-31' })).toBe(false);
  });

  it('resuelve quincena usando primero proyección YYYY-MM-DD sin deriva por timezone', () => {
    expect(resolveQuincenaRange('2026-05-16T00:30:00Z')).toEqual({
      startsAt: '2026-05-16',
      endsAt: '2026-05-31',
    });
  });
});
