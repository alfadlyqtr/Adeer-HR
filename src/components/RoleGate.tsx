"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Role = "staff" | "assistant_manager" | "manager" | "hr" | "ceo";

export default function RoleGate({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    async function run() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase.from("users").select("role").eq("id", session.user.id).maybeSingle();
      const role = (data?.role ?? "staff") as Role;
      if (!mounted) return;
      setOk(allow.includes(role));
      if (!allow.includes(role)) {
        // basic fallback routing
        if (role === "staff" || role === "assistant_manager") router.replace("/staff");
        else if (role === "manager") router.replace("/manager");
        else router.replace("/");
      }
    }
    run();
    return () => { mounted = false; };
  }, [allow, router]);

  if (ok === null) return null;
  if (!ok) return null;
  return <>{children}</>;
}
