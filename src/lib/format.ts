import { getLang, translate as t } from "./i18n";

const TZ = "Asia/Dubai";
// Arabic month names with Western digits (matches stored data and the LPO).
const loc = () => (getLang() === "ar" ? "ar-AE-u-nu-latn" : "en-GB");

export function todayDubai(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** "2026-11-28" -> "28 Nov 2026" (date-only values, no timezone shift). */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(loc(), {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

export function fmtDateTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(loc(), {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ,
  });
}

export function fmtDayMonth(d: Date): string {
  return d.toLocaleDateString(loc(), { day: "numeric", month: "short", timeZone: TZ });
}

export function fmtLongToday(): string {
  return new Date().toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
}

/** "3 days ago" style, for list freshness. */
export function ago(ts: string | null | undefined): string {
  if (!ts) return "";
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return t("just now");
  if (mins < 60) return t("{n} min ago", { n: mins });
  const h = Math.round(mins / 60);
  if (h < 24) return t("{n} h ago", { n: h });
  const d = Math.round(h / 24);
  return d === 1 ? t("1 day ago") : t("{n} days ago", { n: d });
}

/** Compact duration: "3h", "1d 4h". */
export function fmtDuration(ms: number): string {
  const h = Math.max(0, Math.floor(ms / 3_600_000));
  if (h < 1) return t("{n}m", { n: Math.max(1, Math.floor(ms / 60_000)) });
  if (h < 24) return t("{n}h", { n: h });
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? t("{d}d {h}h", { d, h: rh }) : t("{d}d", { d });
}

/** Accepts Arabic-Indic digits (١٢٣) and normalises to Western digits. */
export function normaliseDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[٫,]/g, ".");
}
