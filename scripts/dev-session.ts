// DEV ONLY: prints a one-hour test session for a demo user, so the app can be tested in a
// local browser without typing the shared demo password. Uses the service key locally.
// Usage: npx tsx scripts/dev-session.ts se1
import { createClient } from "@supabase/supabase-js";
import { adminClient, ANON_KEY, SUPABASE_URL, USERS, type UserKey } from "./lib";

const key = process.argv[2] as UserKey;
if (!USERS[key]) throw new Error(`Unknown user. Use one of: ${Object.keys(USERS).join(", ")}`);

const { data, error } = await adminClient().auth.admin.generateLink({ type: "magiclink", email: USERS[key].email });
if (error) throw error;
const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
const v = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
if (v.error || !v.data.session) throw v.error ?? new Error("no session");
const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
const s = v.data.session;
const compact = {
  access_token: s.access_token, refresh_token: s.refresh_token, token_type: "bearer", expires_in: s.expires_in, expires_at: s.expires_at,
  user: { id: s.user.id, aud: "authenticated", role: "authenticated", email: s.user.email, app_metadata: { provider: "email" }, user_metadata: {} },
};
// Paste into the browser console on the local app to switch user.
console.log(`localStorage.setItem(${JSON.stringify(`sb-${ref}-auth-token`)}, ${JSON.stringify(JSON.stringify(compact))}); location.reload();`);
