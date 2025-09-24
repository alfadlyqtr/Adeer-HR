"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AutoRedirectDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const redirected = (globalThis as any).__adeer_redirected ?? { current: false };
  (globalThis as any).__adeer_redirected = redirected;

  useEffect(() => {
    let active = true;
    
    const checkAuthAndRedirect = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!active) return;
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          router.replace("/login");
          return;
        }

        if (!session) {
          router.replace("/login");
          return;
        }

        // Robust role fetch via RPC to avoid RLS race
        let role: string | null = null;
        let attempts = 0;
        while (active && attempts < 4 && !role) {
          const { data, error } = await supabase.rpc('fn_current_role');
          if (error) {
            console.warn('AutoRedirectDashboard: rpc role error', error);
          }
          role = (data as string | null) ?? null;
          if (!role) {
            await new Promise((r) => setTimeout(r, 50 + attempts * attempts * 50));
          }
          attempts++;
        }

        if (!active) return;

        console.log("User role:", role);

        if (!role) {
          // Fallback: try legacy source public.users once to avoid null loops
          try {
            const { data: legacy, error: legacyErr } = await supabase
              .from('users')
              .select('role')
              .eq('id', session.user.id)
              .maybeSingle();
            if (legacyErr) console.warn('AutoRedirectDashboard: legacy role error', legacyErr);
            role = (legacy?.role as string | undefined) ?? null;
          } catch {}
          if (!role) {
            setLoading(false);
            return;
          }
        }

        if (!redirected.current) {
          redirected.current = true;
          if (role === "hr" || role === "ceo") {
            router.replace("/hr");
          } else if (role === "manager" || role === "assistant_manager") {
            router.replace("/manager");
          } else {
            router.replace("/staff");
          }
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndRedirect();
    
    return () => { active = false; };
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-2"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return null;
}
