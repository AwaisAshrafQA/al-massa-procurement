// Minimal i18n: English is the key; Arabic comes from the dictionary in i18n.ar.ts.
// The <html> element gets lang/dir so the whole layout mirrors for Arabic (RTL).
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AR, AR_PATTERNS } from "./i18n.ar";

export type Lang = "en" | "ar";
const KEY = "am.lang";

let current: Lang = "en";
export const getLang = () => current;

function readStored(): Lang {
  try {
    return localStorage.getItem(KEY) === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

/** Translate outside React (e.g. in formatters). `{name}` placeholders are filled from vars. */
export function translate(s: string, vars?: Record<string, string | number>): string {
  let out = s;
  if (current === "ar") {
    if (AR[s] !== undefined) out = AR[s];
    else for (const [re, fn] of AR_PATTERNS) { const m = s.match(re); if (m) { out = fn(m); break; } }
  }
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: typeof translate; dir: "ltr" | "rtl" };
const LangCtx = createContext<Ctx | null>(null);

function apply(l: Lang) {
  current = l;
  document.documentElement.lang = l;
  document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const l = readStored();
    apply(l);
    return l;
  });
  useEffect(() => apply(lang), [lang]);
  const setLang = useCallback((l: Lang) => {
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
    apply(l);
    setLangState(l);
  }, []);
  // `t` changes identity with the language so consumers re-render.
  const t = useCallback((s: string, vars?: Record<string, string | number>) => translate(s, vars), [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  return <LangCtx.Provider value={{ lang, setLang, t, dir: lang === "ar" ? "rtl" : "ltr" }}>{children}</LangCtx.Provider>;
}

export function useI18n() {
  const v = useContext(LangCtx);
  if (!v) throw new Error("useI18n must be inside LangProvider");
  return v;
}
