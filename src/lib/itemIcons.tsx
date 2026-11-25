// Category -> icon + tint, so catalogue items are quick to recognise.
import {
  Bolt, BrickWall, Construction, Droplets, Fuel, HardHat, Hammer, LayoutGrid, Mountain, Package, PaintBucket,
  PaintRoller, Pipette, Shovel, Trash2, TreePine, Umbrella, type LucideIcon,
} from "lucide-react";
import { cn } from "@/components/ui";

const MAP: Record<string, { icon: LucideIcon; tint: string }> = {
  Water: { icon: Droplets, tint: "from-sky-400 to-sky-600" },
  Fuel: { icon: Fuel, tint: "from-amber-400 to-orange-600" },
  Debris: { icon: Trash2, tint: "from-stone-400 to-stone-600" },
  "Sand & aggregate": { icon: Mountain, tint: "from-yellow-500 to-amber-700" },
  Cement: { icon: Package, tint: "from-slate-400 to-slate-600" },
  Steel: { icon: Construction, tint: "from-zinc-500 to-zinc-700" },
  Blocks: { icon: BrickWall, tint: "from-orange-400 to-red-600" },
  Timber: { icon: TreePine, tint: "from-lime-600 to-green-700" },
  Fixings: { icon: Hammer, tint: "from-indigo-400 to-indigo-600" },
  Waterproofing: { icon: Umbrella, tint: "from-cyan-500 to-blue-700" },
  Plumbing: { icon: Pipette, tint: "from-teal-400 to-teal-600" },
  Electrical: { icon: Bolt, tint: "from-yellow-400 to-amber-500" },
  Scaffolding: { icon: LayoutGrid, tint: "from-neutral-400 to-neutral-600" },
  PPE: { icon: HardHat, tint: "from-orange-400 to-orange-600" },
  Tools: { icon: Shovel, tint: "from-emerald-500 to-emerald-700" },
  Paint: { icon: PaintRoller, tint: "from-pink-400 to-rose-600" },
};
const FREE = { icon: PaintBucket, tint: "from-amber-300 to-amber-500" };

export function ItemIcon({ category, size = "md" }: { category?: string | null; size?: "sm" | "md" }) {
  const m = (category && MAP[category]) || FREE;
  const Icon = m.icon;
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white shadow-sm", m.tint, size === "sm" ? "h-7 w-7" : "h-9 w-9")} aria-hidden>
      <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </span>
  );
}
