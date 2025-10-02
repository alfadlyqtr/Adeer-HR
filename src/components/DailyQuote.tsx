"use client";
import { useEffect, useState } from "react";
import QuotesRotator from "./QuotesRotator";

/**
 * Daily Quote component - loads quotes from server and displays rotating quotes
 */
export default function DailyQuote() {
  const [quotes, setQuotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadQuotes() {
      try {
        const res = await fetch('/api/quotes');
        if (res.ok) {
          const data = await res.json();
          setQuotes(data.quotes || []);
        }
      } catch (e) {
        console.warn("Failed to load quotes", e);
      } finally {
        setLoading(false);
      }
    }
    loadQuotes();
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
