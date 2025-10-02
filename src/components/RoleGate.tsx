"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Role = "staff" | "assistant_manager" | "manager" | "hr" | "ceo";

export default function RoleGate({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);
  const [resolving, setResolving] = useState(true);
  // Snapshot the allowed roles at mount to avoid effect re-runs from new array literals
  const allowSnapshotRef = useRef<Role[] | null>(null);
  if (allowSnapshotRef.current === null) allowSnapshotRef.current = allow;

  useEffect(() => {
    let mounted = true;
    async function run() {
      setResolving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // If not logged in, stop loading and render nothing while we redirect
        if (mounted) {
          setOk(false);
          setResolving(false);
        }
        router.replace("/login");
        return;
      }
      // Resolve role without RPC: read from central table with timeout, then fallback to legacy users
      let role: Role | null = null;
      const start = Date.now();
      if (session.user?.id) {
        try {
          const fb = await Promise.race([
            supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .maybeSingle(),
            new Promise((resolve) => setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 1500)),
          ]) as any;
          const r = (fb?.data as any)?.role as Role | undefined;
          if (r) role = r;
        } catch (e) {
          console.warn('RoleGate: user_roles query failed', e);
        }
      }
      if (!mounted) return;
      // Legacy fallback: public.users
      if (!role && session.user?.id) {
        try {
          const leg = await Promise.race([
            supabase
              .from('users')
              .select('role')
              .eq('id', session.user.id)
              .maybeSingle(),
            new Promise((resolve) => setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 1500)),
          ]) as any;
          const r = (leg?.data as any)?.role as Role | undefined;
          if (r) role = r;
        } catch (e) {
          console.warn('RoleGate: legacy users read failed', e);
        }
      }
      // Guard: if overall time exceeded, stop trying further
      if (!role && Date.now() - start > 5000) {
        setOk(false);
        setResolving(false);
        router.replace('/dashboard');
        return;
      }
      if (!role) {
        // Could not resolve role after retries/fallback: go to central redirector
        setOk(false);
        setResolving(false);
        router.replace("/dashboard");
        return;
      }
      const allowed = (allowSnapshotRef.current ?? allow).includes(role);
      setOk(allowed);
      if (!allowed) {
        // route based on known role only
        if (role === "ceo") router.replace("/ceo");
        else if (role === "hr") router.replace("/hr");
        else if (role === "staff" || role === "assistant_manager") router.replace("/staff");
        else if (role === "manager") router.replace("/manager");
        else router.replace("/");
      }
      setResolving(false);
    }
    run();
    return () => { mounted = false; };
  }, []);

  if (ok === null || resolving) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm opacity-70">Loading…</div>
    );
  }
  if (!ok) return null;
  return <>{children}</>;
}
