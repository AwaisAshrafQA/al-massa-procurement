// Small dependency-free confetti burst for the "goods received" moment. Skipped with reduced motion.
import { prefersReducedMotion } from "./motion";

const COLORS = ["#203050", "#f09020", "#f6a84a", "#34497f", "#8597c4", "#ffd29a"];

export function celebrate() {
  if (typeof document === "undefined" || prefersReducedMotion()) return;
  const canvas = document.createElement("canvas");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "80" });
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const W = window.innerWidth;
  const H = window.innerHeight;
  const parts = Array.from({ length: 140 }, (_, i) => {
    const fromLeft = i % 2 === 0;
    return {
      x: fromLeft ? W * 0.1 : W * 0.9,
      y: H * 0.65,
      vx: (fromLeft ? 1 : -1) * (3 + Math.random() * 6),
      vy: -(9 + Math.random() * 8),
      r: 3 + Math.random() * 4,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      c: COLORS[i % COLORS.length],
      shape: i % 3,
    };
  });

  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.32;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t / 2200);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      if (p.shape === 0) ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      else if (p.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, p.r / 1.4, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(0, -p.r); ctx.lineTo(p.r, p.r); ctx.lineTo(-p.r, p.r); ctx.fill(); }
      ctx.restore();
    }
    if (t < 2300) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
