"use client";
import RoleGate from "@/components/RoleGate";
import CEOSnapshot from "@/components/CEOSnapshot";
import CEOBroadcast from "@/components/CEOBroadcast";
import DailyQuote from "@/components/DailyQuote";
import SettingsButton from "@/components/SettingsButton";
import StaffCard from "@/components/staff/StaffCard";
import StaffDetailsModal from "@/components/staff/StaffDetailsModal";
import NewStaffModal, { NewStaffPayload } from "@/components/staff/NewStaffModal";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";

export default function HRDashboard() {
  const { role } = useUserRole();
  const [goldMode, setGoldMode] = useState(false);
  const [tab, setTab] = useState<"overview" | "approvals" | "staff" | "settings" | "teams" | "reports" | "warnings" | "ceo" | "cards">("overview");
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
  const [openNewStaff, setOpenNewStaff] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; action?: 'delete'|'suspend'|'unsuspend'; user?: { id: string; email?: string|null } }>({ open: false });
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
  const [lastCreated, setLastCreated] = useState<{ email: string; tempPassword: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Teams & Warnings
  const [teams, setTeams] = useState<any[]>([]);
  const [teamName, setTeamName] = useState("");
  const [memberUserId, setMemberUserId] = useState("");
  const [memberTeamId, setMemberTeamId] = useState("");
  const [managerUserId, setManagerUserId] = useState("");
  const [managerTeamId, setManagerTeamId] = useState("");
  const [warnings, setWarnings] = useState<any[]>([]);
  // Staff Cards consolidated view
  const [staffCards, setStaffCards] = useState<any[] | null>(null);
  const [staffCardsLoading, setStaffCardsLoading] = useState(false);
  // HR Settings data
  const [jobTitles, setJobTitles] = useState<any[]>([]);
  const [newJobTitle, setNewJobTitle] = useState("");
  const [shifts, setShifts] = useState<any[]>([]);
  const [newShift, setNewShift] = useState<{ name: string; duration_minutes: number; start_time?: string; end_time?: string }>({ name: "", duration_minutes: 480 });
  const [holidays, setHolidays] = useState<any[]>([]);
  const [newHoliday, setNewHoliday] = useState<{ date: string; name?: string; recurring?: boolean }>({ date: "", name: "", recurring: false });
  const [breakRules, setBreakRules] = useState<any[]>([]);
  const [newBreakRule, setNewBreakRule] = useState<{ name: string; minutes: number }>({ name: "", minutes: 60 });
  // Staff details modal
  const [openStaffModal, setOpenStaffModal] = useState(false);
  const [activeStaff, setActiveStaff] = useState<any | null>(null);
  // Inline edit state (Job Titles & Shifts)
  const [editingJobTitleId, setEditingJobTitleId] = useState<string | null>(null);
  const [editingJobTitleName, setEditingJobTitleName] = useState<string>("");
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [editingShift, setEditingShift] = useState<{ name: string; duration_minutes: number; start_time?: string; end_time?: string }>({ name: "", duration_minutes: 480 });
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [ceoMsgDraft, setCeoMsgDraft] = useState<string>("");
  // Analytics
  const [weeklyTrends, setWeeklyTrends] = useState<any[] | null>(null);
  const [latenessHeatmap, setLatenessHeatmap] = useState<any[] | null>(null);

  // Derive whether the current user is "on clock" (punched in)
  const isOnClock = useMemo(() => {
    if (!sessionUserId) return false;
    const st: any = (inout || []).find((r: any) => r.user_id === sessionUserId) || null;
    if (!st) return false;
    const s = (st.status ?? st.last_event ?? "").toString().toLowerCase();
    return ["present", "working", "checked_in", "in"].includes(s) || st.last_event === "check_in";
  }, [inout, sessionUserId]);

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
      // Initial load for the default tab and global data
      await refreshOverview();
      await loadBranding();
      await loadWeeklyTrends();
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

  // Realtime: refresh settings lists when any settings table changes
  useEffect(() => {
    const settingsChannel = supabase
      .channel('realtime-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_titles' }, () => { if (tab === 'settings') loadSettingsData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => { if (tab === 'settings') loadSettingsData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'holidays' }, () => { if (tab === 'settings') loadSettingsData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'break_rules' }, () => { if (tab === 'settings') loadSettingsData(); })
      .subscribe();
    return () => { supabase.removeChannel(settingsChannel); };
  }, [tab]);

  // Realtime: refresh cards on related table changes when on Cards tab
  useEffect(() => {
    if (tab !== 'cards') return;
    const cardsChannel = supabase
      .channel('realtime-cards')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_files' }, () => { loadStaffCardsData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warnings' }, () => { loadStaffCardsData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_cards' }, () => { loadStaffCardsData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => { loadStaffCardsData(); })
      .subscribe();
    return () => { supabase.removeChannel(cardsChannel); };
  }, [tab]);

  // Realtime: refresh teams when teams-related tables change
  useEffect(() => {
    if (tab !== 'teams') return;
    const teamsChannel = supabase
      .channel('realtime-teams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => { loadTeams(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, () => { /* could enhance UI later */ })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_managers' }, () => { /* could enhance UI later */ })
      .subscribe();
    return () => { supabase.removeChannel(teamsChannel); };
  }, [tab]);

  // Fetch data when tab changes
  useEffect(() => {
    if (tab === "approvals") refreshApprovals();
    if (tab === "staff") { refreshUsers(); if (role === 'hr' || role === 'ceo') syncAuthUsers(); }
    if (tab === "teams") loadTeams();
    if (tab === "warnings") loadWarnings();
    if (tab === "settings") loadSettingsData();
    if (tab === "cards") loadStaffCardsData();
    if (tab === "reports") {
      loadLatenessHeatmap();
      loadWeeklyTrends();
    }
  }, [tab]);

  // Auto-sync once when role is known (HR/CEO)
  useEffect(() => {
    if (role === 'hr' || role === 'ceo') {
      syncAuthUsers();
    }
  }, [role]);

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
    // Handle the actual schema: company_settings has a jsonb 'branding' column
    const { data } = await supabase.from("company_settings").select("branding").eq("id", true).maybeSingle();
    const branding = data?.branding || {};
    setBrand({ 
      color: branding.brand_color || "#4D6BF1", 
      logo_url: branding.brand_logo_url || "/logo/adeer logo.png" 
    });
  }

  async function setBrandSetting(key: string, value: string) {
    setOkMsg(null); setErr(null);
    // Update the JSONB branding field
    const { data: current } = await supabase.from("company_settings").select("branding").eq("id", true).maybeSingle();
    const currentBranding = current?.branding || {};
    const updatedBranding = { ...currentBranding, [key]: value };
    
    const { error } = await supabase.from("company_settings")
      .upsert({ id: true, branding: updatedBranding }, { onConflict: "id" });
    if (error) { setErr(error.message); } else { setOkMsg("Branding saved."); await loadBranding(); }
  }

  async function createBasicUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUser) return;
    setOkMsg(null); setErr(null);
    try {
      if (!newUser.email) { setErr("Email is required"); return; }
      const tempPassword = generateTempPassword();
      const res = await fetch("/api/admin/create-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newUser.email,
          fullName: null,
          role: newUser.role ?? "staff",
          employmentId: null,
          tempPassword,
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create staff");
      const shownPass = json?.tempPassword || tempPassword;
      setLastCreated({ email: newUser.email, tempPassword: shownPass });
      setOkMsg(`Staff created. Temporary password: ${shownPass}`);
      // Optimistically append row so it shows immediately
      if (json?.user_id) {
        setUsers((prev:any[] = []) => [{ id: json.user_id, email: newUser.email, full_name: null, role: newUser.role ?? "staff" }, ...prev]);
        setUserRolesMap((m) => ({ ...(m||{}), [json.user_id]: newUser.role ?? "staff" }));
      } else {
        await refreshUsers();
      }
      setNewUser({ email: "", role: "staff" });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create staff");
    }
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

  function generateTempPassword() {
    const rand = Math.random().toString(36).slice(2, 8);
    return `Adeer-${rand}-2025`;
  }

  // Save handler for New Staff Modal -> call secure API to create auth user + profile
  async function saveNewStaff(payload: NewStaffPayload) {
    setOkMsg(null); setErr(null);
    try {
      if (!payload?.email) { setErr("Email is required"); return; }
      const tempPassword = payload.tempPassword && payload.tempPassword.trim() ? payload.tempPassword.trim() : generateTempPassword();
      const res = await fetch("/api/admin/create-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: payload.email,
          fullName: payload.fullName,
          role: payload.role ?? "staff",
          employmentId: payload.employmentId,
          tempPassword,
          phone: payload.phone,
          nationality: payload.nationality,
          joiningDate: payload.joiningDate,
          address: payload.address,
          passportNumber: payload.passportNumber,
          passportIssueDate: payload.passportIssueDate,
          passportExpiryDate: payload.passportExpiryDate,
          idNumber: payload.idNumber,
          idExpiryDate: payload.idExpiryDate,
          driverLicenseNumber: payload.driverLicenseNumber,
          driverLicenseExpiryDate: payload.driverLicenseExpiryDate,
          notes: payload.notes,
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create staff");
      const shownPass = json?.tempPassword || tempPassword;
      setLastCreated({ email: payload.email, tempPassword: shownPass });
      setOkMsg(`Staff account created. Temporary password: ${shownPass}`);
      // Optimistically append to users table
      if (json?.user_id) {
        setUsers((prev:any[] = []) => [{ id: json.user_id, email: payload.email, full_name: payload.fullName ?? null, role: payload.role ?? "staff" }, ...prev]);
        setUserRolesMap((m) => ({ ...(m||{}), [json.user_id]: payload.role ?? "staff" }));
      } else {
        await refreshUsers();
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save staff");
    }
  }

  async function updateUserJobShift(userId: string, patch: { job_title_id?: string | null; shift_id?: string | null }) {
    setOkMsg(null); setErr(null);
    const { error } = await supabase.from("users").update(patch).eq("id", userId);
    if (error) setErr(error.message); else { setOkMsg("User updated."); await refreshUsers(); }
  }

  // Open confirmation modal
  function openConfirm(action: 'delete'|'suspend'|'unsuspend', user: { id: string; email?: string|null }) {
    setConfirmModal({ open: true, action, user });
  }

  // Execute the confirmed action
  async function runConfirmedAction() {
    if (!confirmModal.open || !confirmModal.action || !confirmModal.user) return;
    const { action, user } = confirmModal;
    setOkMsg(null); setErr(null);
    try {
      if (action === 'delete') {
        const res = await fetch('/api/admin/delete-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id }) });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to delete user');
        setOkMsg('User deleted.');
      } else if (action === 'suspend') {
        const res = await fetch('/api/admin/suspend-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id }) });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to suspend user');
        setOkMsg('User suspended.');
      } else if (action === 'unsuspend') {
        const res = await fetch('/api/admin/unsuspend-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id }) });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Failed to unsuspend user');
        setOkMsg('User unsuspended.');
      }
      await refreshUsers();
    } catch (e: any) {
      setErr(e?.message ?? 'Action failed');
    } finally {
      setConfirmModal({ open: false });
    }
  }

  // Kept for potential direct calls, but UI uses confirm modal
  async function suspendUser(userId: string) {
    setOkMsg(null); setErr(null);
    const res = await fetch('/api/admin/suspend-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || 'Failed to suspend user');
  }

  async function unsuspendUser(userId: string) {
    setOkMsg(null); setErr(null);
    const res = await fetch('/api/admin/unsuspend-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || 'Failed to unsuspend user');
  }

  async function syncAuthUsers() {
    setOkMsg(null); setErr(null);
    try {
      const res = await fetch('/api/admin/sync-users', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to sync users');
      setOkMsg(`Synced ${json?.synced ?? 0} users.`);
      await refreshUsers();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to sync users');
    }
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

  // --- Staff Cards consolidated loader (top-level) ---
  async function loadStaffCardsData() {
    if (staffCardsLoading) return; // Prevent multiple simultaneous calls
    
    try {
      setStaffCardsLoading(true);
      setErr(null);
      console.log("[loadStaffCardsData] Starting minimal load...");
      
      // Just load users and roles - minimal approach
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id,email,full_name,role")
        .order("email");
        
      if (usersError) {
        console.error("[loadStaffCardsData] Users error:", usersError);
        setErr("Failed to load users: " + usersError.message);
        setStaffCardsLoading(false);
        return;
      }
      
      console.log("[loadStaffCardsData] Users loaded:", users?.length || 0);
      
      // Try to load user_roles
      let roles: any[] = [];
      try {
        const rolesRes = await supabase.from("user_roles").select("user_id,role");
        roles = rolesRes.data || [];
      } catch (err) {
        console.warn("[loadStaffCardsData] user_roles failed:", err);
      }
        
      // Try to load staff_cards
      let cards: any[] = [];
      try {
        const cardsRes = await supabase.from("staff_cards").select("user_id,avatar_url,card_url,file_url");
        cards = cardsRes.data || [];
      } catch (err) {
        console.warn("[loadStaffCardsData] staff_cards failed:", err);
      }
      
      console.log("[loadStaffCardsData] Roles:", roles?.length || 0, "Cards:", cards?.length || 0);
      
      // Create role map
      const roleMap: Record<string, string> = {};
      (roles || []).forEach((r: any) => { roleMap[r.user_id] = r.role; });
      
      // Create card map  
      const cardMap: Record<string, any> = {};
      (cards || []).forEach((r: any) => { cardMap[r.user_id] = r; });
      
      // Create simple staff cards
      const merged = (users || []).map((u: any) => ({
        user_id: u.id,
        name: u.full_name || u.email || u.id,
        email: u.email,
        role: roleMap[u.id] || u.role || "staff",
        docs_count: 0,
        warnings_count: 0,
        status: "—",
        last_ts: null,
        onClock: false,
        has_card: !!cardMap[u.id],
        card_url: cardMap[u.id]?.card_url || cardMap[u.id]?.file_url || null,
        avatar_url: cardMap[u.id]?.avatar_url || null,
      }));
      
      setStaffCards(merged);
      console.log("[loadStaffCardsData] Successfully loaded", merged.length, "staff cards");
      
    } catch (e: any) {
      console.error("[loadStaffCardsData] Failed:", e);
      setErr("Failed to load staff cards: " + (e?.message || "Unknown error"));
      setStaffCards([]);
    } finally {
      setStaffCardsLoading(false);
    }
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
    const name = teamName.trim();
    // Return inserted row and update UI immediately
    const { data, error } = await supabase.from("teams").insert({ name }).select("id,name").single();
    if (error) {
      setErr(error.message);
    } else {
      setTeamName("");
      setTeams((prev)=> prev && Array.isArray(prev) ? [...prev, data as any] : [data as any]);
      setOkMsg("Team created.");
    }
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
    try {
      const res = await Promise.all([
        supabase.from("job_titles").select("*").order("name"),
        supabase.from("shifts").select("*").order("name"),
        supabase.from("holidays").select("*").order("date"),
        supabase.from("break_rules").select("*").order("name"),
      ]);
      if (res[0].data) setJobTitles(res[0].data);
      if (res[1].data) setShifts(res[1].data);
      if (res[2].data) setHolidays(res[2].data);
      if (res[3].data) setBreakRules(res[3].data);
      // Log any errors without crashing
      res.forEach((r, i) => {
        if (r.error) console.warn(`[settings] Promise.all[${i}] error:`, r.error);
      });
    } catch (e) {
      console.error("[settings] loadSettingsData failed:", e);
    }
  }
  async function addJobTitle() {
    if (!newJobTitle.trim()) return;
    const name = newJobTitle.trim();
    const { data, error } = await supabase
      .from("job_titles")
      .insert({ name })
      .select("*")
      .single();
    if (error) {
      setErr(error.message);
    } else {
      setNewJobTitle("");
      setOkMsg("Job title added.");
      setJobTitles((list: any[] = []) => [...list, (data as any)]);
    }
  }
  async function addShift() {
    if (!newShift.name.trim() || !newShift.duration_minutes) return;
    // If start_time provided and end_time missing, auto-calc end from hours
    let payload: any = { ...newShift };
    if (payload.start_time && !payload.end_time) {
      const end = computeEndFromStart(payload.start_time, payload.duration_minutes);
      payload.end_time = end;
    }
    const { data, error } = await supabase
      .from("shifts")
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      setErr(error.message);
    } else {
      setNewShift({ name: "", duration_minutes: 480 });
      setOkMsg("Shift added.");
      setShifts((list: any[] = []) => [...list, (data as any)]);
    }
  }
  async function addHoliday() {
    if (!newHoliday.date) return;
    const payload: any = { date: newHoliday.date, name: newHoliday.name || null, recurring: newHoliday.recurring ?? false };
    const { data, error } = await supabase
      .from("holidays")
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      setErr(error.message);
    } else {
      setNewHoliday({ date: "", name: "", recurring: false });
      setOkMsg("Holiday added.");
      setHolidays((list: any[] = []) => [...list, (data as any)]);
    }
  }

  // Delete helpers
  async function deleteJobTitle(id: string) {
    if (!confirm('Delete this job title?')) return;
    const { error } = await supabase.from('job_titles').delete().eq('id', id);
    if (error) setErr(error.message); else {
      setOkMsg('Job title deleted.');
      setJobTitles((list) => list.filter((jt: any) => jt.id !== id));
    }
  }
  async function deleteShift(id: string) {
    if (!confirm('Delete this shift?')) return;
    const { error } = await supabase.from('shifts').delete().eq('id', id);
    if (error) setErr(error.message); else {
      setOkMsg('Shift deleted.');
      setShifts((list) => list.filter((sh: any) => sh.id !== id));
    }
  }
  async function deleteHoliday(dateStr: string) {
    if (!confirm('Delete this holiday?')) return;
    const { error } = await supabase.from('holidays').delete().eq('date', dateStr);
    if (error) setErr(error.message); else {
      setOkMsg('Holiday deleted.');
      setHolidays((list) => list.filter((h: any) => (h.date ?? h.day) !== dateStr));
    }
  }
  async function deleteBreakRule(id: string) {
    if (!confirm('Delete this break rule?')) return;
    const { error } = await supabase.from('break_rules').delete().eq('id', id);
    if (error) setErr(error.message); else {
      setOkMsg('Break rule deleted.');
      setBreakRules((list) => list.filter((b: any) => b.id !== id));
    }
  }
  async function addBreakRule() {
    if (!newBreakRule.name.trim()) return;
    const { error } = await supabase.from("break_rules").insert(newBreakRule);
    if (error) setErr(error.message); else { setNewBreakRule({ name: "", minutes: 60 }); setOkMsg("Break rule added."); await loadSettingsData(); }
  }

  // Helper: compute end time as HH:MM from start HH:MM plus duration minutes (wrap 24h)
  function computeEndFromStart(startHHMM: string, durationMin: number): string {
    const m = /^([0-9]{1,2}):([0-9]{2})$/.exec(startHHMM);
    if (!m) return startHHMM;
    const h = Math.max(0, Math.min(23, parseInt(m[1], 10)));
    const min = Math.max(0, Math.min(59, parseInt(m[2], 10)));
    const startTotal = h * 60 + min;
    const endTotal = (startTotal + (durationMin || 0)) % (24 * 60);
    const eh = Math.floor(endTotal / 60).toString().padStart(2, '0');
    const em = Math.floor(endTotal % 60).toString().padStart(2, '0');
    return `${eh}:${em}`;
  }

  // Inline edit handlers — Job Titles
  function startEditJobTitle(jt: any) {
    setEditingJobTitleId(jt.id);
    setEditingJobTitleName(jt.name || "");
  }
  function cancelEditJobTitle() {
    setEditingJobTitleId(null);
    setEditingJobTitleName("");
  }
  async function saveEditJobTitle() {
    if (!editingJobTitleId) return;
    const name = editingJobTitleName.trim();
    if (!name) { setErr('Name is required'); return; }
    const { error } = await supabase.from('job_titles').update({ name }).eq('id', editingJobTitleId);
    if (error) setErr(error.message); else {
      setOkMsg('Job title updated.');
      setJobTitles((list: any[]) => list.map((jt: any) => jt.id === editingJobTitleId ? { ...jt, name } : jt));
      setEditingJobTitleId(null);
      setEditingJobTitleName("");
    }
  }

  // Inline edit handlers — Shifts
  function startEditShift(sh: any) {
    setEditingShiftId(sh.id);
    setEditingShift({
      name: sh.name || "",
      duration_minutes: Number(sh.duration_minutes || 0),
      start_time: sh.start_time || "",
      end_time: sh.end_time || "",
    });
  }
  function cancelEditShift() {
    setEditingShiftId(null);
    setEditingShift({ name: "", duration_minutes: 480 });
  }
  async function saveEditShift() {
    if (!editingShiftId) return;
    const payload: any = {
      name: (editingShift.name || '').trim(),
      duration_minutes: editingShift.duration_minutes,
      start_time: editingShift.start_time || null,
      end_time: editingShift.end_time || null,
    };
    if (!payload.name || !payload.duration_minutes) { setErr('Shift name and duration are required'); return; }
    const { error } = await supabase.from('shifts').update(payload).eq('id', editingShiftId);
    if (error) setErr(error.message); else {
      setOkMsg('Shift updated.');
      setShifts((list: any[]) => list.map((sh: any) => sh.id === editingShiftId ? { ...sh, ...payload } : sh));
      setEditingShiftId(null);
      setEditingShift({ name: "", duration_minutes: 480 });
    }
  }

  return (
    <RoleGate allow={["hr", "ceo"]}>
      <div className="space-y-6 p-4 md:p-6">
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

          <SettingsButton />
          </div>

        {/* Daily Quote */}
        <DailyQuote />

        {/* Quick Actions: Punch In/Out */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => logAttendance("check_in")}
            disabled={punchLoading}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed 
              ${isOnClock
                ? 'bg-emerald-600 text-white hover:bg-emerald-600 ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/30 animate-pulse'
                : (goldMode && role === 'ceo'
                  ? 'bg-[#D4AF37] text-black hover:bg-[#c6a232]'
                  : 'bg-brand-primary text-white hover:bg-brand-primary/90')}
            `}
          >
            {isOnClock ? 'Punched In' : 'Punch In'}
          </button>
          {isOnClock && (
            <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              You’re punched in
            </span>
          )}
          <button
            onClick={() => logAttendance("check_out")}
            disabled={punchLoading}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed 
              ${isOnClock
                ? 'bg-rose-600 text-white hover:bg-rose-600 ring-2 ring-rose-400 shadow-lg shadow-rose-500/30 animate-pulse'
                : (goldMode && role === 'ceo'
                  ? 'bg-[#2b2b2b] text-white hover:bg-black/80'
                  : 'bg-gray-800 text-white hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600')}
            `}
          >
            Punch Out
          </button>
        </div>

        {/* Tabs */}
        <nav className={`flex gap-2 overflow-x-auto rounded-lg border p-1 text-sm backdrop-blur supports-[backdrop-filter]:backdrop-blur-md ${goldMode && role === 'ceo' ? 'bg-[#1a1400]/40 border-[#D4AF37]/30' : 'bg-white/60 dark:bg-black/20 border-brand-primary/20'}`} aria-label="Sections">
          <button onClick={() => setTab("overview")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "overview" ? (goldMode && role === 'ceo' ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary shadow-[0_0_12px_rgba(77,107,241,0.35)]") : (goldMode && role === 'ceo' ? "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10" : "opacity-80 hover:opacity-100 hover:text-brand-primary hover:bg-brand-primary/10")}`}>Overview</button>
          <button onClick={() => setTab("approvals")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "approvals" ? (goldMode && role === 'ceo' ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary shadow-[0_0_12px_rgba(77,107,241,0.35)]") : (goldMode && role === 'ceo' ? "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10" : "opacity-80 hover:opacity-100 hover:text-brand-primary hover:bg-brand-primary/10")}`}>Approvals</button>
          <button onClick={() => setTab("staff")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "staff" ? (goldMode && role === 'ceo' ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary shadow-[0_0_12px_rgba(77,107,241,0.35)]") : (goldMode && role === 'ceo' ? "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10" : "opacity-80 hover:opacity-100 hover:text-brand-primary hover:bg-brand-primary/10")}`}>Users</button>
          <button onClick={() => setTab("cards")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "cards" ? (goldMode && role === 'ceo' ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary shadow-[0_0_12px_rgba(77,107,241,0.35)]") : (goldMode && role === 'ceo' ? "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10" : "opacity-80 hover:opacity-100 hover:text-brand-primary hover:bg-brand-primary/10")}`}>Staff Cards</button>
          <button onClick={() => setTab("settings")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "settings" ? (goldMode && role === 'ceo' ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary shadow-[0_0_12px_rgba(77,107,241,0.35)]") : (goldMode && role === 'ceo' ? "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10" : "opacity-80 hover:opacity-100 hover:text-brand-primary hover:bg-brand-primary/10")}`}>Settings</button>
          <button onClick={() => setTab("teams")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "teams" ? (goldMode && role === 'ceo' ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary shadow-[0_0_12px_rgba(77,107,241,0.35)]") : (goldMode && role === 'ceo' ? "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10" : "opacity-80 hover:opacity-100 hover:text-brand-primary hover:bg-brand-primary/10")}`}>Teams</button>
          <button onClick={() => setTab("reports")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "reports" ? (goldMode && role === 'ceo' ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary shadow-[0_0_12px_rgba(77,107,241,0.35)]") : (goldMode && role === 'ceo' ? "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10" : "opacity-80 hover:opacity-100 hover:text-brand-primary hover:bg-brand-primary/10")}`}>Reports</button>
          <button onClick={() => setTab("warnings")} className={`rounded-md px-3 py-1.5 transition-all duration-200 ${tab === "warnings" ? (goldMode && role === 'ceo' ? "bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.35)]" : "bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary shadow-[0_0_12px_rgba(77,107,241,0.35)]") : (goldMode && role === 'ceo' ? "opacity-80 hover:opacity-100 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10" : "opacity-80 hover:opacity-100 hover:text-brand-primary hover:bg-brand-primary/10")}`}>Warnings</button>
        </nav>

        

        {/* Overview Tab */}
        {tab === "overview" && (
        <>
        {/* CEO Broadcast in its own section (outside the Overview grid) */}
        <section className={`rounded-xl border p-4 ${goldMode && role === 'ceo' ? 'border-[#D4AF37]/30' : 'border-brand-primary/20'}`}>
          <CEOBroadcast />
        </section>

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
                  {inout.slice(0, 12).map((r: any) => {
                    const s = (r.status ?? r.last_event ?? "")?.toString().toLowerCase();
                    const onClock = ["present", "working", "checked_in", "in"].includes(s) || (r.last_event === "check_in");
                    const nameColor = onClock ? "text-emerald-300 drop-shadow-[0_0_6px_rgba(16,185,129,0.45)]" : "text-rose-300 drop-shadow-[0_0_6px_rgba(244,63,94,0.45)]";
                    const statusColor = onClock ? "text-emerald-400" : "text-rose-400";
                    const timerText = onClock && r.last_ts ? ` · ${fmtDuration(Math.max(0, nowMs - new Date(r.last_ts).getTime()))}` : "";
                    return (
                      <li key={r.user_id} className="flex items-center justify-between py-1">
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
        </>
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

          {/* Staff Admin + HR Folders (combined) */}
          {tab === "staff" && (
          <section className="rounded-lg border p-4 space-y-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-medium">Users</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={refreshUserRoles}
                  className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-white/5"
                >
                  Refresh Roles
                </button>
                <button
                  onClick={syncAuthUsers}
                  className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-white/5"
                >
                  Sync Auth Users
                </button>
                <button
                  onClick={() => setOpenNewStaff(true)}
                  className={`inline-flex items-center rounded-md px-3 py-2 text-xs font-medium shadow-sm ${goldMode && role === 'ceo' ? 'bg-[#D4AF37] text-black hover:bg-[#c6a232]' : 'bg-brand-primary text-white hover:bg-brand-primary/90'}`}
                >
                  Create New Staff
                </button>
              </div>
            </div>
            {lastCreated && (
              <div className="mb-3 flex items-center justify-between rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-900/20">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span>
                    <strong>Staff created:</strong> {lastCreated.email} — <strong>Temp password:</strong> {lastCreated.tempPassword}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={()=>navigator.clipboard.writeText(`${lastCreated.email} ${lastCreated.tempPassword}`)} className="rounded-md border px-2 py-1 text-xs">Copy both</button>
                  <button type="button" onClick={()=>navigator.clipboard.writeText(lastCreated.tempPassword)} className="rounded-md border px-2 py-1 text-xs">Copy password</button>
                </div>
              </div>
            )}
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
                        <div className="flex items-center gap-2">
                          <select value={userRolesMap[u.id] ?? u.role} onChange={(e) => updateUserRoleCentral(u.id, e.target.value)} className="rounded-md border px-2 py-1 text-xs">
                            <option value="staff">staff</option>
                            <option value="assistant_manager">assistant_manager</option>
                            <option value="manager">manager</option>
                            <option value="hr">hr</option>
                            <option value="ceo">ceo</option>
                          </select>
                          <button
                            onClick={() => openConfirm('suspend', { id: u.id, email: u.email })}
                            className="rounded-md border px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                            title="Suspend user"
                          >
                            Suspend
                          </button>
                          <button
                            onClick={() => openConfirm('unsuspend', { id: u.id, email: u.email })}
                            className="rounded-md border px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                            title="Unsuspend user"
                          >
                            Unsuspend
                          </button>
                          <button
                            onClick={() => openConfirm('delete', { id: u.id, email: u.email })}
                            className="rounded-md border px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                            title="Delete user"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Removed HR Folders upload form as requested */}
          </section>
          )}

          {/* Settings */}
          {tab === "settings" && (
          <section className="rounded-lg border p-4">
            <h2 className="mb-2 text-lg font-medium">Settings</h2>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-md border p-3">
                  <h3 className="mb-2 text-sm font-semibold">Job Titles</h3>
                  <div className="mb-2 flex gap-2">
                    <input value={newJobTitle} onChange={(e) => setNewJobTitle(e.target.value)} placeholder="e.g., Accountant" className="flex-1 rounded-md border px-3 py-2" />
                    <button onClick={addJobTitle} className="rounded-md bg-brand-primary px-3 py-2 text-white">Add</button>
                  </div>
                  <ul className="max-h-36 overflow-auto text-xs">
                    {jobTitles.map((jt) => (
                      <li key={jt.id} className="flex items-center justify-between gap-2 border-b py-1 last:border-b-0">
                        {editingJobTitleId === jt.id ? (
                          <>
                            <input value={editingJobTitleName} onChange={(e)=>setEditingJobTitleName(e.target.value)} className="flex-1 rounded border px-2 py-1" />
                            <div className="flex items-center gap-1">
                              <button onClick={saveEditJobTitle} className="rounded border px-2 py-0.5 text-[11px]">Save</button>
                              <button onClick={cancelEditJobTitle} className="rounded border px-2 py-0.5 text-[11px]">Cancel</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="flex-1">{jt.name}</span>
                            <div className="flex items-center gap-1">
                              <button onClick={() => startEditJobTitle(jt)} className="rounded border px-2 py-0.5 text-[11px]">Edit</button>
                              <button onClick={() => deleteJobTitle(jt.id)} className="rounded border px-2 py-0.5 text-[11px]">Delete</button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-md border p-3">
                  <h3 className="mb-2 text-sm font-semibold">Shifts</h3>
                  <div className="mb-2 grid grid-cols-4 gap-2">
                    <input value={newShift.name} onChange={(e) => setNewShift((s) => ({ ...s, name: e.target.value }))} placeholder="Name" className="rounded-md border px-2 py-2" />
                    <input
                      type="number"
                      step="0.25"
                      value={(newShift.duration_minutes ?? 0) / 60}
                      onChange={(e) => {
                        const hours = parseFloat(e.target.value || '0');
                        const minutes = Math.max(0, Math.round(hours * 60));
                        setNewShift((s) => ({
                          ...s,
                          duration_minutes: minutes,
                          end_time: s.start_time ? computeEndFromStart(s.start_time, minutes) : s.end_time
                        }));
                      }}
                      placeholder="Hours"
                      className="rounded-md border px-2 py-2"
                    />
                    <input
                      type="time"
                      value={newShift.start_time ?? ""}
                      onChange={(e) => setNewShift((s) => ({
                        ...s,
                        start_time: e.target.value,
                        end_time: e.target.value && s.duration_minutes ? computeEndFromStart(e.target.value, s.duration_minutes) : s.end_time
                      }))}
                      className="rounded-md border px-2 py-2"
                    />
                    <input type="time" value={newShift.end_time ?? ""} onChange={(e) => setNewShift((s) => ({ ...s, end_time: e.target.value }))} className="rounded-md border px-2 py-2" />
                  </div>
                  <button onClick={addShift} className="rounded-md bg-brand-primary px-3 py-2 text-white">Add</button>
                  <ul className="mt-2 max-h-36 overflow-auto text-xs">
                    {shifts.map((sh) => {
                      const isEditing = editingShiftId === sh.id;
                      const hrs = (Number((isEditing ? editingShift.duration_minutes : sh.duration_minutes) || 0) / 60).toFixed(2).replace(/\.00$/, '');
                      const range = !isEditing && [sh.start_time, sh.end_time].every(Boolean) ? ` (${sh.start_time} - ${sh.end_time})` : '';
                      return (
                        <li key={sh.id} className="flex items-center justify-between gap-2 border-b py-1 last:border-b-0">
                          {isEditing ? (
                            <div className="flex flex-1 items-center gap-2">
                              <input value={editingShift.name} onChange={(e)=>setEditingShift((s)=>({...s, name: e.target.value}))} className="min-w-[140px] rounded border px-2 py-1" />
                              <input type="number" step="0.25" value={(editingShift.duration_minutes??0)/60} onChange={(e)=>{
                                const h = parseFloat(e.target.value||'0');
                                setEditingShift((s)=>({...s, duration_minutes: Math.max(0, Math.round(h*60))}));
                              }} className="w-20 rounded border px-2 py-1" />
                              <input type="time" value={editingShift.start_time ?? ''} onChange={(e)=>setEditingShift((s)=>({...s, start_time: e.target.value}))} className="rounded border px-2 py-1" />
                              <input type="time" value={editingShift.end_time ?? ''} onChange={(e)=>setEditingShift((s)=>({...s, end_time: e.target.value}))} className="rounded border px-2 py-1" />
                            </div>
                          ) : (
                            <span className="flex-1">{sh.name} — {hrs} hrs{range}</span>
                          )}
                          <div className="flex items-center gap-1">
                            {isEditing ? (
                              <>
                                <button onClick={saveEditShift} className="rounded border px-2 py-0.5 text-[11px]">Save</button>
                                <button onClick={cancelEditShift} className="rounded border px-2 py-0.5 text-[11px]">Cancel</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEditShift(sh)} className="rounded border px-2 py-0.5 text-[11px]">Edit</button>
                                <button onClick={() => deleteShift(sh.id)} className="rounded border px-2 py-0.5 text-[11px]">Delete</button>
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="rounded-md border p-3">
                  <h3 className="mb-2 text-sm font-semibold">Holidays</h3>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <input type="date" value={newHoliday.date} onChange={(e) => setNewHoliday((s) => ({ ...s, date: e.target.value }))} className="rounded-md border px-3 py-2" />
                    <input value={newHoliday.name} onChange={(e) => setNewHoliday((s) => ({ ...s, name: e.target.value }))} placeholder="Name (optional)" className="rounded-md border px-3 py-2" />
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={!!newHoliday.recurring} onChange={(e) => setNewHoliday((s)=> ({...s, recurring: e.target.checked}))} /> Recurring
                    </label>
                    <button onClick={addHoliday} className="rounded-md bg-brand-primary px-3 py-2 text-white">Add</button>
                  </div>
                  <ul className="max-h-36 overflow-auto text-xs">
                    {holidays.map((h: any) => {
                      const dateStr = h.date ?? h.day; // support legacy
                      return (
                        <li key={dateStr} className="flex items-center justify-between border-b py-1 last:border-b-0">
                          <span>{new Date(dateStr).toLocaleDateString()} {h.name ? `— ${h.name}` : ''} {h.recurring ? '(recurring)' : ''}</span>
                          <button onClick={() => deleteHoliday(dateStr)} className="rounded border px-2 py-0.5 text-[11px]">Delete</button>
                        </li>
                      );
                    })}
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
                    {breakRules.map((b) => (
                      <li key={b.id} className="flex items-center justify-between border-b py-1 last:border-b-0">
                        <span>{b.name} — {b.minutes} mins</span>
                        <button onClick={() => deleteBreakRule(b.id)} className="rounded border px-2 py-0.5 text-[11px]">Delete</button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="text-xs opacity-70">Holidays, job titles and auto warning rules can be added later. This saves branding in `company_settings`.</p>
            </div>
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

        {/* Staff Cards Tab */}
        {tab === "cards" && (
          <section className="rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-medium">Staff Cards</h2>
              <button onClick={loadStaffCardsData} className="text-xs text-brand-primary">Refresh</button>
            </div>
            {staffCardsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent"></div>
                  <p className="mt-2 text-sm opacity-70">Loading staff cards...</p>
                </div>
              </div>
            ) : !staffCards || staffCards.length === 0 ? (
              <p className="text-sm opacity-70">No staff found.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {staffCards.map((r: any) => (
                  <li key={r.user_id}>
                    <StaffCard
                      staff={{
                        id: r.user_id,
                        full_name: r.name,
                        title: r.title ?? null,
                        team: r.team ?? null,
                        avatar_url: r.avatar_url ?? null,
                        role: r.role ?? "staff",
                        status: r.status ?? null,
                        today_check_in: null,
                        today_check_out: null,
                        warnings_count: r.warnings_count ?? 0,
                      }}
                      onShowMore={(id) => {
                        setActiveStaff({ id, full_name: r.name, title: null, team: null, avatar_url: r.avatar_url ?? null });
                        setOpenStaffModal(true);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <StaffDetailsModal open={openStaffModal} onClose={() => setOpenStaffModal(false)} staff={activeStaff} />
        <NewStaffModal open={openNewStaff} onClose={() => setOpenNewStaff(false)} onSave={saveNewStaff} goldMode={goldMode && role === 'ceo'} />

        {confirmModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmModal({ open: false })} />
            <div className="relative z-10 w-[min(460px,95vw)] rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-4 shadow-xl dark:bg-black">
              <h3 className="mb-2 text-base font-semibold">Please confirm</h3>
              <p className="mb-4 text-sm">
                {confirmModal.action === 'delete' && (
                  <>Delete user {confirmModal.user?.email ? (<b>{`"${confirmModal.user?.email}"`}</b>) : null}? This will also remove their Auth account.</>
                )}
                {confirmModal.action === 'suspend' && (
                  <>Suspend (block) user {confirmModal.user?.email ? (<b>{`"${confirmModal.user?.email}"`}</b>) : null}? They will be prevented from logging in.</>
                )}
                {confirmModal.action === 'unsuspend' && (
                  <>Unsuspend user {confirmModal.user?.email ? (<b>{`"${confirmModal.user?.email}"`}</b>) : null} and allow them to log in?</>
                )}
              </p>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setConfirmModal({ open: false })} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
                <button onClick={runConfirmedAction} className="rounded-md bg-brand-primary px-3 py-2 text-sm text-white">Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleGate>
  );
}
