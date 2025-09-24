"use client";
import RoleGate from "@/components/RoleGate";
import CEOSnapshot from "@/components/CEOSnapshot";
import CEOBroadcast from "@/components/CEOBroadcast";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";

export default function HRDashboard() {
  const { role } = useUserRole();
  const [goldMode, setGoldMode] = useState(false);
  const [tab, setTab] = useState<"overview" | "approvals" | "staff" | "settings" | "teams" | "folders" | "reports" | "warnings" | "ceo">("overview");
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [punchLoading, setPunchLoading] = useState(false);
  const [inout, setInout] = useState<any[]>([]);
  const [leaveReqs, setLeaveReqs] = useState<any[]>([]);
  const [corrReqs, setCorrReqs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState<{ email: string; role: string } | null>({ email: "", role: "staff" });
  const [brand, setBrand] = useState<{ color?: string; logo_url?: string }>({});
  const [uploading, setUploading] = useState(false);
  // Central role management sourced from public.user_roles
  const [userRolesMap, setUserRolesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('user_roles').select('user_id, role');
      if (data) {
        const map: Record<string,string> = {};
        for (const r of data as any[]) map[r.user_id] = r.role;
        setUserRolesMap(map);
      }
    })();
  }, []);

  // --- CEO message editor helpers (CEO only) ---
  async function loadCeoMessage() {
    const { data } = await supabase.from("company_settings").select("value").eq("key", "ceo_message").maybeSingle();
    setCeoMsgDraft((data?.value as string | undefined) ?? "");
  }

  async function saveCeoMessage() {
    setOkMsg(null); setErr(null);
    const { error } = await supabase.from("company_settings").upsert({ key: "ceo_message", value: ceoMsgDraft }, { onConflict: "key" });
    if (error) setErr(error.message); else setOkMsg("CEO message saved.");
  }

  async function refreshUserRoles() {
    const { data, error } = await supabase.from('user_roles').select('user_id, role');
    if (error) { setErr(error.message); return; }
    const map: Record<string,string> = {};
    for (const r of (data ?? []) as any[]) map[r.user_id] = r.role;
    setUserRolesMap(map);
  }

  async function updateUserRoleCentral(userId: string, newRole: string) {
    const { error: e1 } = await supabase.from('user_roles').upsert({ user_id: userId, role: newRole });
    const { error: e2 } = await supabase.from('users').update({ role: newRole }).eq('id', userId);
    if (e1 || e2) { setErr((e1?.message ?? '') || (e2?.message ?? 'Failed to update role')); return; }
    setUserRolesMap((s) => ({ ...s, [userId]: newRole }));
    setOkMsg('Role updated.');
  }
  const [fileMeta, setFileMeta] = useState<{ user_id: string; category: string; expiry_date?: string }>({ user_id: "", category: "" });
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Teams & Warnings
  const [teams, setTeams] = useState<any[]>([]);
  const [teamName, setTeamName] = useState("");
  const [memberUserId, setMemberUserId] = useState("");
  const [memberTeamId, setMemberTeamId] = useState("");
  const [managerUserId, setManagerUserId] = useState("");
  const [managerTeamId, setManagerTeamId] = useState("");
  const [warnings, setWarnings] = useState<any[]>([]);
  // HR Settings data
  const [jobTitles, setJobTitles] = useState<any[]>([]);
  const [newJobTitle, setNewJobTitle] = useState("");
  const [shifts, setShifts] = useState<any[]>([]);
  const [newShift, setNewShift] = useState<{ name: string; duration_minutes: number; start_time?: string; end_time?: string }>({ name: "", duration_minutes: 480 });
  const [holidays, setHolidays] = useState<any[]>([]);
  const [newHoliday, setNewHoliday] = useState<{ day: string; name?: string }>({ day: "", name: "" });
  const [breakRules, setBreakRules] = useState<any[]>([]);
  const [newBreakRule, setNewBreakRule] = useState<{ name: string; minutes: number }>({ name: "", minutes: 60 });
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [ceoMsgDraft, setCeoMsgDraft] = useState<string>("");
  // Analytics
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
        refreshApprovals(),
        refreshUsers(),
        loadBranding(),
        loadTeams(),
        loadWarnings(),
        loadSettingsData(),
        loadWeeklyTrends(),
        loadLatenessHeatmap(),
      ]);
    })();
  }, []);

  // Realtime: refresh overview when attendance_logs change
  useEffect(() => {
    const channel = supabase
      .channel('realtime-attendance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => {
        refreshOverview();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Tick every second for live timers in status list
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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
    const { data, error } = await supabase
      .from("v_current_status")
      .select("*")
      .order("user_id", { ascending: true });
    if (!error) setInout(data ?? []);
  }

  // --- Analytics loaders (graceful fallback if views missing) ---
  async function loadWeeklyTrends() {
    try {
      const { data, error } = await supabase.from("v_weekly_trends").select("*").limit(14);
      if (!error) { setWeeklyTrends(data ?? []); return; }
    } catch {}
    setWeeklyTrends([]);
  }

  async function loadLatenessHeatmap() {
    try {
      const { data, error } = await supabase.from("v_lateness_heatmap").select("*").limit(500);
      if (!error) { setLatenessHeatmap(data ?? []); return; }
    } catch {}
    setLatenessHeatmap([]);
  }

  // --- Punch In/Out for HR/CEO themselves ---
  type LogType = "check_in" | "check_out";
  async function logAttendance(type: LogType) {
    if (!sessionUserId) return;
    try {
      setErr(null);
      setPunchLoading(true);
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
    } finally {
      setPunchLoading(false);
    }
  }

  async function refreshApprovals() {
    const [{ data: leaves }, { data: corr, error: corrErr }] = await Promise.all([
      supabase
        .from("leave_requests")
        .select("id,user_id,type,start_date,end_date,status")
        .eq("status", "pending")
        .order("start_date", { ascending: true }),
      supabase
        .from("correction_requests")
        .select("id,user_id,reason:note,status,requested_at:created_at,target_date,requested_change,reviewer_id")
        .eq("status", "pending"),
    ]);
    setLeaveReqs(leaves ?? []);
    setCorrReqs(corr ?? []);
    if (corrErr) {
      console.error("[HR] correction_requests load error:", corrErr);
    }
  }

  async function refreshUsers() {
    // Minimal projection to avoid missing columns
    const { data } = await supabase
      .from("users")
      .select("id,email,role,full_name,job_title_id,shift_id")
      .order("email", { ascending: true });
    setUsers(data ?? []);
  }

  async function loadBranding() {
    // Be defensive: select all and try to derive key/value pairs regardless of column names
    const { data } = await supabase.from("company_settings").select("*");
    const map: any = {};
    (data ?? []).forEach((r: any) => {
      const k = r.key ?? r.setting_key ?? r.name ?? null;
      const v = r.value ?? r.setting_value ?? r.val ?? null;
      if (k) map[k] = v;
    });
    setBrand({ color: map["brand_color"], logo_url: map["brand_logo_url"] });
  }

  async function setBrandSetting(key: string, value: string) {
    setOkMsg(null); setErr(null);
    const { error } = await supabase.from("company_settings").upsert({ key, value }, { onConflict: "key" });
    if (error) { setErr(error.message); } else { setOkMsg("Branding saved."); await loadBranding(); }
  }

  async function createBasicUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUser) return;
    setOkMsg(null); setErr(null);
    // Assumes a user provisioning flow exists; here we only insert metadata row
    const { error } = await supabase.from("users").insert({ email: newUser.email, role: newUser.role });
    if (error) setErr(error.message); else { setOkMsg("User metadata created."); await refreshUsers(); setNewUser({ email: "", role: "staff" }); }
  }

  async function inviteUserByEmail(email: string) {
    if (!email) { setErr("Enter an email to invite."); return; }
    try {
      setErr(null); setOkMsg(null);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined }
      });
      if (error) throw error;
      setOkMsg("Invite sent (magic link).");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to send invite");
    }
  }

  async function updateUserJobShift(userId: string, patch: { job_title_id?: string | null; shift_id?: string | null }) {
    setOkMsg(null); setErr(null);
    const { error } = await supabase.from("users").update(patch).eq("id", userId);
    if (error) setErr(error.message); else { setOkMsg("User updated."); await refreshUsers(); }
  }

  async function updateLeaveStatus(id: string, status: "approved" | "rejected") {
    const { error } = await supabase.from("leave_requests").update({ status }).eq("id", id);
    if (error) setErr(error.message); else { setOkMsg(`Leave ${status}.`); await refreshApprovals(); }
  }

  async function updateCorrectionStatus(id: string, status: "approved" | "rejected") {
    const { error } = await supabase.from("correction_requests").update({ status, reviewer_id: sessionUserId }).eq("id", id);
    if (error) setErr(error.message); else { setOkMsg(`Correction ${status}.`); await refreshApprovals(); }
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = (e.currentTarget.elements.namedItem("file") as HTMLInputElement) || null;
    if (!input || !input.files || input.files.length === 0) return;
    const f = input.files[0];
    if (!fileMeta.user_id || !fileMeta.category) { setErr("Select user and category."); return; }
    setUploading(true); setErr(null); setOkMsg(null);
    try {
      const path = `${fileMeta.user_id}/${Date.now()}_${f.name}`;
      const { error: upErr } = await supabase.storage.from("hr-files").upload(path, f, { upsert: false });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("staff_files").insert({
        user_id: fileMeta.user_id,
        category: fileMeta.category,
        expiry_date: fileMeta.expiry_date || null,
        storage_path: path,
      });
      if (dbErr) throw dbErr;
      setOkMsg("File uploaded.");
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function exportCSV(filename: string, rows: any[]) {
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(",")].concat(rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  async function exportReports() {
    const { data } = await supabase.from("v_ceo_snapshot").select("*");
    exportCSV("ceo_snapshot.csv", data ?? []);
  }

  function exportCEOPDF() {
    window.print(); // Simple print-to-PDF approach for now
  }

  // --- Reports helpers for analytics views ---
  async function exportDailyAttendance() {
    const { data, error } = await supabase.from("v_staff_daily_attendance").select("*").limit(5000);
    if (error) { setErr(error.message); return; }
    exportCSV("staff_daily_attendance.csv", data ?? []);
  }

  async function exportLatenessPatterns() {
    const { data, error } = await supabase.from("v_lateness_patterns").select("*").limit(5000);
    if (error) { setErr(error.message); return; }
    exportCSV("lateness_patterns.csv", data ?? []);
  }

  async function exportOvertimeSummary() {
    const { data, error } = await supabase.from("v_overtime_summary").select("*").limit(5000);
    if (error) { setErr(error.message); return; }
    exportCSV("overtime_summary.csv", data ?? []);
  }

  async function exportAbsence30d() {
    const { data, error } = await supabase.from("v_absence_30d").select("*").limit(50000);
    if (error) { setErr(error.message); return; }
    exportCSV("absence_last_30_days.csv", data ?? []);
  }

  async function updateUserRole(userId: string, role: string) {
    setOkMsg(null); setErr(null);
    const { error } = await supabase.from("users").update({ role }).eq("id", userId);
    if (error) setErr(error.message); else { setOkMsg("User updated."); await refreshUsers(); }
  }

  // --- Teams management ---
  async function loadTeams() {
    const { data } = await supabase.from("teams").select("id,name").order("name");
    setTeams(data ?? []);
  }
  async function createTeam() {
    if (!teamName.trim()) return;
    const { error } = await supabase.from("teams").insert({ name: teamName.trim() });
    if (error) { setErr(error.message); } else { setTeamName(""); await loadTeams(); setOkMsg("Team created."); }
  }
  async function assignMember() {
    if (!memberTeamId || !memberUserId) return;
    const { error } = await supabase.from("team_members").upsert({ team_id: memberTeamId, user_id: memberUserId });
    if (error) setErr(error.message); else { setOkMsg("Member assigned."); }
  }
  async function assignManager() {
    if (!managerTeamId || !managerUserId) return;
    const { error } = await supabase.from("team_managers").upsert({ team_id: managerTeamId, user_id: managerUserId });
    if (error) setErr(error.message); else { setOkMsg("Manager assigned."); }
  }

  // --- Warnings ---
  async function loadWarnings() {
    const { data } = await supabase.from("warnings").select("id,user_id,reason,issued_by,created_at").order("created_at", { ascending: false }).limit(50);
    setWarnings(data ?? []);
  }

  // --- HR Settings data loaders ---
  async function loadSettingsData() {
    const [{ data: jt }, { data: sh }, { data: hol }, { data: br }] = await Promise.all([
      supabase.from("job_titles").select("*").order("name"),
      supabase.from("shifts").select("*").order("name"),
      supabase.from("holidays").select("*").order("day"),
      supabase.from("break_rules").select("*").order("name"),
    ]);
    setJobTitles(jt ?? []);
    setShifts(sh ?? []);
    setHolidays(hol ?? []);
    setBreakRules(br ?? []);
  }
  async function addJobTitle() {
    if (!newJobTitle.trim()) return;
    const { error } = await supabase.from("job_titles").insert({ name: newJobTitle.trim() });
    if (error) setErr(error.message); else { setNewJobTitle(""); setOkMsg("Job title added."); await loadSettingsData(); }
  }
  async function addShift() {
    if (!newShift.name.trim() || !newShift.duration_minutes) return;
    const { error } = await supabase.from("shifts").insert(newShift);
    if (error) setErr(error.message); else { setNewShift({ name: "", duration_minutes: 480 }); setOkMsg("Shift added."); await loadSettingsData(); }
  }
  async function addHoliday() {
    if (!newHoliday.day) return;
    const { error } = await supabase.from("holidays").insert(newHoliday);
    if (error) setErr(error.message); else { setNewHoliday({ day: "", name: "" }); setOkMsg("Holiday added."); await loadSettingsData(); }
  }
  async function addBreakRule() {
    if (!newBreakRule.name.trim()) return;
    const { error } = await supabase.from("break_rules").insert(newBreakRule);
    if (error) setErr(error.message); else { setNewBreakRule({ name: "", minutes: 60 }); setOkMsg("Break rule added."); await loadSettingsData(); }
  }

  return (
    <RoleGate allow={["hr", "ceo"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">
            {role === 'ceo' ? (
              <span className="inline-flex items-center gap-2">
                <span className="text-xl">👑</span>
                <span>Welcome, CEO {displayName || ""}</span>
              </span>
            ) : (
              <span>Welcome, {displayName || "HR/CEO"}</span>
            )}
          </h1>
          {/* Quick Punch for HR/CEO */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => logAttendance("check_in")}
              disabled={punchLoading || !sessionUserId}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-white disabled:opacity-50"
              title="Punch In"
            >
              Punch In
            </button>
            <button
              onClick={() => logAttendance("check_out")}
              disabled={punchLoading || !sessionUserId}
              className="rounded-md bg-rose-600 px-3 py-1.5 text-white disabled:opacity-50"
              title="Punch Out"
            >
              Punch Out
            </button>
            {role === "ceo" && (
              <button
                onClick={() => setGoldMode((v) => !v)}
                className={`rounded-md px-3 py-1.5 text-sm transition-all duration-200 ${goldMode ? "bg-[#D4AF37] text-black shadow-[0_0_16px_rgba(212,175,55,0.55)]" : "border border-[#D4AF37]/60 text-[#D4AF37] hover:bg-[#D4AF37]/10"}`}
                title="Toggle CEO Gold Theme"
              >
                {goldMode ? "Gold On" : "Gold Off"}
              </button>
            )}

        {/* Heatmaps Tab (read-only display for CEO/HR) */}
        {tab === "reports" && (
          <section className="rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-medium">Heatmaps — Lateness & Overtime</h2>
              <button onClick={loadLatenessHeatmap} className="text-xs text-brand-primary">Refresh</button>
            </div>
            {!latenessHeatmap || latenessHeatmap.length === 0 ? (
              <p className="text-sm opacity-70">No heatmap data.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b">
                      {Object.keys(latenessHeatmap[0]).map((k)=> (
                        <th key={k} className="py-2 px-2">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {latenessHeatmap.map((row, i) => (
                      <tr key={i} className="border-b last:border-b-0">
                        {Object.values(row).map((v:any,j)=> (
                          <td key={j} className="py-1 px-2">{String(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* CEO Tab: Editor for CEO Message (moved below tabs) */}
        {tab === "ceo" && role === "ceo" && (
          <section className={`rounded-lg border p-4 ${goldMode ? 'border-[#D4AF37]/40' : ''}`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium">CEO Broadcast</h2>
              <button onClick={loadCeoMessage} className="text-xs text-brand-primary">Load current</button>
            </div>
            <p className="mb-2 text-sm opacity-80">Write a message to appear on the home page and on everyone’s overview.</p>
            <textarea
              value={ceoMsgDraft}
              onChange={(e) => setCeoMsgDraft(e.target.value)}
              placeholder="Type your message to all staff..."
              className="min-h-[140px] w-full rounded-md border p-3"
            />
            <div className="mt-3 flex items-center gap-2">
              <button onClick={saveCeoMessage} className={`rounded-md px-4 py-2 text-white ${goldMode ? 'bg-[#D4AF37] text-black' : 'bg-brand-primary'}`}>Save Broadcast</button>
              {okMsg && <span className="text-sm text-emerald-600">{okMsg}</span>}
              {err && <span className="text-sm text-rose-600">{err}</span>}
            </div>
            <div className="mt-4">
              <h3 className="mb-1 text-sm font-semibold">Preview</h3>
              <CEOBroadcast />
            </div>
          </section>
        )}
          </div>
        </div>

        {/* Tabs */}
        <nav className={`flex gap-2 overflow-x-auto rounded-lg border p-1 text-sm backdrop-blur supports-[backdrop-filter]:backdrop-blur-md ${goldMode && role === 'ceo' ? 'bg-[#1a1400]/40 border-[#D4AF37]/30' : 'bg-white/60 dark:bg-black/20 border-brand-primary/20'}`} aria-label="Sections">
          <button onClick={() => setTab("overview")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "overview" ? (goldMode && role === 'ceo' ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary shadow-[0_0_12px_rgba(77,107,241,0.35)]") : (goldMode && role === 'ceo' ? "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10" : "opacity-80 hover:opacity-100 hover:text-brand-primary hover:bg-brand-primary/10")}`}>Overview</button>
          <button onClick={() => setTab("approvals")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "approvals" ? (goldMode && role === 'ceo' ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary shadow-[0_0_12px_rgba(77,107,241,0.35)]") : (goldMode && role === 'ceo' ? "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10" : "opacity-80 hover:opacity-100 hover:text-brand-primary hover:bg-brand-primary/10")}`}>Approvals</button>
          <button onClick={() => setTab("staff")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "staff" ? (goldMode && role === 'ceo' ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary shadow-[0_0_12px_rgba(77,107,241,0.35)]") : (goldMode && role === 'ceo' ? "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10" : "opacity-80 hover:opacity-100 hover:text-brand-primary hover:bg-brand-primary/10")}`}>Staff Admin</button>
          <button onClick={() => setTab("settings")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "settings" ? (goldMode && role === 'ceo' ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary shadow-[0_0_12px_rgba(77,107,241,0.35)]") : (goldMode && role === 'ceo' ? "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10" : "opacity-80 hover:opacity-100 hover:text-brand-primary hover:bg-brand-primary/10")}`}>Settings</button>
          <button onClick={() => setTab("teams")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "teams" ? (goldMode && role === 'ceo' ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary shadow-[0_0_12px_rgba(77,107,241,0.35)]") : (goldMode && role === 'ceo' ? "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10" : "opacity-80 hover:opacity-100 hover:text-brand-primary hover:bg-brand-primary/10")}`}>Teams</button>
          <button onClick={() => setTab("folders")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "folders" ? (goldMode && role === 'ceo' ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary shadow-[0_0_12px_rgba(77,107,241,0.35)]") : (goldMode && role === 'ceo' ? "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10" : "opacity-80 hover:opacity-100 hover:text-brand-primary hover:bg-brand-primary/10")}`}>HR Folders</button>
          <button onClick={() => setTab("reports")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "reports" ? (goldMode && role === 'ceo' ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary shadow-[0_0_12px_rgba(77,107,241,0.35)]") : (goldMode && role === 'ceo' ? "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10" : "opacity-80 hover:opacity-100 hover:text-brand-primary hover:bg-brand-primary/10")}`}>Reports</button>
          <button onClick={() => setTab("warnings")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "warnings" ? (goldMode && role === 'ceo' ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary shadow-[0_0_12px_rgba(77,107,241,0.35)]") : (goldMode && role === 'ceo' ? "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10" : "opacity-80 hover:opacity-100 hover:text-brand-primary hover:bg-brand-primary/10")}`}>Warnings</button>
          {role === "ceo" && (
            <button onClick={() => setTab("ceo")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "ceo" ? (goldMode && role === 'ceo' ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary shadow-[0_0_12px_rgba(77,107,241,0.35)]") : (goldMode && role === 'ceo' ? "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10" : "opacity-80 hover:opacity-100 hover:text-brand-primary hover:bg-brand-primary/10")}`}>CEO</button>
          )}
        </nav>

        {/* CEO Broadcast placed globally below tabs */}
        <section className={`rounded-xl border p-4 ${goldMode && role === 'ceo' ? 'border-[#D4AF37]/30' : 'border-brand-primary/20'}`}>
          <CEOBroadcast />
        </section>

        {/* Overview Tab */}
        {tab === "overview" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Executive Snapshot + Status */}
          <section className={`rounded-xl border p-4 shadow-md hover:shadow-xl transition-all duration-300 lg:col-span-2 ${goldMode && role === 'ceo' ? 'border-[#D4AF37]/30 dark:border-[#D4AF37]/20' : 'border-brand-primary/20 dark:border-brand.light/10'}`}>
            <div className="flex items-center justify-between">
              <h2 className="mb-2 text-lg font-medium">Overview</h2>
              <button onClick={refreshOverview} className="text-xs text-brand-primary">Refresh</button>
            </div>
            <CEOSnapshot />
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold">Current Status</h3>
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

          {/* Weekly Trends (cards + simple bars) */}
          <section className={`rounded-xl border p-4 shadow-md transition-all duration-300 lg:col-span-1 ${goldMode && role === 'ceo' ? 'border-[#D4AF37]/30' : 'border-brand-primary/20'}`}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-medium">Weekly Trends</h2>
              <button onClick={loadWeeklyTrends} className="text-xs text-brand-primary">Refresh</button>
            </div>
            {!weeklyTrends || weeklyTrends.length === 0 ? (
              <p className="text-sm opacity-70">No trend data.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {weeklyTrends.slice(0,6).map((r:any,i:number)=>{
                  const pct = Math.max(0, Math.min(100, Math.round(Number(r.attendance_pct ?? r.pct ?? 0))));
                  const label = r.label ?? r.day ?? r.week ?? `#${i+1}`;
                  return (
                    <li key={i} className="grid grid-cols-5 items-center gap-2">
                      <span className="col-span-2 truncate">{label}</span>
                      <div className="col-span-3 h-2 rounded bg-black/10 dark:bg-white/10 overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{width: pct + '%'}} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
        )}

        {/* Approvals Tab */}
        {tab === "approvals" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className="rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-medium">Approvals</h2>
              <button onClick={refreshApprovals} className="text-xs text-brand-primary">Refresh</button>
            </div>
            <h3 className="mb-1 text-sm font-semibold">Leave Requests</h3>
            {leaveReqs.length === 0 ? <p className="text-sm opacity-70">No pending.</p> : (
              <ul className="mb-3 space-y-2 text-sm">
                {leaveReqs.map((r: any) => (
                  <li key={r.id} className="rounded-md border p-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{r.type}</div>
                        <div className="text-xs opacity-70">{r.start_date} → {r.end_date}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => updateLeaveStatus(r.id, "approved")} className="rounded-md bg-emerald-600 px-2 py-1 text-white">Approve</button>
                        <button onClick={() => updateLeaveStatus(r.id, "rejected")} className="rounded-md bg-rose-600 px-2 py-1 text-white">Reject</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <h3 className="mb-1 text-sm font-semibold">Correction Requests</h3>
            {corrReqs.length === 0 ? <p className="text-sm opacity-70">No pending.</p> : (
              <ul className="space-y-2 text-sm">
                {corrReqs.map((r: any) => (
                  <li key={r.id} className="rounded-md border p-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{r.reason}</div>
                        <div className="text-xs opacity-70">Requested: {r.requested_at ? new Date(r.requested_at).toLocaleString() : "—"}</div>
                        {r.target_date && (
                          <div className="text-xs opacity-70">Target date: {new Date(r.target_date).toLocaleDateString()}</div>
                        )}
                        {r.requested_change && (
                          <pre className="mt-1 max-h-28 overflow-auto rounded bg-black/5 p-2 text-[11px] leading-snug">{JSON.stringify(r.requested_change, null, 2)}</pre>
                        )}
                        <div className="mt-1 text-xs opacity-70">Reviewer: {r.reviewer_id ? r.reviewer_id : '—'}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => supabase.from('correction_requests').update({ reviewer_id: sessionUserId }).eq('id', r.id).then(()=>{ setOkMsg('Assigned as reviewer.'); refreshApprovals(); })} className="rounded-md border px-2 py-1 text-xs">Assign me</button>
                        <button onClick={() => updateCorrectionStatus(r.id, "approved")} className="rounded-md bg-emerald-600 px-2 py-1 text-white">Approve</button>
                        <button onClick={() => updateCorrectionStatus(r.id, "rejected")} className="rounded-md bg-rose-600 px-2 py-1 text-white">Reject</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {/* close approvals container and conditional */}
        </div>
        )}

          {/* Staff Admin */}
          {tab === "staff" && (
          <section className="rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-medium">Staff Admin</h2>
              <button onClick={refreshUserRoles} className="rounded-md border px-2 py-1 text-xs">Refresh Roles</button>
            </div>
            <form onSubmit={createBasicUser} className="mb-3 flex flex-wrap items-end gap-2 text-sm">
              <div>
                <label className="mb-1 block text-xs">Email</label>
                <input required value={newUser?.email ?? ""} onChange={(e) => setNewUser((s) => ({ ...(s as any), email: e.target.value }))} className="rounded-md border px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-xs">Role</label>
                <select value={newUser?.role ?? "staff"} onChange={(e) => setNewUser((s) => ({ ...(s as any), role: e.target.value }))} className="rounded-md border px-3 py-2">
                  <option value="staff">staff</option>
                  <option value="assistant_manager">assistant_manager</option>
                  <option value="manager">manager</option>
                  <option value="hr">hr</option>
                  <option value="ceo">ceo</option>
                </select>
              </div>
              <button type="submit" className="rounded-md bg-brand-primary px-3 py-2 text-white">Add</button>
              <button type="button" onClick={() => inviteUserByEmail(newUser?.email ?? "")} className="rounded-md border px-3 py-2">Send Invite</button>
            </form>
            <div className="max-h-64 overflow-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2">Name</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Role</th>
                    <th className="py-2">Job Title</th>
                    <th className="py-2">Shift</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-b-0">
                      <td className="py-2">{u.full_name ?? u.id}</td>
                      <td className="py-2">{u.email ?? "—"}</td>
                      <td className="py-2">{userRolesMap[u.id] ?? u.role}</td>
                      <td className="py-2">
                        <select value={u.job_title_id ?? ""} onChange={(e) => updateUserJobShift(u.id, { job_title_id: e.target.value || null })} className="rounded-md border px-2 py-1 text-xs min-w-[160px]">
                          <option value="">—</option>
                          {jobTitles.map((jt:any)=> (<option key={jt.id} value={jt.id}>{jt.name}</option>))}
                        </select>
                      </td>
                      <td className="py-2">
                        <select value={u.shift_id ?? ""} onChange={(e) => updateUserJobShift(u.id, { shift_id: e.target.value || null })} className="rounded-md border px-2 py-1 text-xs min-w-[160px]">
                          <option value="">—</option>
                          {shifts.map((sh:any)=> (<option key={sh.id} value={sh.id}>{sh.name}</option>))}
                        </select>
                      </td>
                      <td className="py-2">
                        <select value={userRolesMap[u.id] ?? u.role} onChange={(e) => updateUserRoleCentral(u.id, e.target.value)} className="rounded-md border px-2 py-1 text-xs">
                          <option value="staff">staff</option>
                          <option value="assistant_manager">assistant_manager</option>
                          <option value="manager">manager</option>
                          <option value="hr">hr</option>
                          <option value="ceo">ceo</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          )}

          {/* Settings */}
          {tab === "settings" && (
          <section className="rounded-lg border p-4">
            <h2 className="mb-2 text-lg font-medium">Settings</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-end gap-2">
                <div>
                  <label className="mb-1 block text-xs">Brand Color</label>
                  <input value={brand.color ?? ""} onChange={(e) => setBrand((s) => ({ ...s, color: e.target.value }))} placeholder="#4D6BF1" className="rounded-md border px-3 py-2" />
                </div>
                <button onClick={() => setBrandSetting("brand_color", brand.color ?? "")} className="rounded-md bg-brand-primary px-3 py-2 text-white">Save</button>
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <label className="mb-1 block text-xs">Brand Logo URL</label>
                  <input value={brand.logo_url ?? ""} onChange={(e) => setBrand((s) => ({ ...s, logo_url: e.target.value }))} placeholder="https://…" className="min-w-[300px] rounded-md border px-3 py-2" />
                </div>
                <button onClick={() => setBrandSetting("brand_logo_url", brand.logo_url ?? "")} className="rounded-md bg-brand-primary px-3 py-2 text-white">Save</button>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-md border p-3">
                  <h3 className="mb-2 text-sm font-semibold">Job Titles</h3>
                  <div className="mb-2 flex gap-2">
                    <input value={newJobTitle} onChange={(e) => setNewJobTitle(e.target.value)} placeholder="e.g., Accountant" className="flex-1 rounded-md border px-3 py-2" />
                    <button onClick={addJobTitle} className="rounded-md bg-brand-primary px-3 py-2 text-white">Add</button>
                  </div>
                  <ul className="max-h-36 overflow-auto text-xs">
                    {jobTitles.map((jt) => (<li key={jt.id} className="border-b py-1 last:border-b-0">{jt.name}</li>))}
                  </ul>
                </div>
                <div className="rounded-md border p-3">
                  <h3 className="mb-2 text-sm font-semibold">Shifts</h3>
                  <div className="mb-2 grid grid-cols-4 gap-2">
                    <input value={newShift.name} onChange={(e) => setNewShift((s) => ({ ...s, name: e.target.value }))} placeholder="Name" className="rounded-md border px-2 py-2" />
                    <input type="number" value={newShift.duration_minutes} onChange={(e) => setNewShift((s) => ({ ...s, duration_minutes: Number(e.target.value) }))} placeholder="Minutes" className="rounded-md border px-2 py-2" />
                    <input type="time" value={newShift.start_time ?? ""} onChange={(e) => setNewShift((s) => ({ ...s, start_time: e.target.value }))} className="rounded-md border px-2 py-2" />
                    <input type="time" value={newShift.end_time ?? ""} onChange={(e) => setNewShift((s) => ({ ...s, end_time: e.target.value }))} className="rounded-md border px-2 py-2" />
                  </div>
                  <button onClick={addShift} className="rounded-md bg-brand-primary px-3 py-2 text-white">Add</button>
                  <ul className="mt-2 max-h-36 overflow-auto text-xs">
                    {shifts.map((sh) => (<li key={sh.id} className="border-b py-1 last:border-b-0">{sh.name} — {sh.duration_minutes} mins</li>))}
                  </ul>
                </div>
                <div className="rounded-md border p-3">
                  <h3 className="mb-2 text-sm font-semibold">Holidays</h3>
                  <div className="mb-2 flex gap-2">
                    <input type="date" value={newHoliday.day} onChange={(e) => setNewHoliday((s) => ({ ...s, day: e.target.value }))} className="rounded-md border px-3 py-2" />
                    <input value={newHoliday.name} onChange={(e) => setNewHoliday((s) => ({ ...s, name: e.target.value }))} placeholder="Name (optional)" className="rounded-md border px-3 py-2" />
                    <button onClick={addHoliday} className="rounded-md bg-brand-primary px-3 py-2 text-white">Add</button>
                  </div>
                  <ul className="max-h-36 overflow-auto text-xs">
                    {holidays.map((h) => (<li key={h.id} className="border-b py-1 last:border-b-0">{new Date(h.day).toLocaleDateString()} — {h.name ?? ""}</li>))}
                  </ul>
                </div>
                <div className="rounded-md border p-3">
                  <h3 className="mb-2 text-sm font-semibold">Break Rules</h3>
                  <div className="mb-2 flex gap-2">
                    <input value={newBreakRule.name} onChange={(e) => setNewBreakRule((s) => ({ ...s, name: e.target.value }))} placeholder="Name" className="rounded-md border px-3 py-2" />
                    <input type="number" value={newBreakRule.minutes} onChange={(e) => setNewBreakRule((s) => ({ ...s, minutes: Number(e.target.value) }))} placeholder="Minutes" className="rounded-md border px-3 py-2" />
                    <button onClick={addBreakRule} className="rounded-md bg-brand-primary px-3 py-2 text-white">Add</button>
                  </div>
                  <ul className="max-h-36 overflow-auto text-xs">
                    {breakRules.map((b) => (<li key={b.id} className="border-b py-1 last:border-b-0">{b.name} — {b.minutes} mins</li>))}
                  </ul>
                </div>
              </div>
              <p className="text-xs opacity-70">Holidays, job titles and auto warning rules can be added later. This saves branding in `company_settings`.</p>
            </div>
          </section>
          )}

          {/* HR Folders */}
          {tab === "folders" && (
          <section className="rounded-lg border p-4">
            <h2 className="mb-2 text-lg font-medium">HR Folders</h2>
            <form onSubmit={handleUpload} className="space-y-3 text-sm">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs">Employee</label>
                  <select value={fileMeta.user_id} onChange={(e) => setFileMeta((s) => ({ ...s, user_id: e.target.value }))} className="w-full rounded-md border px-3 py-2">
                    <option value="">Select…</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name ?? u.email ?? u.id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs">Category</label>
                  <input value={fileMeta.category} onChange={(e) => setFileMeta((s) => ({ ...s, category: e.target.value }))} className="w-full rounded-md border px-3 py-2" placeholder="Contract" />
                </div>
                <div>
                  <label className="mb-1 block text-xs">Expiry Date</label>
                  <input type="date" value={fileMeta.expiry_date ?? ""} onChange={(e) => setFileMeta((s) => ({ ...s, expiry_date: e.target.value }))} className="w-full rounded-md border px-3 py-2" />
                </div>
              </div>
              <input name="file" type="file" className="block" />
              <button type="submit" disabled={uploading} className="rounded-md bg-brand-primary px-3 py-2 text-white disabled:opacity-50">{uploading ? "Uploading…" : "Upload"}</button>
              <p className="text-xs opacity-70">Uploads go to storage bucket `hr-files` and metadata is saved in `staff_files`.</p>
            </form>
          </section>
          )}

          {/* Reports */}
          {tab === "reports" && (
          <section className="rounded-xl border p-4 md:col-span-2 shadow-md hover:shadow-xl transition-all duration-300 border-brand-primary/20 dark:border-brand.light/10">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-medium">Reports</h2>
              <div className="flex gap-2">
                <button onClick={exportReports} className="rounded-md border px-3 py-2 text-sm">Export CSV</button>
                {role === "ceo" && <button onClick={exportCEOPDF} className="rounded-md border px-3 py-2 text-sm">Export CEO Briefing (PDF)</button>}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 text-sm">
              <div className="rounded-md border p-3">
                <h3 className="mb-2 font-semibold">Staff Daily Attendance</h3>
                <p className="mb-2 opacity-70">First check-in and last check-out per user per day (30 days).</p>
                <button onClick={exportDailyAttendance} className="rounded-md border px-3 py-2">Export CSV</button>
              </div>
              <div className="rounded-md border p-3">
                <h3 className="mb-2 font-semibold">Lateness Patterns</h3>
                <p className="mb-2 opacity-70">Flags late check-ins based on shift start + grace.</p>
                <button onClick={exportLatenessPatterns} className="rounded-md border px-3 py-2">Export CSV</button>
              </div>
              <div className="rounded-md border p-3">
                <h3 className="mb-2 font-semibold">Overtime Summary</h3>
                <p className="mb-2 opacity-70">Worked hours vs scheduled shift hours.</p>
                <button onClick={exportOvertimeSummary} className="rounded-md border px-3 py-2">Export CSV</button>
              </div>
              <div className="rounded-md border p-3">
                <h3 className="mb-2 font-semibold">Absence (last 30 days)</h3>
                <p className="mb-2 opacity-70">Days with no check-in, excluding holidays.</p>
                <button onClick={exportAbsence30d} className="rounded-md border px-3 py-2">Export CSV</button>
              </div>
            </div>
          </section>
          )}

          {/* Teams */}
          {tab === "teams" && (
          <section className="rounded-lg border p-4 md:col-span-2">
            <h2 className="mb-2 text-lg font-medium">Teams</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-sm">
              <div className="rounded-md border p-3">
                <h3 className="mb-2 text-sm font-semibold">Create Team</h3>
                <div className="flex gap-2">
                  <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Team name" className="flex-1 rounded-md border px-3 py-2" />
                  <button onClick={createTeam} className="rounded-md bg-brand-primary px-3 py-2 text-white">Add</button>
                </div>
                <ul className="mt-2 max-h-36 overflow-auto text-xs">
                  {teams.map((t) => (<li key={t.id} className="border-b py-1 last:border-b-0">{t.name}</li>))}
                </ul>
              </div>
              <div className="rounded-md border p-3">
                <h3 className="mb-2 text-sm font-semibold">Assign Member</h3>
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <select value={memberTeamId} onChange={(e) => setMemberTeamId(e.target.value)} className="rounded-md border px-2 py-2">
                    <option value="">Team…</option>
                    {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                  <select value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)} className="rounded-md border px-2 py-2">
                    <option value="">User…</option>
                    {users.map((u) => (<option key={u.id} value={u.id}>{u.full_name ?? u.email ?? u.id}</option>))}
                  </select>
                </div>
                <button onClick={assignMember} className="rounded-md bg-brand-primary px-3 py-2 text-white">Assign</button>
              </div>
              <div className="rounded-md border p-3">
                <h3 className="mb-2 text-sm font-semibold">Assign Manager</h3>
                <div className="mb-2 grid grid-cols-2 gap-2">
                  <select value={managerTeamId} onChange={(e) => setManagerTeamId(e.target.value)} className="rounded-md border px-2 py-2">
                    <option value="">Team…</option>
                    {teams.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                  <select value={managerUserId} onChange={(e) => setManagerUserId(e.target.value)} className="rounded-md border px-2 py-2">
                    <option value="">User…</option>
                    {users.map((u) => (<option key={u.id} value={u.id}>{u.full_name ?? u.email ?? u.id}</option>))}
                  </select>
                </div>
                <button onClick={assignManager} className="rounded-md bg-brand-primary px-3 py-2 text-white">Assign</button>
              </div>
            </div>
          </section>
          )}

          {/* Warnings (latest 50) */}
          {tab === "warnings" && (
          <section className="rounded-lg border p-4 md:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-medium">Warnings</h2>
              <button onClick={loadWarnings} className="text-xs text-brand-primary">Refresh</button>
            </div>
            {warnings.length === 0 ? (
              <p className="text-sm opacity-70">No warnings yet.</p>
            ) : (
              <div className="max-h-64 overflow-auto rounded-md border">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b"><th className="py-2">User</th><th className="py-2">Reason</th><th className="py-2">Issued By</th><th className="py-2">At</th></tr>
                  </thead>
                  <tbody>
                    {warnings.map((w) => (
                      <tr key={w.id} className="border-b last:border-b-0">
                        <td className="py-1">{w.user_id}</td>
                        <td className="py-1">{w.reason}</td>
                        <td className="py-1">{w.issued_by}</td>
                        <td className="py-1">{new Date(w.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {err && <p className="text-sm text-rose-600">{err}</p>}
        {okMsg && <p className="text-sm text-emerald-600">{okMsg}</p>}
      </div>
    </RoleGate>
  );
}
