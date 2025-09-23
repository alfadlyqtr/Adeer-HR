"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      router.replace("/login");
    } catch (e) {
      // no-op; optional toast could go here
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="rounded-md border border-black/10 bg-white/70 px-3 py-1.5 text-sm hover:bg-white disabled:opacity-50 dark:border-white/10 dark:bg-black/40 dark:hover:bg-black/50"
      title="Sign out"
    >
      {loading ? "Signing out…" : "Logout"}
    </button>
  );
}
