"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Snapshot = {
  staff_total: number;
  on_leave_today: number;
  present_today: number;
  checked_out_today: number;
};

export default function CEOSnapshot() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase.from("v_ceo_snapshot").select("*").maybeSingle();
      if (!mounted) return;
      if (error) {
        setData(null);
      } else if (data) {
        setData(data as Snapshot);
      }
      setLoading(false);
    }
    load();
    // refresh on sign-in/out
    const { data: authSub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      mounted = false;
      authSub.subscription.unsubscribe();
    };
  }, []);

  if (loading) return <div className="text-sm text-gray-500">Loading executive snapshot…</div>;
  if (!data) return <div className="text-sm text-red-600">Failed to load executive snapshot.</div>;

  const cards = [
    { label: "Total Staff", value: data.staff_total },
    { label: "On Leave Today", value: data.on_leave_today },
    { label: "Present Today", value: data.present_today },
    { label: "Checked Out Today", value: data.checked_out_today },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border bg-white p-4 dark:bg-[#0b0b0b]">
          <div className="text-xs text-gray-500 dark:text-gray-400">{c.label}</div>
          <div className="mt-1 text-2xl font-semibold">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
