// Schematic UAE map with a pin per project site (approximate outline, not survey-accurate).
import { useI18n } from "@/lib/i18n";

const W = 320, H = 258;
const LON0 = 51.3, LON1 = 56.6, LAT0 = 22.4, LAT1 = 26.3;
const px = (lon: number) => ((lon - LON0) / (LON1 - LON0)) * W;
const py = (lat: number) => ((LAT1 - lat) / (LAT1 - LAT0)) * H;

const OUTLINE: [number, number][] = [
  [51.58, 24.26], [51.8, 24.05], [52.1, 24.0], [52.6, 24.18], [53.2, 24.12], [53.8, 24.05], [54.2, 24.3], [54.45, 24.45],
  [54.65, 24.7], [55.0, 24.95], [55.3, 25.25], [55.45, 25.42], [55.7, 25.55], [55.95, 25.8], [56.08, 26.05], [56.13, 25.62],
  [56.27, 25.62], [56.36, 25.2], [56.37, 24.98], [56.2, 24.85], [55.95, 24.6], [55.8, 24.25], [55.6, 24.0], [55.2, 23.5],
  [55.45, 23.0], [55.2, 22.7], [54.0, 22.65], [52.6, 22.95], [51.6, 24.1],
];
const CITIES: { name: string; lon: number; lat: number }[] = [
  { name: "Abu Dhabi", lon: 54.37, lat: 24.47 },
  { name: "Dubai", lon: 55.27, lat: 25.2 },
  { name: "Al Ain", lon: 55.76, lat: 24.21 },
];

type Box = { x: number; y: number; w: number; h: number };
const hit = (a: Box, b: Box) => a.x < b.x + b.w + 2 && b.x < a.x + a.w + 2 && a.y < b.y + b.h + 2 && b.y < a.y + a.h + 2;

/** Place each pin label at the first free spot: above, below, right, then left of the pin. */
function placeLabels(sites: MapSite[]) {
  const placed: Box[] = sites.map((s) => ({ x: px(s.lng) - 8, y: py(s.lat) - 8, w: 16, h: 16 })); // pins are obstacles too
  return [...sites].sort((a, b) => b.open - a.open).map((s) => {
    const x = px(s.lng), y = py(s.lat);
    const label = `${s.no} · ${s.open}`;
    const w = 14 + label.length * 6, h = 17;
    const tries: Box[] = [
      { x: x - w / 2, y: y - 31, w, h }, { x: x - w / 2, y: y + 13, w, h },
      { x: x + 11, y: y - h / 2, w, h }, { x: x - w - 11, y: y - h / 2, w, h },
      { x: x - w / 2, y: y - 50, w, h }, { x: x - w / 2, y: y + 32, w, h },
    ].map((b) => ({ ...b, x: Math.max(2, Math.min(W - b.w - 2, b.x)), y: Math.max(2, Math.min(H - b.h - 2, b.y)) }));
    const own = placed.findIndex((p) => p.x === x - 8 && p.y === y - 8);
    const others = placed.filter((_, i) => i !== own);
    const box = tries.find((b) => !others.some((p) => hit(b, p))) ?? tries[0];
    placed.push(box);
    return { s, lx: box.x, ly: box.y, w, label };
  });
}

export type MapSite = { id: string; no: string; name: string; lat: number; lng: number; open: number; urgent: number };

export function SiteMap({ sites }: { sites: MapSite[] }) {
  const { t } = useI18n();
  const d = OUTLINE.map(([lon, lat], i) => `${i ? "L" : "M"}${px(lon).toFixed(1)} ${py(lat).toFixed(1)}`).join(" ") + " Z";
  const nearPin = (x: number, y: number) => sites.some((s) => Math.hypot(px(s.lng) - x, py(s.lat) - y) < 26);

  return (
    <div>
      <div dir="ltr" className="mx-auto max-w-md">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto max-h-[300px] w-full" role="img" aria-label={t("Map of project sites")}>
          <defs>
            <linearGradient id="land" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--viz-track)" />
              <stop offset="1" stopColor="var(--viz-grid)" />
            </linearGradient>
            <pattern id="sea" width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r=".8" fill="var(--viz-1)" opacity=".12" />
            </pattern>
          </defs>
          <rect width={W} height={H} rx="14" fill="url(#sea)" />
          <path d={d} fill="url(#land)" stroke="var(--viz-base)" strokeWidth="1.2" strokeLinejoin="round" />
          {CITIES.filter((c) => !nearPin(px(c.lon), py(c.lat))).map((c) => (
            <g key={c.name}>
              <circle cx={px(c.lon)} cy={py(c.lat)} r="2" fill="var(--viz-muted)" />
              <text x={px(c.lon) + 5} y={py(c.lat) - 4} fontSize="9" fill="var(--viz-muted)" fontWeight="600">{t(c.name)}</text>
            </g>
          ))}
          {placeLabels(sites).map(({ s, lx, ly, w, label }, i) => {
            const x = px(s.lng), y = py(s.lat);
            return (
              <g key={s.id} className="animate-fade-in" style={{ animationDelay: `${300 + i * 150}ms` }}>
                <circle cx={x} cy={y} r="14" fill={s.urgent ? "#e34948" : "var(--viz-1)"} opacity=".18">
                  <animate attributeName="r" values="7;17;7" dur="2.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values=".35;0;.35" dur="2.4s" repeatCount="indefinite" />
                </circle>
                <circle cx={x} cy={y} r="6.5" fill="var(--viz-1)" stroke="white" strokeWidth="2" />
                <rect x={lx} y={ly} width={w} height="17" rx="8.5" fill="#0f172a" opacity=".9" />
                <text x={lx + w / 2} y={ly + 11.5} fontSize="10" fontWeight="700" fill="white" textAnchor="middle">{label}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <ul className="mt-3 space-y-1.5">
        {sites.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "var(--viz-1)" }} />
            <span className="font-semibold text-slate-900">{s.no}</span>
            <span className="truncate text-slate-600">{s.name}</span>
            <span className="ms-auto shrink-0 text-xs font-semibold text-slate-700">
              {t("{n} open", { n: s.open })}{s.urgent ? <span className="text-rose-600"> · {t("{n} urgent", { n: s.urgent })}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-slate-400">{t("Schematic map, approximate site locations.")} {t("Pin label: project · open requests.")}</p>
    </div>
  );
}
