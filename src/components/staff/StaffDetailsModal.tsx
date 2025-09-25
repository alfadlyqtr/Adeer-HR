"use client";
import { useEffect } from "react";

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
}: {
  open: boolean;
  onClose: () => void;
  staff: StaffDetails | null;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !staff) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[101] max-h-[90vh] w-[min(100%,980px)] overflow-y-auto rounded-2xl border border-black/10 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#0b0b0b]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">{staff.full_name ?? "Staff"}</h3>
            <p className="text-sm opacity-70">{[staff.title, staff.team].filter(Boolean).join(" • ")}</p>
          </div>
          <button onClick={onClose} className="rounded-md border px-3 py-1 text-sm">Close</button>
        </div>

        {/* Placeholder tabbed content; wire real data next */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className="rounded-lg border p-4">
            <h4 className="mb-2 font-medium">Documents</h4>
            <p className="text-sm opacity-70">Coming soon: staff_files list</p>
          </section>
          <section className="rounded-lg border p-4">
            <h4 className="mb-2 font-medium">Attendance</h4>
            <p className="text-sm opacity-70">Coming soon: recent check-ins/outs</p>
          </section>
          <section className="rounded-lg border p-4">
            <h4 className="mb-2 font-medium">Warnings</h4>
            <p className="text-sm opacity-70">Coming soon: warnings count and list</p>
          </section>
          <section className="rounded-lg border p-4">
            <h4 className="mb-2 font-medium">Notes & Reports</h4>
            <p className="text-sm opacity-70">Coming soon: notes and report links</p>
          </section>
        </div>
      </div>
    </div>
  );
}
