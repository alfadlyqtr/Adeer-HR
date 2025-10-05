"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * CEOBroadcast
 * - Read-only broadcast of the CEO message stored in company_settings.key = 'ceo_message'.
 * - Designed to be embedded in Home, Staff Overview, and HR Overview pages.
 */
export default function CEOBroadcast({ className = "" }: { className?: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reloadingRef = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    mountedRef.current = true;

    async function load() {
      if (!mountedRef.current) return;
      // Avoid overlapping loads
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      // Only show spinner if there is no message yet
      if (!message) setLoading(true);
      const safety = setTimeout(() => { if (mountedRef.current) setLoading(false); }, 3000);
      try {
        const { data, error } = await supabase
          .from("broadcast_messages")
          .select("message")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!mountedRef.current) return;
        if (error) {
          setMessage((prev) => prev ?? null);
        } else {
          setMessage(data?.message ?? null);
          // cache last message to speed up first paint next time
          try { if (data?.message) localStorage.setItem("ceo_broadcast_last", data.message); } catch {}
        }
      } catch (e) {
        // leave any existing message in place
      } finally {
        clearTimeout(safety);
        if (mountedRef.current) setLoading(false);
        reloadingRef.current = false;
      }
    }

    // Instant paint with cached value if available
    try {
      const cached = localStorage.getItem("ceo_broadcast_last");
      if (cached) { setMessage(cached); setLoading(false); }
    } catch {}

    // Kick off network load immediately
    load();

    // Realtime for INSERT/UPDATE/DELETE (guard for StrictMode double effects)
    if (!channelRef.current) {
      channelRef.current = supabase
        .channel('ceo-broadcast-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_messages' }, (payload) => {
          const next = (payload.new as any)?.message ?? null;
          // Debounce UI updates to reduce flicker
          if (debounceTimer.current) clearTimeout(debounceTimer.current);
          debounceTimer.current = setTimeout(() => {
            if (!mountedRef.current) return;
            if (typeof next === 'string') {
              setMessage(next);
              try { localStorage.setItem("ceo_broadcast_last", next); } catch {}
              setLoading(false);
            } else {
              load();
            }
          }, 250);
        })
        .subscribe();
    }

    // Auth changes can re-mount pages in dev; debounce to avoid thrash
    const { data: authSub } = supabase.auth.onAuthStateChange(() => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(load, 250);
    });

    // Listen for manual refresh events from editors (fallback when realtime is blocked)
    const onManual = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(load, 150);
      // extra safety: refresh again after 2s
      setTimeout(load, 2000);
    };
    if (typeof window !== 'undefined') window.addEventListener('broadcast-refresh', onManual);

    return () => {
      mounted = false;
      mountedRef.current = false;
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
      authSub.subscription.unsubscribe();
      if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null; }
      if (typeof window !== 'undefined') window.removeEventListener('broadcast-refresh', onManual);
    };
  }, []);

  // Always render the container so layout is stable
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm ${className} bg-white/95 dark:bg-[#0b0b0b]/80 ${message ? 'border-[#D4AF37]/30' : 'border-gray-200 dark:border-gray-800'}`}
         style={message ? { boxShadow: "0 0 24px rgba(212,175,55,0.25)" } : undefined}>
      {message && <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[#D4AF37]/20 blur-3xl" />}
      <div className="flex items-center gap-2">
        <span className="text-2xl">🏆</span>
        <h3 className={`text-lg font-semibold ${message ? 'text-[#D4AF37]' : 'text-gray-500'}`}>CEO Message</h3>
      </div>
      {loading ? (
        <p className="mt-2 text-[15px] leading-relaxed text-gray-400">Loading…</p>
      ) : message ? (
        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{message}</p>
      ) : (
        <p className="mt-2 text-[15px] leading-relaxed text-gray-400 italic">No broadcast message at this time.</p>
      )}
    </div>
  );
}
