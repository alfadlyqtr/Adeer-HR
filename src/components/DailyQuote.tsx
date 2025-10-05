"use client";
import { useEffect, useRef, useState } from "react";
import QuotesRotator from "./QuotesRotator";

// Module-scoped singleton cache to prevent thrash in StrictMode and across re-mounts
let QUOTES_CACHE: { quotes: string[]; ts: number } | null = null;
let QUOTES_INFLIGHT: Promise<string[] | null> | null = null;
const QUOTES_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Daily Quote component - loads quotes from server and displays rotating quotes
 */
export default function DailyQuote() {
  const [quotes, setQuotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    async function loadQuotes() {
      try {
        // 1) Try localStorage cache
        try {
          const k = localStorage.getItem('daily_quotes_cache');
          if (k) {
            const parsed = JSON.parse(k) as { quotes: string[]; ts: number };
            if (parsed?.quotes?.length && Date.now() - parsed.ts < QUOTES_TTL_MS) {
              setQuotes(parsed.quotes);
              setLoading(false);
              // do not return; continue to also hydrate module cache
              QUOTES_CACHE = parsed;
            }
          }
        } catch {}

        // 2) Use module cache if fresh
        if (QUOTES_CACHE && Date.now() - QUOTES_CACHE.ts < QUOTES_TTL_MS) {
          setQuotes((prev) => prev.length ? prev : QUOTES_CACHE!.quotes);
          setLoading(false);
          return;
        }

        // 3) Coalesce network fetches
        if (!QUOTES_INFLIGHT) {
          QUOTES_INFLIGHT = fetch('/api/quotes')
            .then((res) => (res.ok ? res.json() : { quotes: [] }))
            .then((data) => Array.isArray(data.quotes) ? data.quotes as string[] : [])
            .catch(() => [])
            .finally(() => { setTimeout(() => { QUOTES_INFLIGHT = null; }, 0); }) as Promise<string[] | null>;
        }
        const got = await QUOTES_INFLIGHT;
        if (!mountedRef.current) return;
        const arr = got || [];
        if (arr.length) {
          QUOTES_CACHE = { quotes: arr, ts: Date.now() };
          try { localStorage.setItem('daily_quotes_cache', JSON.stringify(QUOTES_CACHE)); } catch {}
        }
        setQuotes(arr);
      } catch (e) {
        console.warn("Failed to load quotes", e);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }
    loadQuotes();
    return () => { mountedRef.current = false; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-brand-light/10 via-purple-50/50 to-white/50 p-4 shadow-sm dark:from-brand-darkPurple/10 dark:via-purple-950/30 dark:to-black/20">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">💡</span>
          <h3 className="text-sm font-semibold">Daily Inspiration</h3>
        </div>
        <div className="text-sm opacity-70">Loading...</div>
      </div>
    );
  }

  if (!quotes.length) {
    return null;
  }

  const initialIndex = Math.abs(new Date().getUTCMinutes()) % quotes.length;

  return (
    <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-purple-50 via-blue-50 to-white p-4 shadow-md dark:border-white/10 dark:from-brand-darkPurple/10 dark:via-purple-950/30 dark:to-black/20">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">💡</span>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Daily Inspiration</h3>
      </div>
      <QuotesRotator quotes={quotes} initialIndex={initialIndex} showRefresh={true} />
    </div>
  );
}
