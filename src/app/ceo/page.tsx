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
  const [ceoMsgDraft, setCeoMsgDraft] = useState("");
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "message" | "trends" | "reports">("overview");
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [inout, setInout] = useState<any[]>([]);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [weeklyTrends, setWeeklyTrends] = useState<any[] | null>(null);
  const [latenessHeatmap, setLatenessHeatmap] = useState<any[] | null>(null);
  const [saving, setSaving] = useState(false);

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

      // Initial load for the default tab
      await refreshOverview();
    })();
  }, []);

  // Tick every second for live timers
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch data when tab changes
  useEffect(() => {
    if (tab === "trends") loadWeeklyTrends();
    if (tab === "reports") loadLatenessHeatmap();
    if (tab === "overview") refreshOverview();
  }, [tab]);

  async function loadCeoMessage() {
    const { data } = await supabase.from("broadcast_messages").select("message").order("created_at", { ascending: false }).limit(1).single();
    setCeoMsgDraft(data?.message ?? "");
  }

  async function saveCeoMessage() {
    setOkMsg(null);
    setErr(null);
    setSaving(true);
    try {
      // Ensure we have a fresh session/user id
      let { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      if (!session || sessionErr) {
        const ref = await supabase.auth.refreshSession();
        session = ref.data.session;
      }
      const uid = session?.user?.id || sessionUserId;
      if (!uid) throw new Error("You must be logged in to send a broadcast.");
      const { error } = await supabase.from("broadcast_messages").insert({ message: ceoMsgDraft, sender_id: uid });
      if (error) throw error;
      setOkMsg("CEO message saved.");
      // Update local cache so CEOBroadcast paints instantly in this tab
      try { if (ceoMsgDraft) localStorage.setItem("ceo_broadcast_last", ceoMsgDraft); } catch {}
      // Hint other components in this tab to refresh (fallback alongside realtime)
      const event = new CustomEvent('broadcast-refresh');
      window.dispatchEvent(event);
    } catch (error: any) {
      setErr(error?.message || 'Failed to save broadcast');
    } finally {
      setSaving(false);
    }
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

  const activeTabClass = "bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary shadow-[0_0_12px_theme(colors.brand.primary/0.5)]";
  const inactiveTabClass = "opacity-70 hover:opacity-100 hover:text-brand-primary hover:bg-brand-primary/10";

  return (
    <RoleGate allow={["ceo"]}>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <span className="text-xl text-brand-primary">👑</span>
            <span>Welcome, CEO {displayName}</span>
          </h1>
          
          <div className="flex items-center gap-2">
            <button onClick={() => logAttendance("check_in")} className="rounded-md bg-emerald-500 px-3 py-1.5 text-white transition hover:scale-105 hover:shadow-lg">Punch In</button>
            <button onClick={() => logAttendance("check_out")} className="rounded-md bg-rose-500 px-3 py-1.5 text-white transition hover:scale-105 hover:shadow-lg">Punch Out</button>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex gap-2 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1 text-sm backdrop-blur-md" aria-label="Sections">
          <button onClick={() => setTab("overview")} className={`rounded-lg px-3 py-1.5 transition-all duration-200 ${tab === "overview" ? activeTabClass : inactiveTabClass}`}>Executive Overview</button>
          <button onClick={() => setTab("message")} className={`rounded-lg px-3 py-1.5 transition-all duration-200 ${tab === "message" ? activeTabClass : inactiveTabClass}`}>Broadcast Message</button>
          <button onClick={() => setTab("trends")} className={`rounded-lg px-3 py-1.5 transition-all duration-200 ${tab === "trends" ? activeTabClass : inactiveTabClass}`}>Weekly Trends</button>
          <button onClick={() => setTab("reports")} className={`rounded-lg px-3 py-1.5 transition-all duration-200 ${tab === "reports" ? activeTabClass : inactiveTabClass}`}>Reports & Heatmaps</button>
        </nav>

        {/* CEO Broadcast display — only on Overview */}
        {tab === "overview" && (
          <section className="rounded-xl border border-brand-primary/20 bg-white/5 p-4 shadow-lg">
            <CEOBroadcast />
          </section>
        )}

        {/* Overview Tab - Executive Snapshot */}
        {tab === "overview" && (
          <section className="rounded-xl border border-brand-primary/20 bg-white/5 p-4 shadow-lg transition-all hover:shadow-brand-primary/20 hover:scale-[1.01]">
            <div className="flex items-center justify-between">
              <h2 className="mb-2 text-lg font-medium">Executive Snapshot</h2>
              <button onClick={refreshOverview} className="text-xs text-brand-primary">Refresh</button>
            </div>
            <CEOSnapshot />

            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold">Current Staff Status</h3>
              {inout.length === 0 ? <p className="text-sm opacity-70">No data.</p> : (
                <ul className="text-sm">
                  {inout.slice(0, 12).map((r: any) => {
                    const s = (r.status ?? r.last_event ?? "")?.toString().toLowerCase();
                    const onClock = ["present", "working", "checked_in", "in"].includes(s) || (r.last_event === "check_in");
                    const statusColor = onClock ? "text-emerald-400" : "text-rose-400";
                    const nameColor = onClock ? "text-emerald-300 drop-shadow-[0_0_6px_rgba(16,185,129,0.45)]" : "text-rose-300 drop-shadow-[0_0_6px_rgba(244,63,94,0.45)]";
                    const timerText = onClock && r.last_ts ? ` · ${fmtDuration(Math.max(0, nowMs - new Date(r.last_ts).getTime()))}` : "";

                    return (
                      <li
                        key={r.user_id}
                        className="flex justify-between items-center py-1.5"
                        title={onClock ? "Currently on the clock" : "Not punched in"}
                      >
                        <span className={nameColor}>{r.user_name ?? r.full_name ?? r.user_id}</span>
                        <span className={`opacity-90 ${statusColor}`}>
                          {(r.status ?? r.last_event ?? "—") + timerText}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* Message Editor Tab */}
        {tab === "message" && (
          <section className="rounded-xl border border-brand-primary/20 bg-white/5 p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium">Company Broadcast</h2>
              <button onClick={loadCeoMessage} className="text-xs text-brand-primary">Load current</button>
            </div>
            <p className="mb-2 text-sm opacity-80">Write a message to appear on the home page and on everyone's overview.</p>
            <textarea
              value={ceoMsgDraft}
              onChange={(e) => setCeoMsgDraft(e.target.value)}
              placeholder="Type your message to all staff..."
              className="min-h-[140px] w-full rounded-lg border border-white/10 bg-white/5 p-3 focus:border-brand-primary focus:ring-brand-primary"
            />
            <div className="mt-3 flex items-center gap-2">
              <button onClick={saveCeoMessage} disabled={saving || !ceoMsgDraft.trim()} className="rounded-md bg-brand-primary px-4 py-2 text-white transition hover:scale-105 disabled:opacity-60">{saving ? 'Saving…' : 'Save Broadcast'}</button>
              {okMsg && <span className="text-sm text-emerald-500">{okMsg}</span>}
              {err && <span className="text-sm text-rose-500">{err}</span>}
            </div>
            <div className="mt-4">
              <h3 className="mb-1 text-sm font-semibold">Preview</h3>
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏆</span>
                  <h4 className="text-base font-semibold">CEO Message</h4>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed opacity-80">{ceoMsgDraft || "(empty)"}</p>
              </div>
            </div>
          </section>
        )}

        {/* Weekly Trends */}
        {tab === "trends" && (
          <section className="rounded-xl border border-brand-primary/20 bg-white/5 p-4 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-medium">Weekly Trends</h2>
              <button onClick={loadWeeklyTrends} className="text-xs text-brand-primary">Refresh</button>
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
                      <div className="col-span-2 h-3 rounded bg-white/10 overflow-hidden">
                        <div className="h-full bg-brand-primary" style={{width: pct + '%'}} />
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
          <section className="rounded-xl border border-brand-primary/20 bg-white/5 p-4 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-medium">Heatmaps — Lateness & Overtime</h2>
              <button onClick={loadLatenessHeatmap} className="text-xs text-brand-primary">Refresh</button>
            </div>
            {!latenessHeatmap || latenessHeatmap.length === 0 ? (
              <p className="text-sm opacity-70">No heatmap data.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5">
                    <tr className="border-b border-white/10">
                      {Object.keys(latenessHeatmap[0]).map((k)=> (
                        <th key={k} className="py-2 px-2 font-semibold">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {latenessHeatmap.map((row, i) => (
                      <tr key={i} className="border-b last:border-b-0 border-white/10">
                        {Object.values(row).map((v:any,j)=> {
                          const isNumeric = !isNaN(Number(v));
                          const intensity = isNumeric ? Math.min(100, Math.max(0, Number(v))) / 100 : 0;
                          return (
                            <td 
                              key={j} 
                              className="py-1.5 px-2"
                              style={isNumeric ? {backgroundColor: `rgba(77,107,241,${intensity*0.3})`} : {}}
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
                <button className="flex items-center gap-2 rounded-md border border-brand-primary bg-brand-primary/10 px-3 py-2 text-brand-primary transition hover:bg-brand-primary/20">
                  <span className="text-lg">📊</span> Export as PDF
                </button>
                <button className="flex items-center gap-2 rounded-md border border-brand-primary bg-brand-primary/10 px-3 py-2 text-brand-primary transition hover:bg-brand-primary/20">
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
