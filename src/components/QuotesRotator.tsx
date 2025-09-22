"use client";
import { useEffect, useMemo, useState } from "react";

export default function QuotesRotator({
  quotes,
  initialIndex = 0,
  showRefresh = true,
}: {
  quotes: string[];
  initialIndex?: number;
  showRefresh?: boolean;
}) {
  const cleaned = useMemo(
    () => quotes.map((q) => q.trim()).filter((q) => q.length > 0),
    [quotes]
  );
  const [index, setIndex] = useState(() => (cleaned.length ? initialIndex % cleaned.length : 0));
  const [prevIndex, setPrevIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!cleaned.length) return;
    const id = setInterval(() => {
      setPrevIndex((i) => (i === null ? index : (index)));
      setIndex((i) => (i + 1) % cleaned.length);
      // clear prev after animation ends
      const t = setTimeout(() => setPrevIndex(null), 320);
      return () => clearTimeout(t);
    }, 60_000); // rotate every 60s
    return () => clearInterval(id);
  }, [cleaned.length, index]);

  if (!cleaned.length) return null;
  return (
    <div className="relative group tilt-card">
      {showRefresh && (
        <button
          type="button"
          aria-label="Refresh quote"
          onClick={() => {
            if (!cleaned.length) return;
            let next = Math.floor(Math.random() * cleaned.length);
            if (next === index) next = (next + 1) % cleaned.length;
            setPrevIndex(index);
            setIndex(next);
            // clear prev after animation
            window.setTimeout(() => setPrevIndex(null), 320);
          }}
          className="absolute right-3 top-3 z-10 rounded-full border border-black/5 bg-white/80 p-2 text-xs shadow-sm backdrop-blur transition hover:scale-105 hover:bg-white dark:border-white/10 dark:bg-black/50"
        >
          ↻
        </button>
      )}

      <figure className="relative mx-auto min-h-[64px] max-w-3xl transform-gpu text-center">
        {prevIndex !== null && (
          <blockquote className="quote-exit absolute inset-0 text-lg italic text-gray-700 dark:text-gray-200">
            “{cleaned[prevIndex]}”
          </blockquote>
        )}
        <blockquote key={index} className="quote-enter animate-float text-lg italic text-gray-700 dark:text-gray-200">
          “{cleaned[index]}”
        </blockquote>
      </figure>
    </div>
  );
}
