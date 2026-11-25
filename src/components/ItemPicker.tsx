import { Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { Item } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { ItemIcon } from "@/lib/itemIcons";
import { cn } from "./ui";

type Value = { itemId: string | null; description: string | null };

/** Search the catalogue by code or name; anything not found can be used as free text. */
export function ItemPicker({ items, value, onPick, invalid, id }: {
  items: Item[];
  value: Value;
  onPick: (v: { item: Item | null; description: string | null }) => void;
  invalid?: boolean;
  id?: string;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = value.itemId ? items.find((i) => i.id === value.itemId) : undefined;

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items.slice(0, 8);
    const words = s.split(/\s+/);
    return items
      .filter((i) => {
        const hay = `${i.item_code} ${i.name} ${i.size ?? ""} ${i.category ?? ""}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => Number(b.item_code.toLowerCase().startsWith(s)) - Number(a.item_code.toLowerCase().startsWith(s)))
      .slice(0, 8);
  }, [q, items]);

  const choices: ({ kind: "item"; item: Item } | { kind: "text"; text: string })[] = [
    ...matches.map((item) => ({ kind: "item" as const, item })),
    ...(q.trim() ? [{ kind: "text" as const, text: q.trim() }] : []),
  ];

  function choose(i: number) {
    const c = choices[i];
    if (!c) return;
    if (c.kind === "item") onPick({ item: c.item, description: null });
    else onPick({ item: null, description: c.text });
    setQ("");
    setOpen(false);
  }

  if (selected || value.description) {
    return (
      <div className="flex min-h-11 animate-scale-in items-center gap-2.5 rounded-xl bg-slate-50 px-2.5 py-2 ring-1 ring-inset ring-slate-200">
        <ItemIcon category={selected?.category ?? null} size="sm" />
        <div className="min-w-0 flex-1 text-sm">
          {selected ? (
            <>
              <span className="me-1.5 rounded bg-brand-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-brand-700">{selected.item_code}</span>
              <span className="font-medium">{selected.name}</span>
            </>
          ) : (
            <>
              <span className="me-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">{t("Free text")}</span>
              <span className="font-medium">{value.description}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onPick({ item: null, description: null });
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="rounded p-1 text-slate-500 hover:bg-slate-200"
          aria-label={t("Change item")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute start-3 top-3 h-5 w-5 text-slate-400" aria-hidden />
      <input
        id={id}
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, choices.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter") { e.preventDefault(); choose(active); }
        }}
        placeholder={t("Search code or name, e.g. W2 or cement")}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        className={cn(
          "block w-full rounded-xl border-0 bg-white py-2.5 pe-3 ps-10 shadow-sm ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-500",
          invalid ? "ring-rose-400" : "ring-slate-300",
        )}
      />
      {open && choices.length > 0 && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-80 w-full animate-scale-in overflow-auto rounded-xl bg-white p-1 text-sm shadow-lift ring-1 ring-slate-200">
          {choices.map((c, i) => (
            <li
              key={c.kind === "item" ? c.item.id : "text"}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); choose(i); }}
              onMouseEnter={() => setActive(i)}
              className={cn("cursor-pointer rounded-lg px-2.5 py-2", i === active && "bg-brand-50")}
            >
              {c.kind === "item" ? (
                <div className="flex items-center gap-2.5">
                  <ItemIcon category={c.item.category} size="sm" />
                  <span className="w-9 shrink-0 font-mono text-xs font-semibold text-brand-700">{c.item.item_code}</span>
                  <span className="min-w-0">
                    <span className="font-medium">{c.item.name}</span>
                    <span className="text-slate-500"> · {c.item.default_unit}{c.item.size ? ` · ${c.item.size}` : ""}</span>
                  </span>
                </div>
              ) : (
                <div className="text-amber-800">
                  {t("Not in the catalogue? Use “{text}” as free text", { text: c.text })}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
