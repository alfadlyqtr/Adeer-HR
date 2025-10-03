"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type Role = "staff" | "assistant_manager" | "manager" | "hr" | "ceo";

export function useUserRole() {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (mounted) { setRole(null); setLoading(false); }
        return;
      }
      // Prefer explicit assignment in user_roles, fallback to users.role
      let resolved: string | null = null;
      try {
        const ur = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (!ur.error && ur.data?.role) {
          resolved = String(ur.data.role).toLowerCase();
        }
      } catch {}
      if (!resolved) {
        const u = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle();
        if (!u.error && u.data?.role) {
          resolved = String(u.data.role).toLowerCase();
        }
      }
      if (!mounted) return;
      setRole((resolved as Role) || null);
      setLoading(false);
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return { role, loading } as const;
}
