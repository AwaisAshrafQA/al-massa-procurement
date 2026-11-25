// The single place the Al Massa logo is drawn.
// Official mark: public/brand/logo-mark-256.png (made from brand-source/ by scripts/make-mark.ts) (cut from the supplied logo by scripts/make-mark.ts).
// The mark is navy line-art on transparent, so it always sits on a white tile to stay visible
// on the dark header and in dark mode.
import { cn } from "./ui";

export const USE_OFFICIAL_LOGO = true;

/** Square brand mark (header, login, icons). */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  if (USE_OFFICIAL_LOGO) {
    return (
      <span
        className={cn("logo-tile grid shrink-0 place-items-center overflow-hidden bg-white shadow-md ring-1 ring-black/5", className)}
        style={{ width: size, height: size, borderRadius: Math.round(size * 0.26), padding: Math.round(size * 0.1) }}
      >
        <img src="/brand/logo-mark-256.png" alt="Al Massa" width={size} height={size} className="h-full w-full object-contain" draggable={false} />
      </span>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Al Massa" className={cn("shrink-0 drop-shadow-md", className)}>
      <rect width="64" height="64" rx="16" fill="#203050" />
    </svg>
  );
}

/** Mark + wordmark. `tone="light"` for dark backgrounds. */
export function Logo({ tone = "light", size = 38, sub = true }: { tone?: "light" | "dark"; size?: number; sub?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="leading-tight">
        <span className={cn("block text-[15px] font-extrabold tracking-tight", tone === "light" ? "text-white" : "text-slate-900")}>
          Al Massa
        </span>
        {sub && <span className={cn("block text-[11px] font-semibold", tone === "light" ? "text-[#f6a84a]" : "text-[#d97a0c]")}>Procurement</span>}
      </span>
    </span>
  );
}
