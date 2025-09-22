"use client";
import RoleGate from "@/components/RoleGate";
import CEOSnapshot from "@/components/CEOSnapshot";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";

export default function HRDashboard() {
  const { role } = useUserRole();
  const [inout, setInout] = useState<any[]>([]);
  const [leaveReqs, setLeaveReqs] = useState<any[]>([]);
  const [corrReqs, setCorrReqs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState<{ email: string; role: string } | null>({ email: "", role: "staff" });
  const [brand, setBrand] = useState<{ color?: string; logo_url?: string }>({});
  const [uploading, setUploading] = useState(false);
  const [fileMeta, setFileMeta] = useState<{ user_id: string; category: string; expiry_date?: string }>({ user_id: "", category: "" });
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      await Promise.all([
        refreshOverview(),
        refreshApprovals(),
        refreshUsers(),
        loadBranding(),
      ]);
    })();
  }, []);

  async function refreshOverview() {
    // v_current_status for everyone
    const { data, error } = await supabase.from("v_current_status").select("*").order("user_name", { ascending: true });
    if (!error) setInout(data ?? []);
  }

  async function refreshApprovals() {
    const [{ data: leaves }, { data: corr }] = await Promise.all([
      supabase.from("leave_requests").select("id,user_id,type,start_date,end_date,status").eq("status", "pending").order("start_date", { ascending: true }),
      supabase.from("correction_requests").select("id,user_id,requested_at,reason,status").eq("status", "pending").order("requested_at", { ascending: true }),
    ]);
    setLeaveReqs(leaves ?? []);
    setCorrReqs(corr ?? []);
  }

  async function refreshUsers() {
    const { data } = await supabase.from("users").select("id,email,full_name,role,team_id,job_title").order("full_name", { ascending: true });
    setUsers(data ?? []);
  }

  async function loadBranding() {
    const { data } = await supabase.from("company_settings").select("key,value");
    const map: any = {};
    (data ?? []).forEach((r: any) => { map[r.key] = r.value; });
    setBrand({ color: map["brand_color"], logo_url: map["brand_logo_url"] });
  }

  async function setBrandSetting(key: string, value: string) {
    setOkMsg(null); setErr(null);
    const { error } = await supabase.from("company_settings").upsert({ key, value }, { onConflict: "key" });
    if (error) { setErr(error.message); } else { setOkMsg("Branding saved."); await loadBranding(); }
  }

  async function updateUserRole(userId: string, role: string) {
    setOkMsg(null); setErr(null);
    const { error } = await supabase.from("users").update({ role }).eq("id", userId);
    if (error) setErr(error.message); else { setOkMsg("User updated."); await refreshUsers(); }
  }

  async function createBasicUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUser) return;
    setOkMsg(null); setErr(null);
    // Assumes a user provisioning flow exists; here we only insert metadata row
    const { error } = await supabase.from("users").insert({ email: newUser.email, role: newUser.role });
    if (error) setErr(error.message); else { setOkMsg("User metadata created."); await refreshUsers(); setNewUser({ email: "", role: "staff" }); }
  }

  async function updateLeaveStatus(id: string, status: "approved" | "rejected") {
    const { error } = await supabase.from("leave_requests").update({ status }).eq("id", id);
    if (error) setErr(error.message); else { setOkMsg(`Leave ${status}.`); await refreshApprovals(); }
  }

  async function updateCorrectionStatus(id: string, status: "approved" | "rejected") {
    const { error } = await supabase.from("correction_requests").update({ status }).eq("id", id);
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

  return (
    <RoleGate allow={["hr", "ceo"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">HR/CEO Dashboard</h1>
          {/* CEO badge is shown in header via HeaderBadges */}
        </div>

        {/* Tabs */}
        <nav className="flex gap-2 overflow-x-auto rounded-lg border p-1 text-sm" aria-label="Sections">
          <a className="rounded-md bg-brand-primary/10 px-3 py-1.5 font-medium text-brand-primary">Overview</a>
          <a className="rounded-md px-3 py-1.5 opacity-80 hover:opacity-100">Approvals</a>
          <a className="rounded-md px-3 py-1.5 opacity-80 hover:opacity-100">Staff Admin</a>
          <a className="rounded-md px-3 py-1.5 opacity-80 hover:opacity-100">Settings</a>
          <a className="rounded-md px-3 py-1.5 opacity-80 hover:opacity-100">HR Folders</a>
          <a className="rounded-md px-3 py-1.5 opacity-80 hover:opacity-100">Reports</a>
          {role === "ceo" && <a className="rounded-md px-3 py-1.5 opacity-80 hover:opacity-100">CEO</a>}
        </nav>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Overview */}
          <section className="rounded-lg border p-4">
            <h2 className="mb-2 text-lg font-medium">Overview</h2>
            <CEOSnapshot />
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold">Current Status</h3>
              {inout.length === 0 ? <p className="text-sm opacity-70">No data.</p> : (
                <ul className="text-sm">
                  {inout.slice(0, 12).map((r: any) => (
                    <li key={r.user_id} className="flex justify-between border-b py-1 last:border-b-0">
                      <span>{r.user_name ?? r.full_name ?? r.user_id}</span>
                      <span className="opacity-70">{r.status ?? r.last_event ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Approvals */}
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
                        <div className="text-xs opacity-70">Requested: {new Date(r.requested_at).toLocaleString()}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => updateCorrectionStatus(r.id, "approved")} className="rounded-md bg-emerald-600 px-2 py-1 text-white">Approve</button>
                        <button onClick={() => updateCorrectionStatus(r.id, "rejected")} className="rounded-md bg-rose-600 px-2 py-1 text-white">Reject</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Staff Admin */}
          <section className="rounded-lg border p-4">
            <h2 className="mb-2 text-lg font-medium">Staff Admin</h2>
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
            </form>
            <div className="max-h-64 overflow-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2">Name</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Role</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-b-0">
                      <td className="py-2">{u.full_name ?? u.id}</td>
                      <td className="py-2">{u.email ?? "—"}</td>
                      <td className="py-2">{u.role}</td>
                      <td className="py-2">
                        <select value={u.role} onChange={(e) => updateUserRole(u.id, e.target.value)} className="rounded-md border px-2 py-1 text-xs">
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

          {/* Settings */}
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
              <p className="text-xs opacity-70">Holidays, job titles and auto warning rules can be added later. This saves branding in `company_settings`.</p>
            </div>
          </section>

          {/* HR Folders */}
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

          {/* Reports */}
          <section className="rounded-lg border p-4 md:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-medium">Reports</h2>
              <div className="flex gap-2">
                <button onClick={exportReports} className="rounded-md border px-3 py-2 text-sm">Export CSV</button>
                {role === "ceo" && <button onClick={exportCEOPDF} className="rounded-md border px-3 py-2 text-sm">Export CEO Briefing (PDF)</button>}
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Exports based on `v_ceo_snapshot` for now.</p>
          </section>
        </div>

        {err && <p className="text-sm text-rose-600">{err}</p>}
        {okMsg && <p className="text-sm text-emerald-600">{okMsg}</p>}
      </div>
    </RoleGate>
  );
}

