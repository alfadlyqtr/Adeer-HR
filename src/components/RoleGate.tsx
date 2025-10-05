"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Role = "staff" | "assistant_manager" | "manager" | "hr" | "ceo";


export default function RoleGate({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);
  const [resolving, setResolving] = useState(true);
  const allowSnapshotRef = useRef<Role[] | null>(null);
  if (allowSnapshotRef.current === null) allowSnapshotRef.current = allow;

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        setResolving(true);
        const sessRes = await Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: any | null } }>((resolve) =>
            setTimeout(() => resolve({ data: { session: null } }), 1200)
          ),
        ]);
        const session = (sessRes as any)?.data?.session ?? null;
        if (!mounted) return;

        if (!session) {
          setOk(true);
          setResolving(false);
          setTimeout(async () => {
            const check = await supabase.auth.getSession();
            if (!mounted) return;
            if (!check?.data?.session) router.replace("/login");
          }, 2000);
          return;
        }

        const uid = session.user?.id as string | undefined;
        const cacheKey = uid ? `adeerhr-role:${uid}` : null;
        let cachedRole: Role | null = null;
        if (cacheKey) {
          try {
            const v = localStorage.getItem(cacheKey);
            if (v) cachedRole = v as Role;
          } catch {}
        }

        if (ok === null) {
          setOk(true);
          setResolving(false);
        }
        if (cachedRole) {
          const allowedCached = (allowSnapshotRef.current ?? allow).includes(cachedRole);
          setOk(allowedCached || true);
          setResolving(false);
        }

        const timeoutMs = 1500;
        const [r1, r2] = (await Promise.all([
          Promise.race([
            supabase.from("user_roles").select("role").eq("user_id", uid!).maybeSingle(),
            new Promise((resolve) => setTimeout(() => resolve({ data: null }), timeoutMs)),
          ]),
          Promise.race([
            supabase.from("users").select("role").eq("id", uid!).maybeSingle(),
            new Promise((resolve) => setTimeout(() => resolve({ data: null }), timeoutMs)),
          ]),
        ])) as any[];
        if (!mounted) return;
        const role: Role | null = (r1?.data?.role as Role | undefined) || (r2?.data?.role as Role | undefined) || null;
        if (!role) return;
        if (cacheKey) {
          try { localStorage.setItem(cacheKey, role); } catch {}
        }

        const allowed = (allowSnapshotRef.current ?? allow).includes(role);
        setOk(allowed);
        if (!allowed) {
          if (role === "ceo") router.replace("/ceo");
          else if (role === "hr") router.replace("/hr");
          else if (role === "staff" || role === "assistant_manager") router.replace("/staff");
          else if (role === "manager") router.replace("/manager");
          else router.replace("/");
        }
        setResolving(false);
      } catch {
        if (!mounted) return;
        setOk(true);
        setResolving(false);
      }
    }
    run();
    return () => { mounted = false; };
  }, [allow]);

  if (ok === null || resolving) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm opacity-70">Loading…</div>
    );
  }
  if (!ok) return null;
  return <>{children}</>;
}
