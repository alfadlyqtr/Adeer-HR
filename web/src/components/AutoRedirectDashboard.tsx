"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AutoRedirectDashboard() {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active || !session) return;
      const { data } = await supabase.from("users").select("role").eq("id", session.user.id).maybeSingle();
      if (!active) return;
      const role = data?.role as string | undefined;
      if (role === "hr" || role === "ceo") router.replace("/hr");
      else if (role === "manager" || role === "assistant_manager") router.replace("/manager");
      else if (role === "staff") router.replace("/staff");
    })();
    return () => { active = false; };
  }, [router]);
  return null;
}
