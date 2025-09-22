"use client";
import RoleGate from "@/components/RoleGate";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";

type LeaveRequest = {
  id: string;
  user_id: string;
  type: string;
  start_date: string;
  end_date: string;
  status: string;
};

export default function ManagerDashboard() {
  const { role } = useUserRole();
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [inout, setInout] = useState<any[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [heatmap, setHeatmap] = useState<any[]>([]);
  const [warnUserId, setWarnUserId] = useState<string>("");
  const [warnReason, setWarnReason] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const isAssistant = role === "assistant_manager";

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active || !session) return;
      setSessionUserId(session.user.id);
      await Promise.all([
        refreshInOut(),
        refreshLeaves(),
        refreshHeatmap(),
      ]);
    })();
    return () => { active = false; };
  }, []);

  // Realtime: on any attendance_logs change, refresh current status
  useEffect(() => {
    const channel = supabase
      .channel("attendance-logs")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_logs" }, () => {
        refreshInOut();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function refreshInOut() {
    const { data, error } = await supabase
      .from("v_current_status")
      .select("*")
      .order("user_name", { ascending: true });
    if (error) { setErr(error.message); return; }
    setInout(data ?? []);
  }

  async function refreshLeaves() {
    const { data, error } = await supabase
      .from("leave_requests")
      .select("id,user_id,type,start_date,end_date,status")
      .eq("status", "pending")
      .order("start_date", { ascending: true });
    if (error) { setErr(error.message); return; }
    setPendingLeaves((data ?? []) as LeaveRequest[]);
  }

  async function refreshHeatmap() {
    const { data, error } = await supabase
      .from("v_team_heatmap")
      .select("*")
      .limit(1000);
    if (error) { setErr(error.message); return; }
    setHeatmap(data ?? []);
  }

  async function updateLeave(id: string, status: "approved" | "rejected") {
    if (!sessionUserId) return;
    try {
      setErr(null); setOkMsg(null);
      if (isAssistant) { setErr("Assistant Manager is view-only."); return; }
      const { error } = await supabase
        .from("leave_requests")
        .update({ status, approved_by: sessionUserId })
        .eq("id", id);
      if (error) throw error;
      setOkMsg(`Request ${status}.`);
      await refreshLeaves();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update request");
    }
  }

  async function sendWarning(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionUserId) return;
    try {
      setErr(null); setOkMsg(null);
      if (isAssistant) { setErr("Assistant Manager is view-only."); return; }
      if (!warnUserId || !warnReason.trim()) { setErr("Select an employee and enter a reason."); return; }
      const { error } = await supabase.from("warnings").insert({
        user_id: warnUserId,
        reason: warnReason.trim(),
        issued_by: sessionUserId,
      });
      if (error) throw error;
      setWarnReason("");
      setOkMsg("Warning sent.");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to send warning");
    }
  }

  return (
    <RoleGate allow={["manager", "assistant_manager", "hr", "ceo"]}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Welcome Manager Dashboard</h1>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Realtime In/Out */}
          <section className="rounded-lg border p-4 md:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-medium">Realtime team view</h2>
              <button onClick={refreshInOut} className="text-xs text-brand-primary">Refresh</button>
            </div>
            {inout.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">No team members visible.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2">Name</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Since</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inout.map((r: any) => (
                      <tr key={r.user_id} className="border-b last:border-b-0">
                        <td className="py-2">{r.user_name ?? r.full_name ?? r.user_id}</td>
                        <td className="py-2">{r.status ?? r.last_event ?? "—"}</td>
                        <td className="py-2">{r.since ? new Date(r.since).toLocaleTimeString() : r.last_ts ? new Date(r.last_ts).toLocaleTimeString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Approvals */}
          <section className="rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-medium">Approvals</h2>
              <button onClick={refreshLeaves} className="text-xs text-brand-primary">Refresh</button>
            </div>
            {pendingLeaves.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">No pending requests.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {pendingLeaves.map((lr) => (
                  <li key={lr.id} className="rounded-md border p-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{lr.type}</div>
                        <div className="text-xs opacity-70">{lr.start_date} → {lr.end_date}</div>
                      </div>
                      <div className="flex gap-2">
                        <button disabled={isAssistant} onClick={() => updateLeave(lr.id, "approved")} className="rounded-md bg-emerald-600 px-2 py-1 text-white disabled:opacity-50">Approve</button>
                        <button disabled={isAssistant} onClick={() => updateLeave(lr.id, "rejected")} className="rounded-md bg-rose-600 px-2 py-1 text-white disabled:opacity-50">Reject</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Heatmap */}
          <section className="rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-medium">Team Heatmap</h2>
              <button onClick={refreshHeatmap} className="text-xs text-brand-primary">Refresh</button>
            </div>
            {heatmap.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">No data.</p>
            ) : (
              <div className="max-h-64 overflow-auto rounded-md border">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b">
                      {Object.keys(heatmap[0]).map((k) => (
                        <th key={k} className="py-2 pr-4">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmap.map((row, i) => (
                      <tr key={i} className="border-b last:border-b-0">
                        {Object.values(row).map((v: any, j) => (
                          <td key={j} className="py-1 pr-4">{String(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Warnings */}
          <section className="rounded-lg border p-4 md:col-span-2">
            <h2 className="mb-2 text-lg font-medium">Warnings</h2>
            <form onSubmit={sendWarning} className="flex flex-wrap items-end gap-2">
              <div>
                <label className="mb-1 block text-xs">Employee</label>
                <select value={warnUserId} onChange={(e) => setWarnUserId(e.target.value)} className="rounded-md border px-3 py-2 min-w-[220px]">
                  <option value="">Select…</option>
                  {inout.map((r: any) => (
                    <option key={r.user_id} value={r.user_id}>{r.user_name ?? r.full_name ?? r.user_id}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[240px]">
                <label className="mb-1 block text-xs">Reason</label>
                <input value={warnReason} onChange={(e) => setWarnReason(e.target.value)} placeholder="Reason for warning" className="w-full rounded-md border px-3 py-2" />
              </div>
              <button type="submit" disabled={isAssistant} className="rounded-md bg-rose-600 px-4 py-2 text-white disabled:opacity-50">Send Warning</button>
            </form>
          </section>
        </div>

        {err && <p className="text-sm text-rose-600">{err}</p>}
        {okMsg && <p className="text-sm text-emerald-600">{okMsg}</p>}
      </div>
    </RoleGate>
  );
}
