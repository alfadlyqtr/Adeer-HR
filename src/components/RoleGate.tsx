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
        router.replace("/login");
        return;
      }
      // Resolve role via RPC to avoid RLS timing issues
      let role: Role | null = null;
      let tries = 0;
      while (mounted && tries < 4 && !role) {
        const { data: rpcRole, error } = await supabase.rpc('fn_current_role');
        if (error) console.warn('RoleGate: rpc error', error);
        role = (rpcRole as Role | null) ?? null;
        if (!role) await new Promise((r) => setTimeout(r, 50 + tries * tries * 50));
        tries++;
      }
      if (!mounted) return;
      if (!role) {
        // Could not resolve role after retries: fall back to central redirector
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
