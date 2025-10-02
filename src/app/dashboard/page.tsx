"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function DashboardRedirect() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          router.replace("/login");
          return;
        }
        if (!session) {
          router.replace("/login");
          return;
        }

        // Fast path: if we cached a role, route immediately (verify in background)
        let role: string | null = null;
        const cachedRole = typeof window !== 'undefined' ? (localStorage.getItem('adeer.role') || null) : null;
        if (cachedRole) {
          role = cachedRole;
          // route immediately
          if (role === "ceo") router.replace("/ceo");
          else if (role === "hr") router.replace("/hr");
          else if (role === "manager" || role === "assistant_manager") router.replace("/manager");
          else router.replace("/staff");
          // continue resolving in background, but don't block UI
        }

        // Resolve role via RPC with overall timeout and fallbacks
        if (!role) {
          let tries = 0;
          const start = Date.now();
          while (active && tries < 4 && !role) {
            const timeoutMs = 1200 + tries * 200;
            const result: any = await Promise.race([
              supabase.rpc('fn_current_role'),
              new Promise((resolve) => setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), timeoutMs)),
            ]);
            if (result?.error) console.warn('/dashboard rpc error', result.error);
            role = (result?.data as string | null) ?? null;
            if (role) break;
            if (Date.now() - start > 5000) break;
            await new Promise((r) => setTimeout(r, 50 + tries * tries * 50));
            tries++;
          }
        }

        if (!active) return;
        // Fallback 1: central table read
        if (!role) {
          const fb = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .maybeSingle();
          if (fb?.data?.role) role = fb.data.role as string;
        }

        // Fallback 2: legacy users table then stamp into central
        if (!role) {
          const { data: legacy, error: legErr } = await supabase
            .from("users")
            .select("role")
            .eq("id", session.user.id)
            .maybeSingle();
          if (legErr) console.warn("/dashboard legacy users read error", legErr);
          const legacyRole = (legacy?.role as string | undefined) ?? null;
          if (legacyRole) {
            const { error: upErr } = await supabase
              .from("user_roles")
              .upsert({ user_id: session.user.id, role: legacyRole });
            if (upErr) console.warn("/dashboard stamp user_roles error", upErr);
            role = legacyRole;
          }
        }

        if (!role) {
          // If still unknown, go to login
          router.replace("/login");
          return;
        }

        // Route based on role
        if (role === "ceo") router.replace("/ceo");
        else if (role === "hr") router.replace("/hr");
        else if (role === "manager" || role === "assistant_manager") router.replace("/manager");
        else router.replace("/staff");

        // Cache for faster subsequent redirects
        try { if (typeof window !== 'undefined') localStorage.setItem('adeer.role', role); } catch {}
      } finally {
        setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-brand-primary" />
        <p className="text-sm opacity-80">Authenticating → Checking role → Redirecting…</p>
      </div>
    </div>
  );
}
