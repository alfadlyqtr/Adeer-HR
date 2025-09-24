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
      
      // Use our dedicated signout page which handles cleanup properly
      if (typeof window !== 'undefined') {
        // Force clear tokens locally first
        window.localStorage.removeItem('supabase.auth.token');
        window.sessionStorage.removeItem('supabase.auth.token');
        
        // Hard navigation to dedicated signout page
        window.location.href = '/signout';
      } else {
        // Fallback for SSR context
        await supabase.auth.signOut();
        router.replace('/login?signout=true');
      }
    } catch (e) {
      console.error('Logout error:', e);
      // Force redirect to login even on error
      if (typeof window !== 'undefined') {
        window.location.href = '/login?signout=error';
      }
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      aria-busy={loading}
      className="rounded-md border border-black/10 bg-white/70 px-3 py-1.5 text-sm hover:bg-white disabled:opacity-50 dark:border-white/10 dark:bg-black/40 dark:hover:bg-black/50"
      title="Sign out"
    >
      {loading ? "Signing out…" : "Logout"}
    </button>
  );
}
