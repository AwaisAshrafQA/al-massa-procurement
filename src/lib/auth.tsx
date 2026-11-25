import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import type { Role } from "./strings";

export type Me = {
  id: string;
  fullName: string;
  email: string;
  roles: Role[];
  memberProjectIds: string[];
  pmProjectIds: string[];
};

type AuthState = {
  session: Session | null;
  me: Me | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  has: (r: Role) => boolean;
};

const Ctx = createContext<AuthState | null>(null);

async function loadMe(userId: string): Promise<Me | null> {
  const [profile, roles, members, pmOf] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email,active").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("project_members").select("project_id").eq("user_id", userId),
    supabase.from("projects").select("id").eq("pm_user_id", userId),
  ]);
  if (!profile.data || !profile.data.active) return null;
  return {
    id: profile.data.id,
    fullName: profile.data.full_name,
    email: profile.data.email,
    roles: (roles.data ?? []).map((r) => r.role as Role),
    memberProjectIds: (members.data ?? []).map((m) => m.project_id as string),
    pmProjectIds: (pmOf.data ?? []).map((p) => p.id as string),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const apply = async (s: Session | null) => {
      setSession(s);
      setMe(s ? await loadMe(s.user.id) : null);
      if (active) setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        // Defer so we don't call Supabase inside its own callback.
        setTimeout(() => apply(s), 0);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    session,
    me,
    loading,
    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return error.message === "Invalid login credentials" ? "Wrong email or password." : error.message;
      const profile = await loadMe(data.user.id);
      if (!profile) {
        await supabase.auth.signOut();
        return "This account is not set up for Al Massa Procurement. Contact the Technical Office.";
      }
      setMe(profile);
      return null;
    },
    async signOut() {
      await supabase.auth.signOut();
      setMe(null);
    },
    has: (r) => !!me?.roles.includes(r),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}

/** Where each role lands after sign-in. */
export function homeFor(_me: Me): string {
  return "/overview";
}
