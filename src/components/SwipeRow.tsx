import { useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "./ui";

/**
 * Swipe a card toward the start edge to reveal a quick action (touch or mouse drag).
 * The action only runs when its button is tapped, never on the swipe itself.
 */
export function SwipeRow({ children, action }: {
  children: ReactNode;
  action: { label: string; tone: "brand" | "success"; icon: ReactNode; run: () => Promise<void> } | null;
}) {
  const { dir } = useI18n();
  const sign = dir === "rtl" ? 1 : -1; // LTR: swipe left; RTL: swipe right
  const W = 112;
  const [x, setX] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<{ x: number; base: number; moved: boolean } | null>(null);

  if (!action) return <>{children}</>;

  const onDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, base: x, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (!s.moved && Math.abs(dx) > 6) {
      s.moved = true;
      // Capture only once a real sideways drag starts. Capturing on press sent a plain mouse
      // click to this wrapper instead of the card's link, so the card didn't open (seen on
      // touchscreen laptops used with a mouse).
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    if (!s.moved) return;
    const next = Math.max(0, Math.min(W, (s.base * sign + dx * sign))) * sign;
    setX(next);
  };
  const onUp = () => {
    if (!start.current) return;
    setX(Math.abs(x) > W / 2 ? W * sign : 0);
    setTimeout(() => { start.current = null; }, 0);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <button
        onClick={async () => { setBusy(true); try { await action.run(); } finally { setBusy(false); setX(0); } }}
        disabled={busy}
        className={cn(
          "absolute inset-y-0 end-0 flex w-[112px] flex-col items-center justify-center gap-1 text-xs font-bold text-white",
          action.tone === "success" ? "bg-gradient-to-b from-emerald-500 to-emerald-600" : "bg-gradient-to-b from-brand-500 to-brand-700",
          busy && "opacity-70",
        )}
        tabIndex={x === 0 ? -1 : 0}
        aria-hidden={x === 0}
      >
        {action.icon}
        {action.label}
      </button>
      <div
        className="relative touch-pan-y"
        style={{ transform: `translateX(${x}px)`, transition: start.current ? "none" : "transform .25s cubic-bezier(.2,.8,.2,1)" }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onDragStart={(e) => e.preventDefault()}
        onClickCapture={(e) => { if (start.current?.moved || x !== 0) { e.preventDefault(); e.stopPropagation(); if (!start.current?.moved) setX(0); } }}
      >
        {children}
      </div>
    </div>
  );
}

export function useSwipeHint() {
  const { t } = useI18n();
  let shown = false;
  try { shown = localStorage.getItem("am.swipehint") === "1"; } catch { /* ignore */ }
  const dismiss = () => { try { localStorage.setItem("am.swipehint", "1"); } catch { /* ignore */ } };
  return { shown, dismiss, text: t("Tip: swipe a card to forward or approve it quickly.") };
}
