// Shared helpers for the seed script and API tests. Reads .env locally; never prints secrets.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env");
} catch {
  // In CI the variables come from the environment instead.
}

function need(name: string): string {
  const v = process.env[name];
  if (!v || v.includes("PASTE_")) throw new Error(`Missing ${name} in .env`);
  return v;
}

export const SUPABASE_URL = need("VITE_SUPABASE_URL");
export const ANON_KEY = need("VITE_SUPABASE_ANON_KEY");
export const DEMO_PASSWORD = need("DEMO_PASSWORD");

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, need("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** A client signed in as one of the demo users. */
export async function clientAs(email: string): Promise<SupabaseClient> {
  const c = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return c;
}

export const COMPANY_NAME = "Al Massa (demo)";

export const USERS = {
  se1: { email: "se1@example.com", name: "Ahmed Hassan", roles: ["site_engineer"] },
  se2: { email: "se2@example.com", name: "Rashid Khan", roles: ["site_engineer"] },
  proc1: { email: "proc1@example.com", name: "Sara Ali", roles: ["procurement"] },
  pm1: { email: "pm1@example.com", name: "Omar Farouk", roles: ["project_manager", "site_engineer"] },
  pm2: { email: "pm2@example.com", name: "Yousef Saleh", roles: ["project_manager"] },
  admin: { email: "admin@example.com", name: "Technical Office Admin", roles: ["admin"] },
  se3: { email: "se3@example.com", name: "Fatima Al Zaabi", roles: ["site_engineer"] },
  se4: { email: "se4@example.com", name: "Joseph Mathew", roles: ["site_engineer"] },
  proc2: { email: "proc2@example.com", name: "Hamza Yousuf", roles: ["procurement"] },
  pm3: { email: "pm3@example.com", name: "Khalid Mansour", roles: ["project_manager"] },
} as const;

export type UserKey = keyof typeof USERS;

/** Date N days from today in Asia/Dubai, as YYYY-MM-DD. */
export function dubaiDate(offsetDays: number): string {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(now);
}
