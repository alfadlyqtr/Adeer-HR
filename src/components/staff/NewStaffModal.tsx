"use client";
import React, { useEffect, useMemo, useState } from "react";

export type NewStaffPayload = {
  employmentId?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: string;
  nationality?: string;
  joiningDate?: string; // ISO date
  address?: string;
  tempPassword?: string; // optional; if blank, backend will generate
  // Document numbers/dates
  passportNumber?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
  idNumber?: string;
  idExpiryDate?: string;
  driverLicenseNumber?: string;
  driverLicenseExpiryDate?: string;
  notes?: string;
  // Permissions
  canApprove?: boolean;
  canManageTeams?: boolean;
  canUploadDocs?: boolean;
  // Compensation (UI only for now)
  baseSalary?: number;
  payCycle?: "monthly" | "weekly" | "biweekly";
  // Files (UI only for now)
  photoFile?: File | null;
  passportFile?: File | null;
  idFile?: File | null;
  licenseFile?: File | null;
};

export function NewStaffModal({
  open,
  onClose,
  onSave,
  goldMode,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: NewStaffPayload) => Promise<void> | void;
  goldMode?: boolean;
}) {
  const [tab, setTab] = useState<"documents" | "details">("documents");
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<NewStaffPayload>({});
  const genTemp = () => `Adeer-${Math.random().toString(36).slice(2,8)}-2025`;
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); } catch {} };

  useEffect(() => {
    if (!open) {
      setTab("documents");
      setSaving(false);
      setData({});
    }
  }, [open]);

  if (!open) return null;

  const panelBorder = goldMode ? "border-[#D4AF37]/30" : "border-brand-primary/20";
  const primaryBtn = goldMode ? "bg-[#D4AF37] text-black hover:bg-[#c6a232]" : "bg-brand-primary text-white hover:bg-brand-primary/90";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative z-10 w-[min(920px,95vw)] max-h-[90vh] overflow-auto rounded-xl border ${panelBorder} bg-white p-4 shadow-xl dark:bg-black`}> 
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Invite New Staff</h2>
          <button onClick={onClose} className="rounded-md border px-2 py-1 text-sm">Close</button>
        </div>

        {/* Employment ID */}
        <div className="mb-3">
          <label className="mb-1 block text-xs">Employment ID</label>
          <input placeholder="e.g., EMP-001" value={data.employmentId ?? ""} onChange={(e)=>setData(d=>({...d, employmentId: e.target.value}))} className="w-full rounded-md border px-3 py-2" />
        </div>

        {/* Tabs */}
        <nav className={`mb-3 flex gap-2 rounded-lg border p-1 text-sm ${goldMode ? 'bg-[#1a1400] border-[#D4AF37]/30' : 'bg-white dark:bg-black border-brand-primary/20'}`}>
          {(["documents","details"] as const).map(t => (
            <button key={t} onClick={()=>setTab(t)} className={`rounded-md px-3 py-1.5 transition-all ${tab===t ? (goldMode ? 'bg-[#D4AF37]/15 text-[#D4AF37] ring-1 ring-[#D4AF37]' : 'bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary') : 'opacity-80 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10'}`}>
              {t[0].toUpperCase()+t.slice(1)}
            </button>
          ))}
        </nav>
        {/* Documents */}
        {tab === "documents" && (
          <section className={`rounded-lg border ${panelBorder} p-3 space-y-3`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Upload Documents</h3>
              <button className="rounded-md border px-2 py-1 text-xs">Auto-fill from Documents</button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-md border p-3">
                <div className="mb-1 text-xs opacity-80">Photo</div>
                <input type="file" accept="image/*" onChange={(e)=>setData(d=>({...d, photoFile: e.target.files?.[0] || null}))} />
              </div>
              <div className="rounded-md border p-3">
                <div className="mb-1 text-xs opacity-80">Passport</div>
                <input type="file" onChange={(e)=>setData(d=>({...d, passportFile: e.target.files?.[0] || null}))} />
              </div>
              <div className="rounded-md border p-3">
                <div className="mb-1 text-xs opacity-80">ID</div>
                <input type="file" onChange={(e)=>setData(d=>({...d, idFile: e.target.files?.[0] || null}))} />
              </div>
              <div className="rounded-md border p-3">
                <div className="mb-1 text-xs opacity-80">License</div>
                <input type="file" onChange={(e)=>setData(d=>({...d, licenseFile: e.target.files?.[0] || null}))} />
              </div>
            </div>
          </section>
        )}

        {/* Details */}
        {tab === "details" && (
          <section className={`space-y-3 rounded-lg border ${panelBorder} p-3`}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs">Full Name *</label>
                <input value={data.fullName ?? ""} onChange={(e)=>setData(d=>({...d, fullName: e.target.value}))} className="w-full rounded-md border px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-xs">Date of Birth</label>
                <input type="date" className="w-full rounded-md border px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-xs">Email *</label>
                <input type="email" value={data.email ?? ""} onChange={(e)=>setData(d=>({...d, email: e.target.value}))} className="w-full rounded-md border px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-xs">Phone</label>
                <input value={data.phone ?? ""} onChange={(e)=>setData(d=>({...d, phone: e.target.value}))} className="w-full rounded-md border px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-xs">Temporary Password (optional)</label>
                <div className="flex gap-2">
                  <input value={data.tempPassword ?? ""} onChange={(e)=>setData(d=>({...d, tempPassword: e.target.value}))} className="w-full rounded-md border px-3 py-2" placeholder="Leave blank to auto-generate" />
                  <button type="button" onClick={()=>setData(d=>({...d, tempPassword: genTemp()}))} className="rounded-md border px-2 text-xs">Generate</button>
                  <button type="button" onClick={()=> data.tempPassword && copy(data.tempPassword)} className="rounded-md border px-2 text-xs">Copy</button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs">Role *</label>
                <select value={data.role ?? "staff"} onChange={(e)=>setData(d=>({...d, role: e.target.value}))} className="w-full rounded-md border px-3 py-2">
                  <option value="staff">staff</option>
                  <option value="assistant_manager">assistant_manager</option>
                  <option value="manager">manager</option>
                  <option value="hr">hr</option>
                  <option value="ceo">ceo</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs">Nationality</label>
                <input value={data.nationality ?? ""} onChange={(e)=>setData(d=>({...d, nationality: e.target.value}))} className="w-full rounded-md border px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-xs">Joining Date *</label>
                <input type="date" value={data.joiningDate ?? ""} onChange={(e)=>setData(d=>({...d, joiningDate: e.target.value}))} className="w-full rounded-md border px-3 py-2" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs">Address</label>
                <textarea value={data.address ?? ""} onChange={(e)=>setData(d=>({...d, address: e.target.value}))} className="w-full rounded-md border px-3 py-2" rows={3} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs">Passport Number</label>
                <input value={data.passportNumber ?? ""} onChange={(e)=>setData(d=>({...d, passportNumber: e.target.value}))} className="w-full rounded-md border px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-xs">Passport Issue Date</label>
                <input type="date" value={data.passportIssueDate ?? ""} onChange={(e)=>setData(d=>({...d, passportIssueDate: e.target.value}))} className="w-full rounded-md border px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-xs">Passport Expiry Date</label>
                <input type="date" value={data.passportExpiryDate ?? ""} onChange={(e)=>setData(d=>({...d, passportExpiryDate: e.target.value}))} className="w-full rounded-md border px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-xs">ID Number</label>
                <input value={data.idNumber ?? ""} onChange={(e)=>setData(d=>({...d, idNumber: e.target.value}))} className="w-full rounded-md border px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-xs">ID Expiry Date</label>
                <input type="date" value={data.idExpiryDate ?? ""} onChange={(e)=>setData(d=>({...d, idExpiryDate: e.target.value}))} className="w-full rounded-md border px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-xs">Driver's License Number</label>
                <input value={data.driverLicenseNumber ?? ""} onChange={(e)=>setData(d=>({...d, driverLicenseNumber: e.target.value}))} className="w-full rounded-md border px-3 py-2" />
              </div>
              <div>
                <label className="mb-1 block text-xs">Driver's License Expiry Date</label>
                <input type="date" value={data.driverLicenseExpiryDate ?? ""} onChange={(e)=>setData(d=>({...d, driverLicenseExpiryDate: e.target.value}))} className="w-full rounded-md border px-3 py-2" />
              </div>
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs">Additional Notes</label>
                <textarea value={data.notes ?? ""} onChange={(e)=>setData(d=>({...d, notes: e.target.value}))} className="w-full rounded-md border px-3 py-2" rows={3} />
              </div>
            </div>
          </section>
        )}

        

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-2 text-sm border">Cancel</button>
          <button
            disabled={saving}
            onClick={async ()=>{ try { setSaving(true); await onSave(data); onClose(); } finally { setSaving(false); } }}
            className={`rounded-md px-3 py-2 text-sm ${primaryBtn} disabled:opacity-50`}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewStaffModal;
