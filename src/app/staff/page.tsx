"use client";
import RoleGate from "@/components/RoleGate";
import DailyQuote from "@/components/DailyQuote";
import SettingsButton from "@/components/SettingsButton";
import CEOBroadcast from "@/components/CEOBroadcast";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type LogType = "check_in" | "check_out" | "break_start" | "break_end";

function startOfTodayLocalISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function fmtDuration(ms: number) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600).toString().padStart(2, "0");
  const mm = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function StaffDashboard() {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [punchLoading, setPunchLoading] = useState(false);
  const [breakActive, setBreakActive] = useState(false);
  const [breakRules, setBreakRules] = useState<Array<{ name: string; minutes: number }>>([]);
  const [selectedBreak, setSelectedBreak] = useState<string>("");
  const [currentBreakType, setCurrentBreakType] = useState<string | null>(null);
  const [leaveForm, setLeaveForm] = useState({ type: "annual", start_date: "", end_date: "" });
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lon: number } | null>(null);
  const [pendingQueue, setPendingQueue] = useState<any[]>([]);
  const [now, setNow] = useState<number>(Date.now());

  // Load session and initial data
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active || !session) return;
      setSessionUserId(session.user.id);
      await Promise.all([
        refreshTimeline(session.user.id),
        refreshSummary(session.user.id),
        refreshFiles(session.user.id),
        loadBreakRules(),
      ]);
    })();
    return () => { active = false; };
  }, []);

  async function loadBreakRules() {
    try {
      const { data } = await supabase.from('break_rules').select('name, minutes').order('name');
      setBreakRules((data as any[]) || []);
      if ((data?.length || 0) && !selectedBreak) setSelectedBreak(data![0].name);
    } catch {}
  }

  // Tick every second for live timers
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Try to get geolocation once (non-blocking)
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 5000 }
    );
  }, []);

  async function logAttendance(type: LogType) {
    if (!sessionUserId) return;
    try {
      setErr(null);
      setPunchLoading(true);
      const payloadBase: any = { user_id: sessionUserId, type, ts: new Date().toISOString() };
      const payloadWithGeo: any = geo ? { ...payloadBase, lat: geo.lat, lon: geo.lon } : payloadBase;

      // Try insert with geo if available; if it fails due to unknown column, retry without geo.
      let { error } = await supabase.from("attendance_logs").insert(payloadWithGeo);
      if (error) {
        const msg = String(error.message || "");
        if (/column .* (lat|lon)/i.test(msg)) {
          const retry = await supabase.from("attendance_logs").insert(payloadBase);
          if (retry.error) throw retry.error;
        } else {
          // network or other issue: queue locally for later
          queueOffline(payloadWithGeo);
          throw new Error("Offline: queued punch");
        }
      }
      if (type === "break_start") setBreakActive(true);
      if (type === "break_end") setBreakActive(false);
      await refreshTimeline(sessionUserId);
      await refreshSummary(sessionUserId);
      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (type === "check_in") setConfirmMsg(`You're checked in at ${timeStr}`);
      if (type === "check_out") setConfirmMsg(`You're checked out at ${timeStr}`);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to log attendance");
    } finally {
      setPunchLoading(false);
    }
  }

  async function startBreak() {
    if (!sessionUserId || !selectedBreak) return;
    try {
      setErr(null); setPunchLoading(true);
      const base: any = { user_id: sessionUserId, type: 'break_start', ts: new Date().toISOString() };
      // Try include break_name; if column missing, retry encoding in type
      let { error } = await supabase.from('attendance_logs').insert({ ...base, break_name: selectedBreak });
      if (error) {
        const msg = String(error.message || '');
        if (/column .*break_name/i.test(msg)) {
          const retry = await supabase.from('attendance_logs').insert({ ...base, type: `break_start:${selectedBreak}` });
          if (retry.error) throw retry.error;
        } else {
          throw error;
        }
      }
      setBreakActive(true);
      setCurrentBreakType(selectedBreak);
      await refreshTimeline(sessionUserId);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to start break');
    } finally {
      setPunchLoading(false);
    }
  }

  async function endBreak() {
    if (!sessionUserId) return;
    try {
      setErr(null); setPunchLoading(true);
      const base: any = { user_id: sessionUserId, type: 'break_end', ts: new Date().toISOString() };
      let { error } = await supabase.from('attendance_logs').insert(base);
      if (error) throw error;
      setBreakActive(false);
      await refreshTimeline(sessionUserId);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to end break');
    } finally { setPunchLoading(false); }
  }

  function queueOffline(record: any) {
    try {
      const key = 'adeerhr-offline-attendance-queue';
      const cur = JSON.parse(localStorage.getItem(key) || '[]');
      cur.push(record);
      localStorage.setItem(key, JSON.stringify(cur));
      setPendingQueue(cur);
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'REQUEST_FLUSH' });
      }
    } catch {}
  }

  async function flushOfflineQueue() {
    const key = 'adeerhr-offline-attendance-queue';
    const cur = JSON.parse(localStorage.getItem(key) || '[]');
    if (!cur.length) return;
    const ok: any[] = [];
    for (const rec of cur) {
      const { error } = await supabase.from('attendance_logs').insert(rec);
      if (!error) ok.push(rec);
    }
    if (ok.length) {
      const rest = cur.filter((r: any) => !ok.includes(r));
      localStorage.setItem(key, JSON.stringify(rest));
      setPendingQueue(rest);
      if (sessionUserId) {
        await refreshTimeline(sessionUserId);
        await refreshSummary(sessionUserId);
      }
    }
  }

  useEffect(() => {
    const onOnline = () => flushOfflineQueue();
    window.addEventListener('online', onOnline);
    navigator.serviceWorker?.addEventListener('message', (e: MessageEvent) => {
      if (e.data?.type === 'FLUSH_ATTENDANCE_QUEUE') flushOfflineQueue();
    });
    flushOfflineQueue();
    return () => {
      window.removeEventListener('online', onOnline);
    };
  }, [sessionUserId]);

  async function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionUserId) return;
    try {
      setErr(null);
      setLeaveSubmitting(true);
      const { error } = await supabase.from("leave_requests").insert({
        user_id: sessionUserId,
        type: leaveForm.type,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        status: "pending",
      });
      if (error) throw error;
      setLeaveForm({ type: "annual", start_date: "", end_date: "" });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to submit leave request");
    } finally {
      setLeaveSubmitting(false);
    }
  }

  async function refreshTimeline(userId: string) {
    const { data, error } = await supabase
      .from("attendance_logs")
      .select("ts,type,break_name")
      .eq("user_id", userId)
      .gte("ts", startOfTodayLocalISO())
      .order("ts", { ascending: true });
    if (error) { setErr(error.message); return; }
    setTimeline(data ?? []);
    // Derive break active state from latest break event today
    const lastBreak = (data ?? []).filter((r: any) => String(r.type||'').startsWith("break_")).at(-1);
    const lbType = String(lastBreak?.type || '');
    const parsed = lbType.startsWith('break_start:') ? lbType.split(':')[1] : (lastBreak?.break_name || null);
    setBreakActive(lbType.startsWith("break_start"));
    setCurrentBreakType(lbType.startsWith("break_start") ? (parsed || currentBreakType) : null);
  }

  async function refreshSummary(userId: string) {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    const { data } = await supabase
      .from("v_staff_monthly_summary")
      .select("*")
      .eq("user_id", userId)
      .eq("month", month)
      .maybeSingle();
    setSummary(data ?? null);
  }

  async function refreshFiles(userId: string) {
    // Select only stable columns to avoid schema mismatch errors
    const { data, error } = await supabase
      .from("staff_files")
      .select("id, category, expiry_date")
      .eq("user_id", userId)
      .order("expiry_date", { ascending: true });
    if (error) { setErr(error.message); return; }
    setFiles(data ?? []);
  }

  const streak = useMemo(() => {
    const hasTodayCheckIn = timeline.some((t) => t.type === "check_in");
    return hasTodayCheckIn ? 1 : 0;
  }, [timeline]);

  // Compute live timer label
  const liveLabel = useMemo(() => {
    if (!timeline.length) return null;
    const lastCheckIn = [...timeline].reverse().find((t) => t.type === "check_in");
    const lastCheckOut = [...timeline].reverse().find((t) => t.type === "check_out");
    const lastBreakStart = [...timeline].reverse().find((t) => t.type === "break_start");
    const lastBreakEnd = [...timeline].reverse().find((t) => t.type === "break_end");

    const nowMs = now;

    if (breakActive && lastBreakStart) {
      const since = new Date(lastBreakStart.ts).getTime();
      const name = currentBreakType ? ` (${currentBreakType})` : '';
      return `On break${name} for ${fmtDuration(nowMs - since)}`;
    }

    if (lastCheckIn && (!lastCheckOut || new Date(lastCheckIn.ts) > new Date(lastCheckOut.ts))) {
      const since = new Date(lastCheckIn.ts).getTime();
      return `Working for ${fmtDuration(nowMs - since)}`;
    }

    return null;
  }, [timeline, breakActive, now]);

  return (
    <RoleGate allow={["staff", "assistant_manager", "manager"]}>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Welcome Staff Dashboard</h1>
          <SettingsButton />
        </div>
        
        {/* Daily Quote */}
        <DailyQuote />

        {/* CEO message (broadcast) */}
        <CEOBroadcast className="brand-glow" />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className="rounded-lg border p-4">
            <h2 className="mb-2 text-lg font-medium">Punch</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button disabled={punchLoading} onClick={() => logAttendance("check_in")} className="rounded-md bg-emerald-600 px-3 py-1.5 text-white disabled:opacity-60">Punch In</button>
              <button disabled={punchLoading} onClick={() => logAttendance("check_out")} className="rounded-md bg-rose-600 px-3 py-1.5 text-white disabled:opacity-60">Punch Out</button>
              {!breakActive ? (
                <>
                  <select value={selectedBreak} onChange={(e)=> setSelectedBreak(e.target.value)} className="rounded-md border px-2 py-1 text-sm">
                    {breakRules.map((r)=> (<option key={r.name} value={r.name}>{r.name} ({r.minutes}m)</option>))}
                  </select>
                  <button disabled={punchLoading || !selectedBreak} onClick={startBreak} className="rounded-md bg-amber-500 px-3 py-1.5 text-white disabled:opacity-60">Take Break</button>
                </>
              ) : (
                <>
                  <span className="rounded border px-2 py-0.5 text-xs">On Break{currentBreakType ? `: ${currentBreakType}` : ''}</span>
                  <button disabled={punchLoading} onClick={endBreak} className="rounded-md bg-amber-700 px-3 py-1.5 text-white disabled:opacity-60">Back from Break</button>
                </>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500">Records `check_in`/`check_out` and `break_start`/`break_end` in `attendance_logs`.</p>
            {liveLabel && <p className="mt-1 text-sm font-medium text-brand-primary">{liveLabel}</p>}
            {confirmMsg && (
              <p className="mt-2 text-sm text-emerald-600">{confirmMsg}</p>
            )}
          </section>

          {/* Breaks section is now integrated into Punch controls */}

          <section className="rounded-lg border p-4">
            <h2 className="mb-2 text-lg font-medium">Leave</h2>
            <form onSubmit={submitLeave} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm">Type</label>
                  <select
                    value={leaveForm.type}
                    onChange={(e) => setLeaveForm((s) => ({ ...s, type: e.target.value }))}
                    className="w-full rounded-md border px-3 py-2"
                  >
                    <option value="annual">Annual</option>
                    <option value="sick">Sick</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm">Start</label>
                  <input type="date" value={leaveForm.start_date} onChange={(e) => setLeaveForm((s) => ({ ...s, start_date: e.target.value }))} className="w-full rounded-md border px-3 py-2" required />
                </div>
                <div>
                  <label className="mb-1 block text-sm">End</label>
                  <input type="date" value={leaveForm.end_date} onChange={(e) => setLeaveForm((s) => ({ ...s, end_date: e.target.value }))} className="w-full rounded-md border px-3 py-2" required />
                </div>
              </div>
              <button type="submit" disabled={leaveSubmitting} className="rounded-md bg-brand-primary px-4 py-2 text-white disabled:opacity-60">Submit Request</button>
              <p className="text-xs text-gray-500">Writes to table `leave_requests` with status `pending`.</p>
            </form>
          </section>

          <section className="rounded-lg border p-4">
            <h2 className="mb-2 text-lg font-medium">Timeline</h2>
            {timeline.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">No events today.</p>
            ) : (
              <ul className="text-sm">
                {timeline.map((t, i) => (
                  <li key={i} className="flex items-center justify-between border-b border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 last:border-b-0">
                    <span className="capitalize">{t.type.replace("_", " ")}</span>
                    <span className="tabular-nums text-gray-600 dark:text-gray-300">{new Date(t.ts).toLocaleTimeString()}</span>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => sessionUserId && refreshTimeline(sessionUserId)} className="mt-2 text-xs text-brand-primary">Refresh</button>
          </section>

          <section className="rounded-lg border p-4">
            <h2 className="mb-2 text-lg font-medium">Summary</h2>
            {!summary ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">No summary yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                {Object.entries(summary).map(([k, v]) => (
                  <div key={k} className="rounded-md border p-2">
                    <div className="text-xs uppercase tracking-wide opacity-60">{k}</div>
                    <div className="mt-1 text-base font-semibold">{String(v)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border p-4">
            <h2 className="mb-2 text-lg font-medium">Badges</h2>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full border px-2 py-0.5">Streak: {streak} day{streak === 1 ? "" : "s"}</span>
              {/* Additional computed badges can be added here */}
            </div>
          </section>

          <section className="rounded-lg border p-4 md:col-span-2">
            <h2 className="mb-2 text-lg font-medium">My HR Folder</h2>
            {files.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">No files yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2">Category</th>
                      <th className="py-2">Expiry</th>
                      <th className="py-2">Alert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f) => {
                      const exp = f.expiry_date ? new Date(f.expiry_date) : null;
                      const daysLeft = exp ? Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                      const alert = exp ? (daysLeft! < 0 ? "Expired" : daysLeft! <= 30 ? `${daysLeft} days left` : "") : "";
                      return (
                        <tr key={f.id} className="border-b last:border-b-0">
                          <td className="py-2">{f.category}</td>
                          <td className="py-2">{exp ? exp.toLocaleDateString() : "—"}</td>
                          <td className="py-2 text-rose-600">{alert}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">File downloads are restricted. Staff sees metadata only.</p>
          </section>
        </div>
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    </RoleGate>
  );
}
