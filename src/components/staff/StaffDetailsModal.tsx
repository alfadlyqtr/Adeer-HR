"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useUserRole } from "@/hooks/useUserRole";

export type StaffDetails = {
  id: string;
  full_name: string | null;
  title: string | null;
  team: string | null;
  avatar_url: string | null;
};

export default function StaffDetailsModal({
  open,
  onClose,
  staff,
  onAvatarUpdate,
}: {
  open: boolean;
  onClose: () => void;
  staff: StaffDetails | null;
  onAvatarUpdate?: (staffId: string, avatarUrl: string) => void;
}) {
  const { role } = useUserRole();
  const [uploading, setUploading] = useState(false);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Array<{ id: string; file_url?: string | null; created_at?: string | null }>>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [activity, setActivity] = useState<Array<{ id?: string; label: string; at?: string }>>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  // Attendance history state
  type RangeKey = '7d' | '30d' | '90d' | '180d' | '365d';
  const [attRange, setAttRange] = useState<RangeKey>('30d');
  const [attLoading, setAttLoading] = useState(false);
  const [attError, setAttError] = useState<string | null>(null);
  const [attDays, setAttDays] = useState<Array<{ date: string; in?: string|null; out?: string|null; durationMs?: number; breaksMs?: number }>>([]);
  const [attSummary, setAttSummary] = useState<{ daysPresent: number; totalMs: number; avgMs: number }>({ daysPresent: 0, totalMs: 0, avgMs: 0 });
  const BUCKET = process.env.NEXT_PUBLIC_STAFF_PHOTOS_BUCKET || "hr-files"; // default to your existing bucket
  const SUPA_OK = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  // Safety: wrap any async call with a timeout so UI doesn't spin forever on network issues
  async function withTimeout<T>(p: Promise<T>, ms = 12000): Promise<T> {
    return await Promise.race([
      p,
      new Promise<T>((_, rej) => setTimeout(() => rej(new Error('Request timed out')), ms)) as Promise<T>
    ]);
  }

  // Warnings state
  const [routeRole, setRouteRole] = useState<'hr'|'ceo'|null>(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      if (p.includes('/hr')) setRouteRole('hr');
      else if (p.includes('/ceo')) setRouteRole('ceo');
      else setRouteRole(null);
    }
  }, []);
  const canIssueWarning = (role === 'hr' || role === 'ceo' || routeRole === 'hr' || routeRole === 'ceo');
  const [warns, setWarns] = useState<Array<{ id?: string; message?: string | null; severity?: string | null; created_at?: string | null; issued_by?: string | null; issued_by_email?: string | null }>>([]);
  const [warnsLoading, setWarnsLoading] = useState(false);
  const [warnsError, setWarnsError] = useState<string | null>(null);
  const [warnOpen, setWarnOpen] = useState(false);
  const [warnMessage, setWarnMessage] = useState("");
  const [warnSeverity, setWarnSeverity] = useState<'low'|'medium'|'high'>("medium");
  const [warnSubmitting, setWarnSubmitting] = useState(false);
  const [warnSubmitMsg, setWarnSubmitMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Load existing staff card data when modal opens
  useEffect(() => {
    if (!open || !staff) return;
    loadStaffCard();
  }, [open, staff]);

  // Load warnings list for this staff
  useEffect(() => {
    if (!open || !staff) return;
    let active = true;
    (async () => {
      if (!active) return;
      setWarnsLoading(true);
      setWarnsError(null);
      try {
        const { data, error } = await withTimeout(
          Promise.resolve(
            supabase
              .from('warnings')
              .select('id, reason, created_at, issued_by')
              .eq('user_id', staff.id)
              .order('created_at', { ascending: false })
              .limit(10)
          ) as unknown as Promise<{ data: any[]|null; error: any }>
        );
        if (!active) return;
        if (error) throw error;
        setWarns(Array.isArray(data) ? data : []);
      } catch (err: any) {
        if (!active) return;
        setWarns([]);
        setWarnsError(err?.message || 'Failed to load warnings');
      } finally {
        if (!active) return;
        setWarnsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [open, staff]);

  async function submitWarning() {
    if (!staff) return;
    setWarnSubmitting(true);
    setWarnSubmitMsg(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const issuedBy = sess?.session?.user?.id || null;
      // Minimal, schema-safe insert using 'reason'
      const payloadMin: any = {
        user_id: staff.id,
        reason: warnMessage || null,
        issued_by: issuedBy,
      };
      const { error } = await supabase.from('warnings').insert(payloadMin);
      if (error) throw error;
      setWarnSubmitMsg('Warning issued successfully');
      setWarnMessage('');
      // Reload list
      const { data } = await supabase
        .from('warnings')
        .select('id, reason, created_at, issued_by')
        .eq('user_id', staff.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setWarns(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setWarnSubmitMsg(e?.message || 'Failed to issue warning');
    } finally {
      setWarnSubmitting(false);
    }
  }

  async function deleteWarning(id?: string) {
    if (!id) return;
    try {
      await supabase.from('warnings').delete().eq('id', id);
      setWarns((list) => list.filter(w => w.id !== id));
    } catch (e) {
      // no-op UI error for now
    }
  }

  // Load attendance history when range changes
  useEffect(() => {
    if (!open || !staff) return;
    let active = true;
    (async () => {
      if (!active) return;
      setAttLoading(true);
      setAttError(null);
      try {
        const now = new Date();
        const start = new Date(now);
        const map: Record<RangeKey, number> = { '7d': 7, '30d': 30, '90d': 90, '180d': 180, '365d': 365 };
        start.setDate(start.getDate() - (map[attRange] - 1));
        // Read a slightly wider window to be safe with timezones
        const startIso = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0).toISOString();
        const endIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

        const { data, error } = await withTimeout(
          Promise.resolve(
            supabase
              .from('attendance_logs')
              .select('user_id, ts, created_at, type')
              .eq('user_id', staff.id)
              .gte('ts', startIso)
              .lte('ts', endIso)
              .order('ts', { ascending: true })
              .limit(500)
          ) as unknown as Promise<{ data: any[]|null; error: any }>
        );
        if (!active) return;
        if (error) throw error;

        // Group by day and compute first IN, last OUT, total work hours, and breaks
        type DayAgg = { in?: string|null; out?: string|null; durationMs: number; breaksMs: number };
        const byDay: Record<string, DayAgg> = {};
        const events: Array<{ ts: string; type: string; dayKey: string }> = (data ?? []).map((row: any) => {
          const t = String(row.type || '').toLowerCase();
          const ts: string = (row.ts || row.created_at) as string;
          const d = new Date(ts);
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          return { ts, type: t, dayKey: key };
        });
        for (const e of events) {
          if (!byDay[e.dayKey]) byDay[e.dayKey] = { in: null, out: null, durationMs: 0, breaksMs: 0 };
        }
        for (const dayKey of Object.keys(byDay)) {
          const dayEvents = events.filter(x => x.dayKey === dayKey).sort((a,b)=> a.ts < b.ts ? -1 : 1);
          let firstIn: string | null = null;
          let lastOut: string | null = null;
          let currentIn: string | null = null;
          let pendingOutForBreak: string | null = null;
          let workMs = 0;
          let breakMs = 0;
          for (const e of dayEvents) {
            if (e.type === 'check_in' || e.type === 'in' || e.type === 'checkin') {
              if (!firstIn || e.ts < firstIn) firstIn = e.ts;
              if (pendingOutForBreak) {
                breakMs += Math.max(0, Date.parse(e.ts) - Date.parse(pendingOutForBreak));
                pendingOutForBreak = null;
              }
              if (!currentIn) currentIn = e.ts; else currentIn = e.ts;
            } else if (e.type === 'check_out' || e.type === 'out' || e.type === 'checkout') {
              if (e.ts > (lastOut || '')) lastOut = e.ts;
              if (currentIn) {
                workMs += Math.max(0, Date.parse(e.ts) - Date.parse(currentIn));
                currentIn = null;
              }
              pendingOutForBreak = e.ts;
            }
          }
          const isToday = (() => {
            const [y, m, d] = dayKey.split('-').map(Number);
            const now2 = new Date();
            return now2.getFullYear() === y && (now2.getMonth()+1) === m && now2.getDate() === d;
          })();
          if (isToday && currentIn) {
            workMs += Math.max(0, Date.now() - Date.parse(currentIn));
          }
          byDay[dayKey].in = firstIn;
          byDay[dayKey].out = lastOut;
          byDay[dayKey].durationMs = workMs;
          byDay[dayKey].breaksMs = breakMs;
        }

        const days: Array<{ date: string; in?: string|null; out?: string|null; durationMs?: number; breaksMs?: number }>= Object.entries(byDay)
          .sort((a,b)=> a[0] < b[0] ? 1 : -1)
          .map(([date, v]) => ({
            date,
            in: v.in || null,
            out: v.out || null,
            durationMs: v.durationMs || 0,
            breaksMs: v.breaksMs || 0,
          }));
        if (!active) return;
        setAttDays(days);

        const daysPresent = days.filter(d => d.in).length;
        const totalMs = days.reduce((acc, d) => acc + (d.durationMs || 0), 0);
        const avgMs = daysPresent ? Math.round(totalMs / daysPresent) : 0;
        setAttSummary({ daysPresent, totalMs, avgMs });
      } catch (err: any) {
        if (!active) return;
        setAttDays([]);
        setAttSummary({ daysPresent: 0, totalMs: 0, avgMs: 0 });
        setAttError(err?.message || 'Failed to load attendance');
      } finally {
        if (!active) return;
        setAttLoading(false);
      }
    })();
    return () => { active = false; };
  }, [open, staff, attRange]);

  // Load staff documents when modal opens
  useEffect(() => {
    if (!open || !staff) return;
    (async () => {
      setDocumentsLoading(true);
      setDocumentsError(null);
      try {
        const { data, error } = await withTimeout(
          Promise.resolve(
            supabase
              .from('staff_files')
              .select('id, file_url, created_at')
              .eq('user_id', staff.id)
              .order('created_at', { ascending: false })
              .limit(10)
          ) as unknown as Promise<{ data: any[]|null; error: any }>
        );
        if (error) throw error;
        setDocuments(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setDocuments([]);
        setDocumentsError(err?.message || 'Failed to load documents');
      } finally {
        setDocumentsLoading(false);
      }
    })();
  }, [open, staff]);

  // Load recent activity (defensive: try a view if exists, otherwise fallback to staff_cards timestamps)
  useEffect(() => {
    if (!open || !staff) return;
    (async () => {
      setActivityLoading(true);
      setActivityError(null);
      try {
        // Try a known view first
        let acc: Array<{ id?: string; label: string; at?: string }> = [];
        const tryView = await withTimeout(
          Promise.resolve(
            supabase
              .from('v_current_status')
              .select('user_id, status, updated_at')
              .eq('user_id', staff.id)
              .limit(5)
          ) as unknown as Promise<{ data: any[]|null; error: any }>
        );
        if (!(tryView as any).error && Array.isArray((tryView as any).data)) {
          acc = (tryView as any).data.map((r: any, i: number) => ({
            id: r.user_id ? String(r.user_id) + ':' + i : String(i),
            label: String(r.status ?? 'Activity'),
            at: r.updated_at ?? null,
          }));
        }

        // If empty, fallback to staff_cards updated_at as a simple signal
        if (!acc.length) {
          const fallback = await withTimeout(
            Promise.resolve(
              supabase
                .from('staff_cards')
                .select('updated_at')
                .eq('user_id', staff.id)
                .single()
            ) as unknown as Promise<{ data: any|null; error: any }>
          );
          if (!(fallback as any).error && (fallback as any).data?.updated_at) {
            acc = [{ label: 'Profile updated', at: (fallback as any).data.updated_at }];
          }
        }

        setActivity(acc);
      } catch (err: any) {
        setActivity([]);
        setActivityError(err?.message || 'Failed to load activity');
      } finally {
        setActivityLoading(false);
      }
    })();
  }, [open, staff]);

  async function loadStaffCard() {
    if (!staff) return;
    try {
      const { data, error } = await supabase
        .from("staff_cards")
        .select("card_url, avatar_url")
        .eq("user_id", staff.id)
        .single();
      if (error) {
        // If no row yet, fallback to any provided avatar
        setCardUrl(null);
        setAvatarUrl(staff.avatar_url || null);
        return;
      }
      setCardUrl(data?.card_url ?? null);
      setAvatarUrl(data?.avatar_url ?? (staff.avatar_url || null));
    } catch (e) {
      setCardUrl(null);
      setAvatarUrl(staff.avatar_url || null);
    }
  }

  async function uploadImage(file: File, type: 'card' | 'avatar') {
    if (!staff) return;
    setUploading(true);
    setMessage(null);

    const getExt = (name: string) => {
      const idx = name.lastIndexOf('.');
      return idx !== -1 ? name.slice(idx + 1).toLowerCase() : 'jpg';
    };

    try {
      console.log(`[StaffDetailsModal] Uploading to bucket: ${BUCKET}`);
      // 1) Upload to Storage
      const ext = getExt(file.name);
      const path = `${staff.id}/${type}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) {
        if (typeof upErr.message === 'string' && /Not Found|bucket/i.test(upErr.message)) {
          throw new Error(`Bucket not found: "${BUCKET}". Please create it in Supabase Storage (public or adjust signed URLs).`);
        }
        throw upErr;
      }

      // 2) Always create a signed URL (works for both public/private buckets)
      const { data: signed, error: signedErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
      if (signedErr) throw signedErr;
      const publicUrl = signed?.signedUrl || null;
      if (!publicUrl) throw new Error('Failed to obtain file URL');
      console.log('[StaffDetailsModal] Signed URL created:', publicUrl);

      // 3) Upsert into staff_cards (file_url is NOT NULL in schema, include it)
      const payload: any = { 
        user_id: staff.id, 
        updated_at: new Date().toISOString(),
        file_url: publicUrl // satisfy NOT NULL; aligns with existing schema
      };
      if (type === 'card') payload.card_url = publicUrl; else payload.avatar_url = publicUrl;
      const { error: dbErr } = await supabase
        .from('staff_cards')
        .upsert(payload, { onConflict: 'user_id' });
      if (dbErr) throw dbErr;

      // 4) Update local state and notify parent
      if (type === 'card') {
        setCardUrl(publicUrl);
      } else {
        setAvatarUrl(publicUrl);
        if (onAvatarUpdate) onAvatarUpdate(staff.id, publicUrl);
      }

      setMessage(`${type === 'card' ? 'ID Card' : 'Profile Photo'} uploaded successfully!`);
    } catch (error: any) {
      setMessage(`Upload failed: ${error.message || error}`);
    } finally {
      setUploading(false);
    }
  }

  if (!open || !staff) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[101] max-h-[90vh] w-[min(100%,980px)] overflow-y-auto rounded-2xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#0b0b0b]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">{staff.full_name ?? "Staff"}</h3>
            <p className="text-sm opacity-70">{[staff.title, staff.team].filter(Boolean).join(" • ")}</p>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="rounded border px-2 py-0.5 opacity-70">Role: {(role || routeRole || 'unknown').toString().toUpperCase()}</span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-md border px-3 py-1 text-sm">Close</button>
        </div>

        {!SUPA_OK && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-300">
            Supabase environment variables are missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
          </div>
        )}

        {/* Message */}
        {message && (
          <div className={`mb-4 rounded-lg p-3 text-sm ${
            message.includes('successfully') 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400' 
              : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/20 dark:text-rose-400'
          }`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* ID Card Upload */}
          <section className="rounded-lg border p-4">
            <h4 className="mb-3 font-medium">ID Card Photo</h4>
            {cardUrl ? (
              <div className="mb-3">
                <img 
                  src={cardUrl} 
                  alt="ID Card" 
                  className="w-full max-w-xs rounded-lg border shadow-sm"
                />
              </div>
            ) : (
              <div className="mb-3 flex h-32 w-full max-w-xs items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800">
                <span className="text-sm text-gray-500">No ID card uploaded</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadImage(file, 'card');
              }}
              disabled={uploading}
              className="w-full text-sm"
            />
          </section>

          {/* Avatar Upload */}
          <section className="rounded-lg border p-4">
            <h4 className="mb-3 font-medium">Profile Photo</h4>
            {avatarUrl ? (
              <div className="mb-3">
                <img 
                  src={avatarUrl} 
                  alt="Profile" 
                  className="h-32 w-32 rounded-full border shadow-sm object-cover"
                />
              </div>
            ) : (
              <div className="mb-3 flex h-32 w-32 items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800">
                <span className="text-xs text-gray-500 text-center">No photo</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadImage(file, 'avatar');
              }}
              disabled={uploading}
              className="w-full text-sm"
            />
          </section>

          {/* Warnings */}
          <section className="rounded-lg border p-4">
            <h4 className="mb-2 font-medium">Warnings</h4>
            {warnsLoading ? (
              <p className="text-sm opacity-70">Loading warnings...</p>
            ) : warnsError ? (
              <p className="text-sm text-rose-600 dark:text-rose-400">{warnsError}</p>
            ) : warns.length ? (
              <ul className="space-y-2 text-sm">
                {warns.map((w, i) => (
                  <li key={w.id ?? i} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate">{(w as any).reason || 'Warning issued'}</div>
                      {w.created_at && (
                        <div className="text-xs opacity-70">{new Date(w.created_at).toLocaleString()}</div>
                      )}
                      {('issued_by' in (w as any)) && (w as any).issued_by && (
                        <div className="text-[11px] opacity-60">Issued by: {(w as any).issued_by}</div>
                      )}
                    </div>
                    {canIssueWarning && w.id && (
                      <button onClick={() => deleteWarning(w.id)} className="shrink-0 rounded-md border px-2 py-1 text-xs text-rose-600 hover:bg-rose-600/10">Delete</button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm opacity-70">No warnings found.</p>
            )}
          </section>
        </div>

        {/* Attendance History */}
        <section className="mt-4 rounded-lg border p-4 md:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-medium">Attendance History</h4>
            <div className="flex items-center gap-1">
              {(['7d','30d','90d','180d','365d'] as RangeKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setAttRange(k)}
                  className={`rounded-md border px-2 py-1 text-xs ${attRange===k ? 'bg-brand-primary text-white border-brand-primary' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
                >
                  {k === '7d' ? '7 days' : k === '30d' ? '30 days' : k === '90d' ? '90 days' : k === '180d' ? '6 months' : '1 year'}
                </button>
              ))}
            </div>
          </div>
          {attLoading ? (
            <p className="text-sm opacity-70">Loading attendance...</p>
          ) : attError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{attError}</p>
          ) : (
            <div className="space-y-3">
              {/* Summary */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3 text-sm">
                  <div className="opacity-70">Days Present</div>
                  <div className="text-lg font-semibold">{attSummary.daysPresent}</div>
                </div>
                <div className="rounded-lg border p-3 text-sm">
                  <div className="opacity-70">Total Hours</div>
                  <div className="text-lg font-semibold">{(attSummary.totalMs/3600000).toFixed(1)} h</div>
                </div>
                <div className="rounded-lg border p-3 text-sm">
                  <div className="opacity-70">Avg per Day</div>
                  <div className="text-lg font-semibold">{(attSummary.avgMs/3600000).toFixed(1)} h</div>
                </div>
              </div>

              {/* Per-day list */}
              {attDays.length ? (
                <ul className="divide-y rounded-lg border">
                  <li className="grid grid-cols-3 items-center gap-2 bg-black/5 p-2 text-xs font-medium dark:bg-white/5 sm:grid-cols-6">
                    <div className="col-span-2 sm:col-span-2">Date</div>
                    <div className="col-span-1 sm:col-span-1">In</div>
                    <div className="col-span-1 sm:col-span-1">Out</div>
                    <div className="col-span-1 sm:col-span-1">Hours</div>
                    <div className="col-span-1 sm:col-span-1">Breaks</div>
                  </li>
                  {attDays.slice(0, 60).map((d) => (
                    <li key={d.date} className="grid grid-cols-3 items-center gap-2 p-2 text-sm sm:grid-cols-6">
                      <div className="col-span-2 sm:col-span-2 font-medium">{new Date(d.date).toLocaleDateString()}</div>
                      <div className="col-span-1 sm:col-span-1">
                        {d.in ? new Date(d.in).toLocaleTimeString() : '—'}
                      </div>
                      <div className="col-span-1 sm:col-span-1">
                        {d.out ? new Date(d.out).toLocaleTimeString() : '—'}
                      </div>
                      <div className="col-span-1 sm:col-span-1 tabular-nums">
                        {typeof d.durationMs === 'number' ? (d.durationMs/3600000).toFixed(2) + ' h' : '—'}
                      </div>
                      <div className="col-span-1 sm:col-span-1 tabular-nums">
                        {typeof d.breaksMs === 'number' && d.breaksMs > 0 ? (d.breaksMs/3600000).toFixed(2) + ' h' : '—'}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm opacity-70">No attendance records.</p>
              )}
              <p className="text-[11px] opacity-60">Showing up to 60 recent days in the selected range.</p>
            </div>
          )}
        </section>

        {uploading && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-blue-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              Uploading...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
