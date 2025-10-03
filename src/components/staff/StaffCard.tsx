"use client";
import { useState } from "react";
import Image from "next/image";
import styles from "./StaffCard.module.css";

export type StaffSummary = {
  id: string;
  full_name: string | null;
  title: string | null;
  team: string | null;
  avatar_url: string | null;
  role?: string | null;
  // lightweight summary stats for the back face
  status?: string | null;
  today_check_in?: string | null;
  today_check_out?: string | null;
  warnings_count?: number | null;
};

export default function StaffCard({ staff, onShowMore }: { staff: StaffSummary; onShowMore: (id: string) => void; }) {
  const [flipped, setFlipped] = useState(false);

  const handleFlip = () => setFlipped(v => !v);

  // Use uploaded avatar from staff_cards table, fallback to staff.avatar_url, then placeholder
  const avatarSrc = staff.avatar_url || "/staff/placeholder.svg";

  return (
    <div className={`${styles.card} ${flipped ? styles.flipped : ""} rounded-2xl border shadow-sm overflow-hidden bg-white dark:bg-[#0b0b0b] dark:border-white/10`} onClick={handleFlip}>
      <div className={`${styles.inner}`}>
        {/* Front (ID badge style) */}
        <div className={`${styles.face} flex flex-col`}>
          {/* Top brand bar */}
          <div className="flex items-center justify-between bg-[#0e1a2b] px-3 py-2 text-white">
            <div className="flex items-center gap-2">
              <Image src="/logo/adeer logo.png" alt="Brand" width={18} height={18} />
              <span className="text-[11px] opacity-90">ADEER HR</span>
            </div>
            <span className="text-[10px] opacity-80">ID: {staff.id.slice(0, 8)}</span>
          </div>

          {/* Background graphic zone */}
          <div className="relative flex-1 bg-gradient-to-br from-[#0e1a2b] via-[#152a47] to-[#0e1a2b] p-4 text-white">
            {/* Framed photo */}
            <div className="relative mx-auto h-28 w-24 overflow-hidden rounded-lg border-2 border-white/80 bg-black shadow-md">
              <Image src={avatarSrc} alt={staff.full_name || "Staff"} fill sizes="96px" className="object-cover" />
            </div>
            {/* Decorative elements could be added here (icons/shapes) */}
          </div>

          {/* Name + role pill */}
          <div className="px-3 pb-3 pt-2">
            <div className="text-center text-lg font-extrabold tracking-wide">{staff.full_name ?? "Unnamed"}</div>
            <div className="mt-1 flex items-center justify-center gap-2 text-xs">
              <span className="rounded bg-[#2c7db6] px-2 py-0.5 text-white uppercase">{(staff.role || staff.title || "Staff").toString()}</span>
              {staff.team && <span className="rounded border px-2 py-0.5 text-[11px] opacity-80">{staff.team}</span>}
            </div>
          </div>
        </div>

        {/* Back */}
        <div className={`${styles.face} ${styles.back} flex flex-col`}>
          {/* Header */}
          <div className="flex items-center justify-between bg-[#0e1a2b] px-3 py-2 text-white">
            <span className="text-[11px]">Profile Summary</span>
            <span className="text-[10px] opacity-80 uppercase">{(staff.role || staff.title || "Staff").toString()}</span>
          </div>
          {/* Body */}
          <div className="flex-1 space-y-2 p-3 text-sm">
            <div className="flex items-center justify-between"><span className="opacity-70">Status</span><span className="font-medium">{(staff.status ?? "—").toString()}</span></div>
            <div className="flex items-center justify-between"><span className="opacity-70">Today In</span><span className="font-medium">{staff.today_check_in ? new Date(staff.today_check_in).toLocaleTimeString() : "—"}</span></div>
            <div className="flex items-center justify-between"><span className="opacity-70">Today Out</span><span className="font-medium">{staff.today_check_out ? new Date(staff.today_check_out).toLocaleTimeString() : "—"}</span></div>
            <div className="flex items-center justify-between"><span className="opacity-70">Warnings</span><span className="font-medium">{staff.warnings_count ?? 0}</span></div>
            <div className="pt-1 text-[11px] opacity-70 text-center">Tap card to flip back</div>
          </div>
          {/* Footer */}
          <div className="p-3">
            <button
              className="w-full rounded-md bg-brand-primary px-3 py-2 text-sm text-white hover:opacity-90"
              onClick={(e) => { e.stopPropagation(); onShowMore(staff.id); }}
            >
              Show more
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
