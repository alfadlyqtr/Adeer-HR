"use client";
import { useState, useEffect } from "react";
import RoleGate from "@/components/RoleGate";
import CEOSnapshot from "@/components/CEOSnapshot";
import CEOBroadcast from "@/components/CEOBroadcast";
import { supabase } from "@/lib/supabaseClient";

/**
 * Dedicated CEO Dashboard with a premium gold-themed UI
 */
export default function CEODashboardPage() {
  const [displayName, setDisplayName] = useState("");
  const [goldMode, setGoldMode] = useState(true);
  const [ceoMsgDraft, setCeoMsgDraft] = useState("");
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "message" | "trends" | "reports">("overview");
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [inout, setInout] = useState<any[]>([]);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [weeklyTrends, setWeeklyTrends] = useState<any[] | null>(null);
  const [latenessHeatmap, setLatenessHeatmap] = useState<any[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSessionUserId(session?.user?.id ?? null);
      
      // derive a friendly name for greeting
      try {
        if (session?.user?.id) {
          const { data: u } = await supabase.from("users").select("full_name, email").eq("id", session.user.id).maybeSingle();
          setDisplayName(u?.full_name || session.user.user_metadata?.full_name || session.user.email || "");
        }
      } catch {}

      await Promise.all([
        refreshOverview(),
        loadWeeklyTrends(),
        loadLatenessHeatmap()
      ]);
    })();
  }, []);

  // Tick every second for live timers
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function loadCeoMessage() {
    const { data } = await supabase.from("company_settings").select("value").eq("key", "ceo_message").maybeSingle();
    setCeoMsgDraft((data?.value as string | undefined) ?? "");
  }

  async function saveCeoMessage() {
    setOkMsg(null); setErr(null);
    const { error } = await supabase.from("company_settings").upsert({ key: "ceo_message", value: ceoMsgDraft }, { onConflict: "key" });
    if (error) setErr(error.message); else setOkMsg("CEO message saved.");
  }

  function fmtDuration(ms: number) {
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const hh = Math.floor(s / 3600).toString().padStart(2, "0");
    const mm = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const ss = Math.floor(s % 60).toString().padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  async function refreshOverview() {
    // v_current_status for everyone (fallback to ordering by user_id to avoid missing column errors)
    const { data } = await supabase
      .from("v_current_status")
      .select("*")
      .order("user_id", { ascending: true });
    setInout(data ?? []);
  }

  async function loadWeeklyTrends() {
    try {
      const { data } = await supabase.from("v_weekly_trends").select("*").limit(14);
      setWeeklyTrends(data ?? []);
    } catch {
      setWeeklyTrends([]);
    }
  }

  async function loadLatenessHeatmap() {
    try {
      const { data } = await supabase.from("v_lateness_heatmap").select("*").limit(500);
      setLatenessHeatmap(data ?? []);
    } catch {
      setLatenessHeatmap([]);
    }
  }
  
  // Quick punch for CEOs
  async function logAttendance(type: "check_in" | "check_out") {
    if (!sessionUserId) return;
    try {
      setErr(null);
      const { error } = await supabase.from("attendance_logs").insert({
        user_id: sessionUserId,
        type,
        ts: new Date().toISOString(),
      });
      if (error) throw error;
      await refreshOverview();
      setOkMsg(type === "check_in" ? "Checked in." : "Checked out.");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to punch");
    }
  }

  return (
    <RoleGate allow={["ceo"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <span className="text-xl">👑</span>
            <span>Welcome, CEO {displayName}</span>
          </h1>
          
          {/* Quick Punch for CEO */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => logAttendance("check_in")}
              className="rounded-md bg-[#D4AF37] px-3 py-1.5 text-black"
            >
              Punch In
            </button>
            <button
              onClick={() => logAttendance("check_out")}
              className="rounded-md bg-rose-600 px-3 py-1.5 text-white"
            >
              Punch Out
            </button>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex gap-2 overflow-x-auto rounded-lg border p-1 text-sm backdrop-blur bg-[#1a1400]/40 border-[#D4AF37]/30" aria-label="Sections">
          <button onClick={() => setTab("overview")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "overview" ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10"}`}>Executive Overview</button>
          <button onClick={() => setTab("message")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "message" ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10"}`}>Broadcast Message</button>
          <button onClick={() => setTab("trends")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "trends" ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10"}`}>Weekly Trends</button>
          <button onClick={() => setTab("reports")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "reports" ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10"}`}>Reports & Heatmaps</button>
        </nav>

        {/* CEO Broadcast display */}
        <section className="rounded-xl border p-4 border-[#D4AF37]/30">
          <CEOBroadcast />
        </section>

        {/* Overview Tab - Executive Snapshot */}
        {tab === "overview" && (
          <section className="rounded-xl border p-4 shadow-md border-[#D4AF37]/30 dark:border-[#D4AF37]/20">
            <div className="flex items-center justify-between">
              <h2 className="mb-2 text-lg font-medium">Executive Snapshot</h2>
              <button onClick={refreshOverview} className="text-xs text-[#D4AF37]">Refresh</button>
            </div>
            <CEOSnapshot />

            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold">Current Staff Status</h3>
              {inout.length === 0 ? <p className="text-sm opacity-70">No data.</p> : (
                <ul className="text-sm">
                  {inout.slice(0, 12).map((r: any) => (
                    <li key={r.user_id} className="flex justify-between border-b py-1 last:border-b-0">
                      <span>{r.user_name ?? r.full_name ?? r.user_id}</span>
                      <span className="opacity-70">
                        {r.status ?? r.last_event ?? "—"}
                        {(() => {
                          const s = (r.status ?? r.last_event ?? "")?.toString().toLowerCase();
                          const onClock = ["present", "working", "checked_in", "in"].includes(s) || (r.last_event === "check_in");
                          if (!onClock) return "";
                          return r.last_ts ? ` · ${fmtDuration(Math.max(0, nowMs - new Date(r.last_ts).getTime()))}` : "";
                        })()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* Message Editor Tab */}
        {tab === "message" && (
          <section className="rounded-lg border p-4 border-[#D4AF37]/40">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium">Company Broadcast</h2>
              <button onClick={loadCeoMessage} className="text-xs text-[#D4AF37]">Load current</button>
            </div>
            <p className="mb-2 text-sm opacity-80">Write a message to appear on the home page and on everyone's overview.</p>
            <textarea
              value={ceoMsgDraft}
              onChange={(e) => setCeoMsgDraft(e.target.value)}
              placeholder="Type your message to all staff..."
              className="min-h-[140px] w-full rounded-md border p-3"
            />
            <div className="mt-3 flex items-center gap-2">
              <button onClick={saveCeoMessage} className="rounded-md px-4 py-2 bg-[#D4AF37] text-black">Save Broadcast</button>
              {okMsg && <span className="text-sm text-emerald-600">{okMsg}</span>}
              {err && <span className="text-sm text-rose-600">{err}</span>}
            </div>
            <div className="mt-4">
              <h3 className="mb-1 text-sm font-semibold">Preview</h3>
              <CEOBroadcast />
            </div>
          </section>
        )}

        {/* Weekly Trends */}
        {tab === "trends" && (
          <section className="rounded-xl border p-4 shadow-md border-[#D4AF37]/30">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-medium">Weekly Trends</h2>
              <button onClick={loadWeeklyTrends} className="text-xs text-[#D4AF37]">Refresh</button>
            </div>
            {!weeklyTrends || weeklyTrends.length === 0 ? (
              <p className="text-sm opacity-70">No trend data.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {weeklyTrends.map((r:any,i:number)=>{
                  const pct = Math.max(0, Math.min(100, Math.round(Number(r.attendance_pct ?? r.pct ?? 0))));
                  const label = r.label ?? r.day ?? r.week ?? `Week ${i+1}`;
                  return (
                    <li key={i} className="grid grid-cols-5 items-center gap-2">
                      <span className="col-span-2 truncate font-medium">{label}</span>
                      <div className="col-span-2 h-3 rounded bg-black/10 dark:bg-white/10 overflow-hidden">
                        <div className="h-full bg-[#D4AF37]" style={{width: pct + '%'}} />
                      </div>
                      <span className="text-right">{pct}%</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* Reports and Heatmaps */}
        {tab === "reports" && (
          <section className="rounded-lg border p-4 border-[#D4AF37]/40">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-medium">Heatmaps — Lateness & Overtime</h2>
              <button onClick={loadLatenessHeatmap} className="text-xs text-[#D4AF37]">Refresh</button>
            </div>
            {!latenessHeatmap || latenessHeatmap.length === 0 ? (
              <p className="text-sm opacity-70">No heatmap data.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-[#D4AF37]/20">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#D4AF37]/10">
                    <tr className="border-b border-[#D4AF37]/20">
                      {Object.keys(latenessHeatmap[0]).map((k)=> (
                        <th key={k} className="py-2 px-2">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {latenessHeatmap.map((row, i) => (
                      <tr key={i} className="border-b last:border-b-0 border-[#D4AF37]/10">
                        {Object.values(row).map((v:any,j)=> {
                          // Color-code numeric cells
                          const isNumeric = !isNaN(Number(v));
                          const intensity = isNumeric ? Math.min(100, Math.max(0, Number(v))) / 100 : 0;
                          
                          return (
                            <td 
                              key={j} 
                              className="py-1 px-2" 
                              style={isNumeric ? {backgroundColor: `rgba(212,175,55,${intensity*0.3})`} : {}}
                            >
                              {String(v)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6">
              <h3 className="mb-3 text-lg font-medium">CEO Briefing Export</h3>
              <div className="flex gap-3">
                <button 
                  className="flex items-center gap-2 rounded-md border border-[#D4AF37] bg-[#D4AF37]/10 px-3 py-2 text-[#D4AF37] transition hover:bg-[#D4AF37]/20"
                  onClick={() => alert('PDF export would generate here')}
                >
                  <span className="text-lg">📊</span> Export as PDF
                </button>
                <button 
                  className="flex items-center gap-2 rounded-md border border-[#D4AF37] bg-[#D4AF37]/10 px-3 py-2 text-[#D4AF37] transition hover:bg-[#D4AF37]/20"
                  onClick={() => alert('Excel export would generate here')}
                >
                  <span className="text-lg">📈</span> Export as Excel
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </RoleGate>
  );
}
