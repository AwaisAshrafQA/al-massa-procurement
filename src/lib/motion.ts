import { useEffect, useRef, useState } from "react";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Animates a number from 0 to `target` (ease-out). Jumps straight there with reduced motion. */
export function useCountUp(target: number, ms = 900, decimals = 0): string {
  const [v, setV] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion() || !Number.isFinite(target)) {
      setV(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(target * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);
  return v.toFixed(decimals);
}

/** Inline style for staggered entrance animations. */
export const stagger = (i: number, step = 45, max = 12) => ({ animationDelay: `${Math.min(i, max) * step}ms` });
