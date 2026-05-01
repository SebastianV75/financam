import type { LocalDateISO, QuincenaId, QuincenaRange } from '@/domain/finance';

function asDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function toIsoParts(date: Date): LocalDateISO {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeToLocalDate(value: string | Date): LocalDateISO {
  if (typeof value === 'string') {
    const directMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (directMatch) return directMatch[1];
  }
  return toIsoParts(asDate(value));
}

export function resolveQuincenaRange(value: string | Date): QuincenaRange {
  const localDate = normalizeToLocalDate(value);
  const [yearRaw, monthRaw, dayRaw] = localDate.split('-').map(Number);
  const year = yearRaw;
  const month = monthRaw;
  const day = dayRaw;

  if (day <= 15) {
    return {
      startsAt: `${year}-${String(month).padStart(2, '0')}-01`,
      endsAt: `${year}-${String(month).padStart(2, '0')}-15`,
    };
  }

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startsAt: `${year}-${String(month).padStart(2, '0')}-16`,
    endsAt: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function buildQuincenaId(range: QuincenaRange): QuincenaId {
  return `${range.startsAt}_${range.endsAt}`;
}

export function isDateWithinQuincena(value: string | Date, range: QuincenaRange): boolean {
  const localDate = normalizeToLocalDate(value);
  return localDate >= range.startsAt && localDate <= range.endsAt;
}
