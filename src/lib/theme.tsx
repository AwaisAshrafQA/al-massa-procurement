// Light / dark / follow-the-device theme, stored per browser.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemePref = "light" | "dark" | "system";
const KEY = "am.theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function resolve(p: ThemePref): "light" | "dark" {
  return p === "system" ? (media().matches ? "dark" : "light") : p;
}
function apply(mode: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", mode === "dark" ? "#0b1220" : "#182540");
}

type Ctx = { pref: ThemePref; mode: "light" | "dark"; setPref: (p: ThemePref) => void; toggle: () => void };
const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v === "light" || v === "dark" ? v : "system";
    } catch {
      return "system";
    }
  });
  const [mode, setMode] = useState<"light" | "dark">(() => resolve(pref));

  useEffect(() => {
    const m = resolve(pref);
    setMode(m);
    apply(m);
    if (pref !== "system") return;
    const mq = media();
    const on = () => { const x = resolve("system"); setMode(x); apply(x); };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [pref]);

  const setPref = (p: ThemePref) => {
    try { localStorage.setItem(KEY, p); } catch { /* ignore */ }
    setPrefState(p);
  };
  return (
    <ThemeCtx.Provider value={{ pref, mode, setPref, toggle: () => setPref(mode === "dark" ? "light" : "dark") }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error("useTheme must be inside ThemeProvider");
  return v;
}
