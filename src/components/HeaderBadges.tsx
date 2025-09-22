"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Crown } from "lucide-react";

export default function HeaderBadges() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        if (mounted) setRole(null);
        return;
      }
      const { data, error } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!mounted) return;
      if (error) {
        setRole(null);
      } else {
        setRole(data?.role ?? null);
      }
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!role) return null;

  if (role === "ceo") {
    return (
      <div className="badge-ceo badge-ceo-light dark:badge-ceo-dark" title="CEO Mode">
        <Crown size={14} />
        <span>CEO Mode</span>
      </div>
    );
  }

  const label = role === "hr" ? "HR" : role === "manager" ? "Manager" : role === "assistant_manager" ? "Assistant Manager" : "Staff";
  return (
    <span className="inline-flex items-center rounded-full border border-brand-primary/30 bg-brand-primary/10 px-2 py-0.5 text-xs font-medium text-brand-primary">
      {label}
    </span>
  );
}
