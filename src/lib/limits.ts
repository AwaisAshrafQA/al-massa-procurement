// Input limits shown in the forms. The database enforces the same limits
// (migration 20261126000007_input_limits.sql), so these are for a friendly message first.
export const LIMITS = {
  purpose: 200,
  urgentReason: 300,
  description: 200,
  sizeSpec: 100,
  lineNotes: 300,
  comment: 1000,
  orderNote: 300,
  lines: 50,
  search: 100,
  email: 254,
  password: 128,
  daysAhead: 365,
  maxQty: 999_999_999,
} as const;

/** yyyy-mm-dd, `days` after the given yyyy-mm-dd date. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Positive number with at most 3 decimals and below the database limit. */
export function validQty(text: string): boolean {
  if (!/^\d+(\.\d{1,3})?$/.test(text.trim())) return false;
  const q = Number(text);
  return q > 0 && q <= LIMITS.maxQty;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const validEmail = (s: string) => s.length <= LIMITS.email && EMAIL.test(s.trim());
