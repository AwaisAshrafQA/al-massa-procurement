import { CheckCircle2, Languages, Moon, ShieldCheck, Sun, Timer } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { LogoMark } from "@/components/Logo";
import { Alert, Button, Field, Input } from "@/components/ui";
import { homeFor, useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

const DEMO_USERS = [
  ["se1@example.com", "Site Engineer · projects 155 + GEN"],
  ["se2@example.com", "Site Engineer · project 162"],
  ["proc1@example.com", "Procurement"],
  ["pm1@example.com", "PM of 155 + GEN (also raises requests)"],
  ["pm2@example.com", "PM of 162"],
  ["admin@example.com", "Admin (Technical Office)"],
  ["se3@example.com", "Site Engineer · projects 168, 171, 149"],
  ["se4@example.com", "Site Engineer · projects 171, 174, 180"],
  ["proc2@example.com", "Procurement (second buyer)"],
  ["pm3@example.com", "PM of 168, 171, 149"],
];

export function Login() {
  const { me, signIn, loading } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { mode, toggle } = useTheme();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && me) {
    const from = (loc.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? homeFor(me)} replace />;
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 px-4 py-10 dark:from-[#050a14] dark:via-[#0a1630] dark:to-[#0f2a52]">
      <div className="pointer-events-none absolute -start-24 top-10 h-80 w-80 animate-float rounded-full bg-accent-400/30 blur-3xl" />
      <div className="pointer-events-none absolute -end-20 bottom-0 h-96 w-96 animate-float rounded-full bg-brand-400/40 blur-3xl [animation-delay:-7s]" />
      <div className="pointer-events-none absolute inset-0 opacity-[.07] [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:40px_40px]" />

      {/* language + theme */}
      <div className="absolute end-4 top-[calc(1rem+env(safe-area-inset-top,0px))] flex gap-2">
        <button onClick={() => setLang(lang === "ar" ? "en" : "ar")} className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/20">
          <Languages className="h-4 w-4" /> {lang === "ar" ? "English" : "العربية"}
        </button>
        <button onClick={toggle} className="rounded-xl bg-white/10 p-2 text-white backdrop-blur hover:bg-white/20" aria-label={mode === "dark" ? t("Light mode") : t("Dark mode")}>
          {mode === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-7 animate-fade-up text-center text-white">
          <LogoMark size={64} className="mx-auto mb-4 drop-shadow-xl" />
          <h1 className="text-2xl font-extrabold tracking-tight">{t("Al Massa Procurement")}</h1>
          <p className="mt-1 text-sm text-white/70">{t("Site requests, approvals and deliveries in one place")}</p>
        </div>

        <form
          className="animate-fade-up space-y-4 rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl shadow-black/30 backdrop-blur"
          style={{ animationDelay: "90ms" }}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const err = await signIn(email, password);
            setError(err ? t(err) : null);
            setBusy(false);
            const fresh = (loc.state as { from?: string } | null)?.from;
            if (fresh && !err) nav(fresh, { replace: true });
          }}
        >
          <Field label={t("Company email")} htmlFor="email">
            <Input id="email" type="email" dir="ltr" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={t("Password")} htmlFor="password">
            <Input id="password" type="password" dir="ltr" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" loading={busy} className="w-full">{t("Sign in")}</Button>
        </form>

        <div className="mt-5 grid animate-fade-up grid-cols-3 gap-2 text-center text-[11px] font-medium text-white/80" style={{ animationDelay: "180ms" }}>
          <div className="rounded-2xl bg-white/10 px-2 py-2.5 backdrop-blur"><Timer className="mx-auto mb-1 h-4 w-4" />{t("2-minute request")}</div>
          <div className="rounded-2xl bg-white/10 px-2 py-2.5 backdrop-blur"><CheckCircle2 className="mx-auto mb-1 h-4 w-4" />{t("Tracked approvals")}</div>
          <div className="rounded-2xl bg-white/10 px-2 py-2.5 backdrop-blur"><ShieldCheck className="mx-auto mb-1 h-4 w-4" />{t("Project-level access")}</div>
        </div>

        <details className="mt-4 animate-fade-up rounded-2xl bg-white/10 p-4 text-sm text-white backdrop-blur" style={{ animationDelay: "240ms" }}>
          <summary className="cursor-pointer font-semibold">{t("Demo accounts")}</summary>
          <p className="mt-2 text-xs text-white/70">{t("All demo accounts share one password, provided separately.")}</p>
          <ul className="mt-2 space-y-1.5">
            {DEMO_USERS.map(([e, d]) => (
              <li key={e}>
                <button type="button" onClick={() => setEmail(e)} className="w-full rounded-lg px-1.5 py-1 text-start hover:bg-white/10">
                  <span className="font-mono text-accent-400" dir="ltr">{e}</span>
                  <span className="block text-xs text-white/60">{t(d)}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
