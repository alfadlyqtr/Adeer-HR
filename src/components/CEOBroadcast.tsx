"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * CEOBroadcast
 * - Read-only broadcast of the CEO message stored in company_settings.key = 'ceo_message'.
 * - Designed to be embedded in Home, Staff Overview, and HR Overview pages.
 */
export default function CEOBroadcast({ className = "" }: { className?: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("company_settings")
        .select("key,value")
        .eq("key", "ceo_message")
        .maybeSingle();
      if (!mounted) return;
      if (error) {
        setMessage(null);
      } else {
        setMessage((data?.value as string | undefined) ?? null);
      }
      setLoading(false);
    }
    load();
    // refresh on auth changes as well (helps when CEO updates from HR page)
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  if (loading) return null;
  if (!message) return null;

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm ${className} bg-white/95 dark:bg-[#0b0b0b]/80 border-[#D4AF37]/30`}
         style={{ boxShadow: "0 0 24px rgba(212,175,55,0.25)" }}>
      <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[#D4AF37]/20 blur-3xl" />
      <div className="flex items-center gap-2">
        <span className="text-2xl">🏆</span>
        <h3 className="text-lg font-semibold text-[#D4AF37]">CEO Message</h3>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{message}</p>
    </div>
  );
}
