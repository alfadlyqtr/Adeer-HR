"use client";
import { useState, useEffect } from "react";
import RoleGate from "@/components/RoleGate";
import CEOSnapshot from "@/components/CEOSnapshot";
import CEOBroadcast from "@/components/CEOBroadcast";
import DailyQuote from "@/components/DailyQuote";
import SettingsButton from "@/components/SettingsButton";
import StaffCard from "@/components/staff/StaffCard";
import StaffDetailsModal from "@/components/staff/StaffDetailsModal";
import { supabase } from "@/lib/supabaseClient";

/**
 * Comprehensive CEO Dashboard - Enhanced with all features
 */
export default function CEODashboardPage() {
  const [displayName, setDisplayName] = useState("");
  const [ceoMsgDraft, setCeoMsgDraft] = useState("");
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "staff" | "attendance" | "leave" | "reports" | "message" | "cards">("overview");
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [inout, setInout] = useState<any[]>([]);
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const [saving, setSaving] = useState(false);
  
  // Filters
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  
  // KPI cards
  const [attendancePct, setAttendancePct] = useState<number | null>(null);
  const [avgOvertimePerStaff, setAvgOvertimePerStaff] = useState<number | null>(null);
  const [absenteeismRate, setAbsenteeismRate] = useState<number | null>(null);
  const [violationsCount, setViolationsCount] = useState<number | null>(null);
  
  // Staff & Teams
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffTotals, setStaffTotals] = useState<{ total: number; withShift: number; active: number; inactive: number } | null>(null);
  const [teamsData, setTeamsData] = useState<any[]>([]);
  const [topPerformers, setTopPerformers] = useState<any[]>([]);
  const [underperformers, setUnderperformers] = useState<any[]>([]);
  
  // Staff Cards
  const [staffCards, setStaffCards] = useState<any[]>([]);
  const [openStaffModal, setOpenStaffModal] = useState(false);
  const [activeStaff, setActiveStaff] = useState<any | null>(null);
  
  // Attendance & Shifts
  const [weeklyTrends, setWeeklyTrends] = useState<any[]>([]);
  const [latenessHeatmap, setLatenessHeatmap] = useState<any[]>([]);
  const [lateAbsentByDept, setLateAbsentByDept] = useState<any[]>([]);
  const [overtimeData, setOvertimeData] = useState<any[]>([]);
  const [shiftCoverage, setShiftCoverage] = useState<any[]>([]);
  
  // Leave & Warnings
  const [leaveSummary, setLeaveSummary] = useState<{ approved: number; pending: number; rejected: number } | null>(null);
  const [leaveDetails, setLeaveDetails] = useState<any[]>([]);
  const [warningsSummary, setWarningsSummary] = useState<{ total: number; lastPeriod: number; auto: number; manual: number } | null>(null);
  const [warningsDetails, setWarningsDetails] = useState<any[]>([]);
  const [spikeAlert, setSpikeAlert] = useState<string | null>(null);
  
  // Risk highlights
  const [riskList, setRiskList] = useState<Array<{ user_id: string; name: string; risk: string; severity: string }>>([]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSessionUserId(session?.user?.id ?? null);
      
      try {
        if (session?.user?.id) {
          const { data: u } = await supabase.from("users").select("full_name, email").eq("id", session.user.id).maybeSingle();
          setDisplayName(u?.full_name || session.user.user_metadata?.full_name || session.user.email || "");
        }
      } catch {}

      await refreshOverview();
      await Promise.all([
        loadKPI(),
        loadStaffAndTeams(),
        loadLeaves(),
        loadWarningsAndSpike(),
        loadRiskHighlights(),
      ]);
    })();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (tab === "overview") {
      refreshOverview();
      loadKPI();
      loadStaffAndTeams();
      loadLeaves();
      loadWarningsAndSpike();
      loadRiskHighlights();
    } else if (tab === "staff") {
      loadStaffDetails();
      loadTeamsDetails();
      loadPerformers();
    } else if (tab === "attendance") {
      loadWeeklyTrends();
      loadLatenessHeatmap();
      loadLateAbsentByDept();
      loadOvertimeData();
      loadShiftCoverage();
    } else if (tab === "leave") {
      loadLeaveDetails();
      loadWarningsDetails();
    } else if (tab === "reports") {
      loadWeeklyTrends();
      loadLatenessHeatmap();
    } else if (tab === "cards") {
      loadStaffCardsData();
    }
  }, [tab]);

  useEffect(() => {
    loadKPI();
    loadLeaves();
    loadWarningsAndSpike();
    loadRiskHighlights();
  }, [dateFrom, dateTo, roleFilter, departmentFilter]);

  function fmtDuration(ms: number) {
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const hh = Math.floor(s / 3600).toString().padStart(2, "0");
    const mm = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const ss = Math.floor(s % 60).toString().padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  async function refreshOverview() {
    const { data } = await supabase.from("v_current_status").select("*").order("user_id", { ascending: true });
    setInout(data ?? []);
  }

  // --- KPI Loaders ---
  async function loadKPI() {
    try {
      // Attendance %
      let latestPct: number | null = null;
      try {
        const { data } = await supabase.from("v_weekly_trends").select("attendance_pct,pct").order("day", { ascending: false }).limit(1);
        if (data && data.length) {
          const n = Number((data[0] as any).attendance_pct ?? (data[0] as any).pct);
          if (!isNaN(n)) latestPct = Math.max(0, Math.min(100, Math.round(n)));
        }
      } catch {}
      setAttendancePct(latestPct);

      // Avg overtime
      let avgOt: number | null = null;
      try {
        const { data } = await supabase.from("v_overtime_summary").select("overtime_hours");
        if (data && data.length) {
          const vals = data.map((r: any) => Number(r.overtime_hours || 0)).filter((n: number) => !isNaN(n));
          if (vals.length) avgOt = Number((vals.reduce((a,b)=>a+b,0) / vals.length).toFixed(2));
        }
      } catch {}
      setAvgOvertimePerStaff(avgOt);

      // Absenteeism rate
      let absRate: number | null = null;
      try {
        const [absRes, snapRes] = await Promise.all([
          supabase.from("v_absence_30d").select("*").limit(50000),
          supabase.from("v_ceo_snapshot").select("*").maybeSingle(),
        ]);
        const absCount = (absRes.data?.length ?? 0);
        const staffTotal = Number((snapRes.data as any)?.staff_total ?? 0);
        if (staffTotal > 0) absRate = Number(((absCount / staffTotal) * 100).toFixed(1));
      } catch {}
      setAbsenteeismRate(absRate);

      // Violations
      let viol = 0;
      try {
        let q = supabase.from("warnings").select("id", { count: "exact", head: true });
        if (dateFrom) q = q.gte("created_at", dateFrom);
        if (dateTo) q = q.lte("created_at", dateTo + "T23:59:59");
        const { count } = await q;
        viol = count ?? 0;
      } catch {}
      setViolationsCount(viol);
    } catch (e) {
      console.warn("[ceo] loadKPI failed", e);
    }
  }

  async function loadStaffAndTeams() {
    try {
      const [usersRes, teamsRes] = await Promise.all([
        supabase.from("users").select("id,shift_id,email"),
        supabase.from("teams").select("id"),
      ]);
      const users = usersRes.data ?? [];
      const withShift = users.filter((u: any) => !!u.shift_id).length;
      
      // Estimate active/inactive from current status
      const { data: statusData } = await supabase.from("v_current_status").select("user_id,status,last_event");
      const statusMap: Record<string, any> = {};
      (statusData ?? []).forEach((s: any) => { statusMap[s.user_id] = s; });
      
      let active = 0;
      users.forEach((u: any) => {
        const st = statusMap[u.id];
        const s = (st?.status ?? st?.last_event ?? "")?.toString().toLowerCase();
        if (["present", "working", "checked_in", "in"].includes(s) || st?.last_event === "check_in") active++;
      });
      
      setStaffTotals({ total: users.length, withShift, active, inactive: users.length - active });
      setTeamsData(teamsRes.data ?? []);
    } catch (e) {
      setStaffTotals({ total: 0, withShift: 0, active: 0, inactive: 0 });
      setTeamsData([]);
    }
  }

  async function loadLeaves() {
    try {
      let q1 = supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "approved");
      let q2 = supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
      let q3 = supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "rejected");
      if (dateFrom) { q1 = q1.gte("start_date", dateFrom); q2 = q2.gte("start_date", dateFrom); q3 = q3.gte("start_date", dateFrom); }
      if (dateTo) { q1 = q1.lte("end_date", dateTo); q2 = q2.lte("end_date", dateTo); q3 = q3.lte("end_date", dateTo); }
      const [{ count: a = 0 }, { count: p = 0 }, { count: r = 0 }] = await Promise.all([q1, q2, q3]);
      setLeaveSummary({ approved: a || 0, pending: p || 0, rejected: r || 0 });
    } catch (e) {
      setLeaveSummary({ approved: 0, pending: 0, rejected: 0 });
    }
  }

  async function loadWarningsAndSpike() {
    try {
      let curr = supabase.from("warnings").select("id,issued_by", { count: "exact", head: false });
      if (dateFrom) curr = curr.gte("created_at", dateFrom);
      if (dateTo) curr = curr.lte("created_at", dateTo + "T23:59:59");
      const { data: currData, count: currCount = 0 } = await curr;

      // Count auto vs manual
      let autoCount = 0;
      let manualCount = 0;
      (currData ?? []).forEach((w: any) => {
        if (w.issued_by) manualCount++; else autoCount++;
      });

      // Previous period
      let prevCount = 0;
      if (dateFrom && dateTo) {
        const from = new Date(dateFrom);
        const to = new Date(dateTo);
        const diff = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000*60*60*24)));
        const prevTo = new Date(from.getTime() - 24*60*60*1000);
        const prevFrom = new Date(prevTo.getTime() - (diff-1)*24*60*60*1000);
        const { count: pc = 0 } = await supabase
          .from("warnings")
          .select("id", { count: "exact", head: true })
          .gte("created_at", prevFrom.toISOString().slice(0,10))
          .lte("created_at", prevTo.toISOString().slice(0,10) + "T23:59:59");
        prevCount = pc || 0;
      }
      const currNum = currCount ?? 0;
      setWarningsSummary({ total: currNum, lastPeriod: prevCount, auto: autoCount, manual: manualCount });
      if (prevCount > 0 && currNum > prevCount * 1.5) setSpikeAlert("⚠ Warnings spiked vs previous period"); else setSpikeAlert(null);
    } catch (e) {
      setWarningsSummary({ total: 0, lastPeriod: 0, auto: 0, manual: 0 });
      setSpikeAlert(null);
    }
  }

  async function loadRiskHighlights() {
    try {
      const list: Array<{ user_id: string; name: string; risk: string; severity: string }> = [];
      try {
        const { data } = await supabase.from("v_lateness_patterns").select("user_id,user_name,late_count,absences").order("late_count", { ascending: false }).limit(10);
        if (data && data.length) {
          data.forEach((r: any) => {
            const lateCount = Number(r.late_count || 0);
            const absences = Number(r.absences || 0);
            let severity = "low";
            if (lateCount > 5 || absences > 3) severity = "high";
            else if (lateCount > 2 || absences > 1) severity = "medium";
            list.push({ user_id: r.user_id, name: r.user_name || r.user_id, risk: `Late ${lateCount}×, Absences ${absences}`, severity });
          });
        }
      } catch {}
      if (!list.length) {
        inout.slice(0, 5).forEach((r: any) => list.push({ user_id: r.user_id, name: r.user_name || r.full_name || r.user_id, risk: String(r.status ?? r.last_event ?? "—"), severity: "low" }));
      }
      setRiskList(list);
    } catch {
      setRiskList([]);
    }
  }

  // --- Staff & Teams Tab Loaders ---
  async function loadStaffDetails() {
    try {
      let q = supabase.from("users").select("id,email,full_name,role,shift_id,job_title_id").order("email");
      if (roleFilter !== "all") q = q.eq("role", roleFilter);
      const { data } = await q;
      setStaffList(data ?? []);
    } catch {
      setStaffList([]);
    }
  }

  async function loadTeamsDetails() {
    try {
      const { data } = await supabase.from("teams").select("id,name").order("name");
      setTeamsData(data ?? []);
    } catch {
      setTeamsData([]);
    }
  }

  async function loadPerformers() {
    try {
      // Top performers: least late/absences
      const { data: top } = await supabase.from("v_lateness_patterns").select("user_id,user_name,late_count,absences").order("late_count", { ascending: true }).limit(5);
      setTopPerformers(top ?? []);
      
      // Underperformers: most late/absences
      const { data: under } = await supabase.from("v_lateness_patterns").select("user_id,user_name,late_count,absences").order("late_count", { ascending: false }).limit(5);
      setUnderperformers(under ?? []);
    } catch {
      setTopPerformers([]);
      setUnderperformers([]);
    }
  }

  // --- Attendance & Shifts Tab Loaders ---
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

  async function loadLateAbsentByDept() {
    try {
      // Aggregate late/absent by department (if department field exists)
      const { data } = await supabase.from("v_lateness_patterns").select("user_id,user_name,late_count,absences");
      // Group by department (placeholder - adjust if you have department field)
      setLateAbsentByDept(data ?? []);
    } catch {
      setLateAbsentByDept([]);
    }
  }

  async function loadOvertimeData() {
    try {
      const { data } = await supabase.from("v_overtime_summary").select("*").limit(100);
      setOvertimeData(data ?? []);
    } catch {
      setOvertimeData([]);
    }
  }

  async function loadShiftCoverage() {
    try {
      // Get shifts and attendance for today
      const today = new Date().toISOString().slice(0, 10);
      const [shiftsRes, attendanceRes] = await Promise.all([
        supabase.from("shifts").select("id,name"),
        supabase.from("attendance_logs").select("user_id,type,ts").gte("ts", today).lte("ts", today + "T23:59:59"),
      ]);
      
      const shifts = shiftsRes.data ?? [];
      const logs = attendanceRes.data ?? [];
      
      // Count check-ins per shift (simplified - would need user.shift_id join)
      const coverage = shifts.map((sh: any) => ({
        shift_name: sh.name,
        scheduled: 0, // Would need to count users.shift_id = sh.id
        showed: logs.filter((l: any) => l.type === "check_in").length,
      }));
      
      setShiftCoverage(coverage);
    } catch {
      setShiftCoverage([]);
    }
  }

  // --- Staff Cards Tab Loader ---
  async function loadStaffCardsData() {
    try {
      // Compute today's date window
      const now = new Date();
      const start = new Date(now); start.setHours(0,0,0,0);
      const end = new Date(now); end.setHours(23,59,59,999);

      const [usersRes, filesRes, warnsRes, statusRes, cardsRes, rolesRes, todayLogsRes] = await Promise.all([
        supabase.from("users").select("id,email,full_name,role").order("email"),
        supabase.from("staff_files").select("user_id"),
        supabase.from("warnings").select("user_id"),
        supabase.from("v_current_status").select("user_id,status,last_event,last_ts"),
        supabase.from("staff_cards").select("user_id,card_url,avatar_url,created_at"),
        supabase.from("user_roles").select("user_id,role"),
        supabase.from("attendance_logs").select("user_id,type,ts").gte("ts", start.toISOString()).lte("ts", end.toISOString())
      ]);
      const users = usersRes.data ?? [];
      const files = filesRes.data ?? [];
      const warns = warnsRes.data ?? [];
      const stats = statusRes.data ?? [];
      const cards = cardsRes.data ?? [];
      const roles = rolesRes.data ?? [];
      const todayLogs = todayLogsRes?.data ?? [];
      const fileCount: Record<string, number> = {};
      files.forEach((r: any) => { fileCount[r.user_id] = (fileCount[r.user_id] || 0) + 1; });
      const warnCount: Record<string, number> = {};
      warns.forEach((r: any) => { warnCount[r.user_id] = (warnCount[r.user_id] || 0) + 1; });
      const statusMap: Record<string, any> = {};
      stats.forEach((r: any) => { statusMap[r.user_id] = r; });
      const cardMap: Record<string, any> = {};
      cards.forEach((r: any) => { cardMap[r.user_id] = r; });
      const roleMap: Record<string, string> = {};
      roles.forEach((r: any) => { roleMap[r.user_id] = r.role; });
      // Build today's in/out map
      const todayMap: Record<string, { in?: string|null; out?: string|null }> = {};
      for (const log of todayLogs as any[]) {
        const uid = log.user_id; if (!uid) continue;
        const ts = log.ts as string; const type = String(log.type||'').toLowerCase();
        if (!todayMap[uid]) todayMap[uid] = { in: null, out: null };
        if (type === 'check_in') {
          if (!todayMap[uid].in || ts < (todayMap[uid].in as string)) todayMap[uid].in = ts;
        } else if (type === 'check_out') {
          if (!todayMap[uid].out || ts > (todayMap[uid].out as string)) todayMap[uid].out = ts;
        }
      }
      const merged = users.map((u: any) => {
        const st = statusMap[u.id] || {};
        const s = (st.status ?? st.last_event ?? "")?.toString().toLowerCase();
        const onClock = ["present", "working", "checked_in", "in"].includes(s) || (st.last_event === "check_in");
        const today = todayMap[u.id] || { in: null, out: null };
        // Fallback: if on clock but no explicit today check_in, use last_ts as anchor
        let todayIn = today.in || null;
        if (onClock && !todayIn && st.last_ts) {
          todayIn = st.last_ts;
        }
        return {
          user_id: u.id,
          name: u.full_name || u.email || u.id,
          email: u.email,
          role: roleMap[u.id] || u.role || "staff",
          docs_count: fileCount[u.id] || 0,
          warnings_count: warnCount[u.id] || 0,
          status: st.status ?? st.last_event ?? "—",
          last_ts: st.last_ts ?? null,
          onClock,
          has_card: !!cardMap[u.id],
          card_url: cardMap[u.id]?.card_url || null,
          avatar_url: cardMap[u.id]?.avatar_url || null,
          today_check_in: todayIn,
          today_check_out: today.out || null,
        };
      });
      setStaffCards(merged);
    } catch (e) {
      console.error("[cards] loadStaffCardsData failed", e);
      setStaffCards([]);
    }
  }

  // --- Leave & Warnings Tab Loaders ---
  async function loadLeaveDetails() {
    try {
      let q = supabase.from("leave_requests").select("id,user_id,type,start_date,end_date,status").order("start_date", { ascending: false }).limit(50);
      if (dateFrom) q = q.gte("start_date", dateFrom);
      if (dateTo) q = q.lte("end_date", dateTo);
      const { data } = await q;
      setLeaveDetails(data ?? []);
    } catch {
      setLeaveDetails([]);
    }
  }

  async function loadWarningsDetails() {
    try {
      let q = supabase.from("warnings").select("id,user_id,reason,issued_by,created_at").order("created_at", { ascending: false }).limit(50);
      if (dateFrom) q = q.gte("created_at", dateFrom);
      if (dateTo) q = q.lte("created_at", dateTo + "T23:59:59");
      const { data } = await q;
      setWarningsDetails(data ?? []);
    } catch {
      setWarningsDetails([]);
    }
  }

  // --- CEO Message ---
  async function loadCeoMessage() {
    const { data } = await supabase.from("broadcast_messages").select("message").order("created_at", { ascending: false }).limit(1).single();
    setCeoMsgDraft(data?.message ?? "");
  }

  async function saveCeoMessage() {
    setOkMsg(null);
    setErr(null);
    setSaving(true);
    try {
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
      try { if (ceoMsgDraft) localStorage.setItem("ceo_broadcast_last", ceoMsgDraft); } catch {}
      const event = new CustomEvent('broadcast-refresh');
      window.dispatchEvent(event);
    } catch (error: any) {
      setErr(error?.message || 'Failed to save broadcast');
    } finally {
      setSaving(false);
    }
  }

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

  // --- Export Helpers ---
  function exportCSV(filename: string, rows: any[]) {
    if (!rows || rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(",")].concat(rows.map(r => headers.map(h => JSON.stringify((r as any)[h] ?? "")).join(","))).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  async function exportAllReports() {
    try {
      const [snapshot, trends, heatmap, overtime, leaves, warnings] = await Promise.all([
        supabase.from("v_ceo_snapshot").select("*"),
        supabase.from("v_weekly_trends").select("*"),
        supabase.from("v_lateness_heatmap").select("*").limit(1000),
        supabase.from("v_overtime_summary").select("*").limit(1000),
        supabase.from("leave_requests").select("*").limit(1000),
        supabase.from("warnings").select("*").limit(1000),
      ]);
      
      if (snapshot.data && snapshot.data.length) exportCSV("ceo_snapshot.csv", snapshot.data);
      if (trends.data && trends.data.length) exportCSV("weekly_trends.csv", trends.data);
      if (heatmap.data && heatmap.data.length) exportCSV("lateness_heatmap.csv", heatmap.data);
      if (overtime.data && overtime.data.length) exportCSV("overtime_summary.csv", overtime.data);
      if (leaves.data && leaves.data.length) exportCSV("leave_requests.csv", leaves.data);
      if (warnings.data && warnings.data.length) exportCSV("warnings.csv", warnings.data);
      
      setOkMsg("All reports exported successfully!");
    } catch (e: any) {
      setErr("Export failed: " + (e?.message ?? "Unknown error"));
    }
  }

  const activeTabClass = "bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary shadow-[0_0_12px_theme(colors.brand.primary/0.5)]";
  const inactiveTabClass = "opacity-70 hover:opacity-100 hover:text-brand-primary hover:bg-brand-primary/10";

  return (
    <RoleGate allow={["ceo"]}>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <span className="text-xl text-brand-primary">👑</span>
            <span>Welcome, CEO {displayName}</span>
          </h1>
          
          <div className="flex items-center gap-2">
            <SettingsButton />
            <button onClick={() => logAttendance("check_in")} className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm text-white transition hover:scale-105 hover:shadow-lg">Punch In</button>
            <button onClick={() => logAttendance("check_out")} className="rounded-md bg-rose-500 px-3 py-1.5 text-sm text-white transition hover:scale-105 hover:shadow-lg">Punch Out</button>
          </div>
        </div>

        {/* Daily Quote */}
        <DailyQuote />

        {/* Filters Bar */}
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
          <div className="flex flex-col">
            <label className="text-xs opacity-70">From</label>
            <input type="date" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} className="rounded-md border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-1.5 text-sm" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs opacity-70">To</label>
            <input type="date" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} className="rounded-md border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-1.5 text-sm" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs opacity-70">Role</label>
            <select value={roleFilter} onChange={(e)=>setRoleFilter(e.target.value)} className="rounded-md border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-1.5 text-sm">
              <option value="all">All</option>
              <option value="hr">HR</option>
              <option value="manager">Manager</option>
              <option value="assistant_manager">Assistant Manager</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs opacity-70">Department</label>
            <select value={departmentFilter} onChange={(e)=>setDepartmentFilter(e.target.value)} className="rounded-md border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-1.5 text-sm">
              <option value="all">All</option>
              <option value="operations">Operations</option>
              <option value="sales">Sales</option>
              <option value="support">Support</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {spikeAlert && (
            <div className="ml-auto rounded-md bg-rose-500/10 px-3 py-1.5 text-sm text-rose-400">{spikeAlert}</div>
          )}
        </div>

        {/* Tabs */}
        <nav className="flex gap-2 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-1 text-sm backdrop-blur-md" aria-label="Sections">
          <button onClick={() => setTab("overview")} className={`rounded-lg px-3 py-1.5 transition-all duration-200 whitespace-nowrap ${tab === "overview" ? activeTabClass : inactiveTabClass}`}>📊 Overview</button>
          <button onClick={() => setTab("staff")} className={`rounded-lg px-3 py-1.5 transition-all duration-200 whitespace-nowrap ${tab === "staff" ? activeTabClass : inactiveTabClass}`}>👥 Staff & Teams</button>
          <button onClick={() => setTab("attendance")} className={`rounded-lg px-3 py-1.5 transition-all duration-200 whitespace-nowrap ${tab === "attendance" ? activeTabClass : inactiveTabClass}`}>⏰ Attendance & Shifts</button>
          <button onClick={() => setTab("leave")} className={`rounded-lg px-3 py-1.5 transition-all duration-200 whitespace-nowrap ${tab === "leave" ? activeTabClass : inactiveTabClass}`}>🏖️ Leave & Warnings</button>
          <button onClick={() => setTab("cards")} className={`rounded-lg px-3 py-1.5 transition-all duration-200 whitespace-nowrap ${tab === "cards" ? activeTabClass : inactiveTabClass}`}>🎴 Staff Cards</button>
          <button onClick={() => setTab("reports")} className={`rounded-lg px-3 py-1.5 transition-all duration-200 whitespace-nowrap ${tab === "reports" ? activeTabClass : inactiveTabClass}`}>📈 Reports</button>
          <button onClick={() => setTab("message")} className={`rounded-lg px-3 py-1.5 transition-all duration-200 whitespace-nowrap ${tab === "message" ? activeTabClass : inactiveTabClass}`}>📢 Broadcast</button>
        </nav>

        {/* Messages */}
        {okMsg && <div className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-500">{okMsg}</div>}
        {err && <div className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-500">{err}</div>}

        {/* ===== OVERVIEW TAB ===== */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* CEO Broadcast */}
            <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
              <CEOBroadcast />
            </section>

            {/* Executive Snapshot */}
            <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium">Executive Snapshot</h2>
                <button onClick={refreshOverview} className="text-xs text-brand-primary hover:underline">Refresh</button>
              </div>
              <CEOSnapshot />
            </section>

            {/* KPI Cards */}
            <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
              <h2 className="text-lg font-medium mb-4">Key Performance Indicators</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
                  <div className="text-xs opacity-70">Attendance %</div>
                  <div className="mt-1 text-2xl font-semibold">{attendancePct ?? "—"}{attendancePct !== null ? "%" : ""}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
                  <div className="text-xs opacity-70">Avg Overtime / Staff (h)</div>
                  <div className="mt-1 text-2xl font-semibold">{avgOvertimePerStaff ?? "—"}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
                  <div className="text-xs opacity-70">Absenteeism Rate</div>
                  <div className="mt-1 text-2xl font-semibold">{absenteeismRate ?? "—"}{absenteeismRate !== null ? "%" : ""}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
                  <div className="text-xs opacity-70">Policy Violations</div>
                  <div className="mt-1 text-2xl font-semibold">{violationsCount ?? "—"}</div>
                </div>
              </div>
            </section>

            {/* Staff & Teams Summary */}
            <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
              <h2 className="text-lg font-medium mb-4">Staff & Teams Summary</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
                  <div className="text-xs opacity-70">Total Staff</div>
                  <div className="mt-1 text-2xl font-semibold">{staffTotals?.total ?? "—"}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
                  <div className="text-xs opacity-70">Active Now</div>
                  <div className="mt-1 text-2xl font-semibold text-emerald-400">{staffTotals?.active ?? "—"}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
                  <div className="text-xs opacity-70">Inactive</div>
                  <div className="mt-1 text-2xl font-semibold text-rose-400">{staffTotals?.inactive ?? "—"}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
                  <div className="text-xs opacity-70">Teams</div>
                  <div className="mt-1 text-2xl font-semibold">{teamsData.length}</div>
                </div>
              </div>
            </section>

            {/* Leave & Warnings Summary */}
            <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
              <h2 className="text-lg font-medium mb-4">Leave & Warnings Summary</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
                  <div className="text-xs opacity-70">Leaves Approved</div>
                  <div className="mt-1 text-2xl font-semibold text-emerald-400">{leaveSummary?.approved ?? "—"}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
                  <div className="text-xs opacity-70">Leaves Pending</div>
                  <div className="mt-1 text-2xl font-semibold text-yellow-400">{leaveSummary?.pending ?? "—"}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
                  <div className="text-xs opacity-70">Leaves Rejected</div>
                  <div className="mt-1 text-2xl font-semibold text-rose-400">{leaveSummary?.rejected ?? "—"}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
                  <div className="text-xs opacity-70">Warnings (Current)</div>
                  <div className="mt-1 text-2xl font-semibold">{warningsSummary?.total ?? "—"}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
                  <div className="text-xs opacity-70">vs Previous Period</div>
                  <div className="mt-1 text-2xl font-semibold">{warningsSummary?.lastPeriod ?? "—"}</div>
                </div>
              </div>
              {warningsSummary && (
                <div className="mt-3 text-xs opacity-70">
                  Auto: {warningsSummary.auto} | Manual: {warningsSummary.manual}
                </div>
              )}
            </section>

            {/* At-Risk Staff */}
            <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
              <h2 className="text-lg font-medium mb-4">At-Risk Staff</h2>
              {riskList.length === 0 ? (
                <p className="text-sm opacity-70">No risk highlights.</p>
              ) : (
                <div className="space-y-2">
                  {riskList.map((r) => (
                    <div key={r.user_id} className={`flex items-center justify-between rounded-lg border p-3 ${
                      r.severity === "high" ? "border-rose-500/30 bg-rose-500/5" :
                      r.severity === "medium" ? "border-yellow-500/30 bg-yellow-500/5" :
                      "border-white/10 bg-white/5"
                    }`}>
                      <span className="font-medium">{r.name}</span>
                      <span className="text-sm opacity-80">{r.risk}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Current Staff Status */}
            <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
              <h2 className="text-lg font-medium mb-4">Current Staff Status</h2>
              {inout.length === 0 ? <p className="text-sm opacity-70">No data.</p> : (
                <div className="space-y-1 text-sm">
                  {inout.slice(0, 15).map((r: any) => {
                    const s = (r.status ?? r.last_event ?? "")?.toString().toLowerCase();
                    const onClock = ["present", "working", "checked_in", "in"].includes(s) || (r.last_event === "check_in");
                    const statusColor = onClock ? "text-emerald-400" : "text-rose-400";
                    const nameColor = onClock ? "text-emerald-300" : "text-rose-300";
                    const timerText = onClock && r.last_ts ? ` · ${fmtDuration(Math.max(0, nowMs - new Date(r.last_ts).getTime()))}` : "";

                    return (
                      <div key={r.user_id} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-b-0">
                        <span className={nameColor}>{r.user_name ?? r.full_name ?? r.user_id}</span>
                        <span className={`opacity-90 ${statusColor}`}>
                          {(r.status ?? r.last_event ?? "—") + timerText}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ===== STAFF & TEAMS TAB ===== */}
        {tab === "staff" && (
          <div className="space-y-6">
            <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
              <h2 className="text-lg font-medium mb-4">All Staff ({staffList.length})</h2>
              {staffList.length === 0 ? (
                <p className="text-sm opacity-70">No staff data.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-white/10">
                      <tr>
                        <th className="py-2 px-2">Email</th>
                        <th className="py-2 px-2">Name</th>
                        <th className="py-2 px-2">Role</th>
                        <th className="py-2 px-2">Shift</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffList.map((u: any) => (
                        <tr key={u.id} className="border-b border-white/5 last:border-b-0">
                          <td className="py-2 px-2">{u.email}</td>
                          <td className="py-2 px-2">{u.full_name || "—"}</td>
                          <td className="py-2 px-2">{u.role || "—"}</td>
                          <td className="py-2 px-2">{u.shift_id ? "✓" : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
              <h2 className="text-lg font-medium mb-4">Teams ({teamsData.length})</h2>
              {teamsData.length === 0 ? (
                <p className="text-sm opacity-70">No teams data.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {teamsData.map((t: any) => (
                    <div key={t.id} className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs opacity-70 mt-1">Team ID: {t.id}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-lg">
                <h2 className="text-lg font-medium mb-4 text-emerald-400">Top Performers</h2>
                {topPerformers.length === 0 ? (
                  <p className="text-sm opacity-70">No data.</p>
                ) : (
                  <div className="space-y-2">
                    {topPerformers.map((p: any) => (
                      <div key={p.user_id} className="flex justify-between items-center">
                        <span className="font-medium">{p.user_name || p.user_id}</span>
                        <span className="text-sm opacity-80">Late: {p.late_count || 0}, Abs: {p.absences || 0}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 shadow-lg">
                <h2 className="text-lg font-medium mb-4 text-rose-400">Underperformers</h2>
                {underperformers.length === 0 ? (
                  <p className="text-sm opacity-70">No data.</p>
                ) : (
                  <div className="space-y-2">
                    {underperformers.map((p: any) => (
                      <div key={p.user_id} className="flex justify-between items-center">
                        <span className="font-medium">{p.user_name || p.user_id}</span>
                        <span className="text-sm opacity-80">Late: {p.late_count || 0}, Abs: {p.absences || 0}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* ===== ATTENDANCE & SHIFTS TAB ===== */}
        {tab === "attendance" && (
          <div className="space-y-6">
            <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
              <h2 className="text-lg font-medium mb-4">Weekly Attendance Trends</h2>
              {weeklyTrends.length === 0 ? (
                <p className="text-sm opacity-70">No trend data.</p>
              ) : (
                <div className="space-y-3">
                  {weeklyTrends.map((r:any,i:number)=>{
                    const pct = Math.max(0, Math.min(100, Math.round(Number(r.attendance_pct ?? r.pct ?? 0))));
                    const label = r.label ?? r.day ?? r.week ?? `Week ${i+1}`;
                    return (
                      <div key={i} className="grid grid-cols-5 items-center gap-2">
                        <span className="col-span-2 truncate font-medium">{label}</span>
                        <div className="col-span-2 h-3 rounded bg-white/10 overflow-hidden">
                          <div className="h-full bg-brand-primary" style={{width: pct + '%'}} />
                        </div>
                        <span className="text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
              <h2 className="text-lg font-medium mb-4">Lateness Heatmap</h2>
              {latenessHeatmap.length === 0 ? (
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
                      {latenessHeatmap.slice(0, 20).map((row, i) => (
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
            </section>

            <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
              <h2 className="text-lg font-medium mb-4">Overtime Summary</h2>
              {overtimeData.length === 0 ? (
                <p className="text-sm opacity-70">No overtime data.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-white/10">
                      <tr>
                        {Object.keys(overtimeData[0]).map((k)=> (
                          <th key={k} className="py-2 px-2">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {overtimeData.slice(0, 20).map((row, i) => (
                        <tr key={i} className="border-b border-white/5 last:border-b-0">
                          {Object.values(row).map((v:any,j)=> (
                            <td key={j} className="py-2 px-2">{String(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
              <h2 className="text-lg font-medium mb-4">Shift Coverage (Today)</h2>
              {shiftCoverage.length === 0 ? (
                <p className="text-sm opacity-70">No shift coverage data.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {shiftCoverage.map((sc: any, i: number) => (
                    <div key={i} className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
                      <div className="font-medium">{sc.shift_name}</div>
                      <div className="text-sm opacity-70 mt-1">Scheduled: {sc.scheduled} | Showed: {sc.showed}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ===== LEAVE & WARNINGS TAB ===== */}
        {tab === "leave" && (
          <div className="space-y-6">
            <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
              <h2 className="text-lg font-medium mb-4">Leave Requests ({leaveDetails.length})</h2>
              {leaveDetails.length === 0 ? (
                <p className="text-sm opacity-70">No leave requests.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-white/10">
                      <tr>
                        <th className="py-2 px-2">User ID</th>
                        <th className="py-2 px-2">Type</th>
                        <th className="py-2 px-2">Start</th>
                        <th className="py-2 px-2">End</th>
                        <th className="py-2 px-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaveDetails.map((l: any) => (
                        <tr key={l.id} className="border-b border-white/5 last:border-b-0">
                          <td className="py-2 px-2">{l.user_id}</td>
                          <td className="py-2 px-2">{l.type || "—"}</td>
                          <td className="py-2 px-2">{l.start_date}</td>
                          <td className="py-2 px-2">{l.end_date}</td>
                          <td className="py-2 px-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                              l.status === "approved" ? "bg-emerald-500/20 text-emerald-400" :
                              l.status === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                              "bg-rose-500/20 text-rose-400"
                            }`}>
                              {l.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
              <h2 className="text-lg font-medium mb-4">Warnings ({warningsDetails.length})</h2>
              {warningsDetails.length === 0 ? (
                <p className="text-sm opacity-70">No warnings.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-white/10">
                      <tr>
                        <th className="py-2 px-2">User ID</th>
                        <th className="py-2 px-2">Reason</th>
                        <th className="py-2 px-2">Issued By</th>
                        <th className="py-2 px-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {warningsDetails.map((w: any) => (
                        <tr key={w.id} className="border-b border-white/5 last:border-b-0">
                          <td className="py-2 px-2">{w.user_id}</td>
                          <td className="py-2 px-2">{w.reason || "—"}</td>
                          <td className="py-2 px-2">{w.issued_by ? "Manual" : "Auto"}</td>
                          <td className="py-2 px-2">{w.created_at ? new Date(w.created_at).toLocaleDateString() : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ===== REPORTS TAB ===== */}
        {tab === "reports" && (
          <div className="space-y-6">
            <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
              <h2 className="text-lg font-medium mb-4">Export Reports</h2>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => window.print()} className="flex items-center gap-2 rounded-md border border-brand-primary bg-brand-primary/10 px-4 py-2 text-brand-primary transition hover:bg-brand-primary/20">
                  <span className="text-lg">📊</span> Export as PDF
                </button>
                <button onClick={() => {
                  if (latenessHeatmap.length) exportCSV("lateness_heatmap.csv", latenessHeatmap);
                }} className="flex items-center gap-2 rounded-md border border-brand-primary bg-brand-primary/10 px-4 py-2 text-brand-primary transition hover:bg-brand-primary/20">
                  <span className="text-lg">📈</span> Export Heatmap CSV
                </button>
                <button onClick={exportAllReports} className="flex items-center gap-2 rounded-md border border-brand-primary bg-brand-primary/10 px-4 py-2 text-brand-primary transition hover:bg-brand-primary/20">
                  <span className="text-lg">📦</span> Export All Reports
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
              <h2 className="text-lg font-medium mb-4">Weekly Trends</h2>
              {weeklyTrends.length === 0 ? (
                <p className="text-sm opacity-70">No trend data.</p>
              ) : (
                <div className="space-y-3">
                  {weeklyTrends.map((r:any,i:number)=>{
                    const pct = Math.max(0, Math.min(100, Math.round(Number(r.attendance_pct ?? r.pct ?? 0))));
                    const label = r.label ?? r.day ?? r.week ?? `Week ${i+1}`;
                    return (
                      <div key={i} className="grid grid-cols-5 items-center gap-2">
                        <span className="col-span-2 truncate font-medium">{label}</span>
                        <div className="col-span-2 h-3 rounded bg-white/10 overflow-hidden">
                          <div className="h-full bg-brand-primary" style={{width: pct + '%'}} />
                        </div>
                        <span className="text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
              <h2 className="text-lg font-medium mb-4">Lateness Heatmap</h2>
              {latenessHeatmap.length === 0 ? (
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
                      {latenessHeatmap.slice(0, 20).map((row, i) => (
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
            </section>
          </div>
        )}

        {/* ===== STAFF CARDS TAB ===== */}
        {tab === "cards" && (
          <div className="space-y-6">
            <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-medium">Staff Cards ({staffCards.length})</h2>
                <button onClick={loadStaffCardsData} className="text-xs text-brand-primary hover:underline">Refresh</button>
              </div>
              {staffCards.length === 0 ? (
                <p className="text-sm opacity-70">No staff found.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  {staffCards.map((r: any) => (
                    <li key={r.user_id}>
                      <StaffCard
                        staff={{
                          id: r.user_id,
                          full_name: r.name,
                          title: null,
                          team: null,
                          avatar_url: r.avatar_url ?? null,
                          role: r.role ?? "staff",
                          status: r.status ?? null,
                          today_check_in: r.today_check_in || null,
                          today_check_out: r.today_check_out || null,
                          onClock: r.onClock,
                          last_ts: r.last_ts || null,
                          warnings_count: r.warnings_count ?? 0,
                        }}
                        onShowMore={(id) => {
                          setActiveStaff({ id, full_name: r.name, title: null, team: null, avatar_url: null });
                          setOpenStaffModal(true);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Summary Stats */}
            <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
              <h2 className="text-lg font-medium mb-4">Cards Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
                  <div className="text-xs opacity-70">Total Staff</div>
                  <div className="mt-1 text-2xl font-semibold">{staffCards.length}</div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
                  <div className="text-xs opacity-70">Currently Active</div>
                  <div className="mt-1 text-2xl font-semibold text-emerald-400">
                    {staffCards.filter((c: any) => c.onClock).length}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
                  <div className="text-xs opacity-70">With ID Cards</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {staffCards.filter((c: any) => c.has_card).length}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
                  <div className="text-xs opacity-70">Total Warnings</div>
                  <div className="mt-1 text-2xl font-semibold text-rose-400">
                    {staffCards.reduce((sum: number, c: any) => sum + c.warnings_count, 0)}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ===== BROADCAST MESSAGE TAB ===== */}
        {tab === "message" && (
          <section className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-brand-primary/20 dark:bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium">Company Broadcast</h2>
              <button onClick={loadCeoMessage} className="text-xs text-brand-primary hover:underline">Load current</button>
            </div>
            <p className="mb-2 text-sm opacity-80">Write a message to appear on the home page and on everyone's overview.</p>
            <textarea
              value={ceoMsgDraft}
              onChange={(e) => setCeoMsgDraft(e.target.value)}
              placeholder="Type your message to all staff..."
              className="min-h-[140px] w-full rounded-lg border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3 focus:border-brand-primary focus:ring-brand-primary"
            />
            <div className="mt-3 flex items-center gap-2">
              <button onClick={saveCeoMessage} disabled={saving || !ceoMsgDraft.trim()} className="rounded-md bg-brand-primary px-4 py-2 text-white transition hover:scale-105 disabled:opacity-60">{saving ? 'Saving…' : 'Save Broadcast'}</button>
            </div>
            <div className="mt-4">
              <h3 className="mb-1 text-sm font-semibold">Preview</h3>
              <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏆</span>
                  <h4 className="text-base font-semibold">CEO Message</h4>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed opacity-80">{ceoMsgDraft || "(empty)"}</p>
              </div>
            </div>
          </section>
        )}

        <StaffDetailsModal open={openStaffModal} onClose={() => setOpenStaffModal(false)} staff={activeStaff} />
      </div>
    </RoleGate>
  );
}
