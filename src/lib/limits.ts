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

/**
 * Cleans quantity text as it is typed, so a bad value can't even be entered:
 * Arabic/Persian digits become 0-9, the Arabic decimal mark becomes ".", thousands separators
 * ("," and Arabic "٬") are dropped (so "1,500" stays 1500, never 1.5), and anything else
 * (minus signs, letters, "e", spaces) is removed. One dot, at most 3 decimals, 9 whole digits.
 */
export function sanitizeQty(raw: string): string {
  const s = raw
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/[^\d.]/g, "");
  const [whole, ...rest] = s.split(".");
  const w = whole.replace(/^0+(?=\d)/, "").slice(0, 9);
  return rest.length ? `${w || "0"}.${rest.join("").slice(0, 3)}` : w;
}

/** Positive number with at most 3 decimals and below the database limit. */
export function validQty(text: string): boolean {
  if (!/^\d+(\.\d{1,3})?$/.test(text.trim())) return false;
  const q = Number(text);
  return q > 0 && q <= LIMITS.maxQty;
}

/** What is wrong with a quantity for a given unit, or null. Messages are translation keys. */
export function qtyProblem(text: string, unit: { code: string; whole_only: boolean } | undefined): { msg: string; vars?: Record<string, string> } | null {
  if (!text.trim()) return { msg: "Enter a quantity." };
  if (!validQty(text) || Number(text) === 0) return { msg: "Enter a number above 0, with up to 3 decimals." };
  if (unit?.whole_only && !Number.isInteger(Number(text))) return { msg: "{unit} is counted in whole numbers.", vars: { unit: unit.code } };
  return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const validEmail = (s: string) => s.length <= LIMITS.email && EMAIL.test(s.trim());
