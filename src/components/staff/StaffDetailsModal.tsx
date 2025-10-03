"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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
  const [uploading, setUploading] = useState(false);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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

  async function loadStaffCard() {
    if (!staff) return;
    // Skip loading from database to avoid RLS issues
    // Use placeholder data for now
    setCardUrl(null);
    setAvatarUrl(staff.avatar_url || null);
  }

  async function uploadImage(file: File, type: 'card' | 'avatar') {
    if (!staff) return;
    
    setUploading(true);
    setMessage(null);
    
    try {
      // Simulate upload for demo purposes
      // In a real implementation, you would upload to your storage service
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (type === 'card') {
          setCardUrl(result);
        } else {
          setAvatarUrl(result);
          // Notify parent component about avatar update
          if (staff && onAvatarUpdate) {
            onAvatarUpdate(staff.id, result);
          }
        }
        setMessage(`${type === 'card' ? 'ID Card' : 'Profile Photo'} uploaded successfully!`);
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      setMessage(`Upload failed: ${error.message}`);
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
          </div>
          <button onClick={onClose} className="rounded-md border px-3 py-1 text-sm">Close</button>
        </div>

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

          {/* Documents */}
          <section className="rounded-lg border p-4">
            <h4 className="mb-2 font-medium">Documents</h4>
            <p className="text-sm opacity-70">Coming soon: staff_files list</p>
          </section>

          {/* Attendance */}
          <section className="rounded-lg border p-4">
            <h4 className="mb-2 font-medium">Recent Activity</h4>
            <p className="text-sm opacity-70">Coming soon: recent check-ins/outs</p>
          </section>
        </div>

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
