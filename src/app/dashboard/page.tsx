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

        // Resolve role via RPC (source: public.user_roles)
        let role: string | null = null;
        let tries = 0;
        while (active && tries < 4 && !role) {
          const { data, error: rpcErr } = await supabase.rpc("fn_current_role");
          if (rpcErr) console.warn("/dashboard rpc error", rpcErr);
          role = (data as string | null) ?? null;
          if (!role) await new Promise((r) => setTimeout(r, 50 + tries * tries * 50));
          tries++;
        }

        if (!active) return;
        if (!role) {
          // last-ditch: read public.users and STAMP user_roles accordingly
          const { data: legacy, error: legErr } = await supabase
            .from("users")
            .select("role")
            .eq("id", session.user.id)
            .maybeSingle();
          if (legErr) console.warn("/dashboard legacy users read error", legErr);
          const legacyRole = (legacy?.role as string | undefined) ?? null;
          if (legacyRole) {
            // stamp into central table so future checks are deterministic
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
