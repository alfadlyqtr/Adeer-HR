"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false); // Start with false for faster render
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  
  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Theme - Load immediately from localStorage
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem("theme");
      return savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return false;
  });
  
  // Messages
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  async function loadUserData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      
      setEmail(session.user.email || "");
    } catch (e) {
      console.error("Failed to load user data", e);
      setErr("Failed to load user data");
    }
  }
  
  function toggleTheme() {
    const newTheme = !isDark;
    setIsDark(newTheme);
    localStorage.setItem("theme", newTheme ? "dark" : "light");
    
    if (newTheme) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  async function changePassword() {
    setSaving(true);
    setOkMsg(null);
    setErr(null);
    
    try {
      if (!newPassword || newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      
      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match");
      }
      
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      setOkMsg("Password changed successfully!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      setErr(e?.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">⚙️ Settings</h1>
        <button
          onClick={() => router.back()}
          className="rounded-md border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 px-3 py-1.5 text-sm transition hover:bg-white/10"
        >
          ← Back
        </button>
      </div>

      {/* Messages */}
      {okMsg && <div className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-500">{okMsg}</div>}
      {err && <div className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-500">{err}</div>}

      {/* Current Email */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-medium">Current Email</h2>
        <div className="rounded-md border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-3">
          <p className="text-sm opacity-70 mb-1">Email Address</p>
          <p className="font-medium">{email}</p>
        </div>
        <p className="mt-2 text-xs opacity-70">Contact your administrator to change your email address.</p>
      </section>

      {/* Change Password */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-medium">Change Password</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 6 characters)"
              className="w-full rounded-md border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-2 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
            />
          </div>
          
          <div>
            <label className="mb-1 block text-sm font-medium">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-md border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-2 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
            />
          </div>
          
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-400">
            <p className="font-medium">Password Requirements:</p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-xs">
              <li>At least 6 characters long</li>
              <li>Use a mix of letters, numbers, and symbols for better security</li>
            </ul>
          </div>
          
          <button
            onClick={changePassword}
            disabled={saving || !newPassword || !confirmPassword}
            className="rounded-md bg-brand-primary px-4 py-2 text-sm text-white transition hover:bg-brand-primary/90 disabled:opacity-60"
          >
            {saving ? "Changing..." : "Change Password"}
          </button>
        </div>
      </section>

      {/* Theme Toggle */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-medium">Theme</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Dark / Light Mode</p>
            <p className="text-xs opacity-70 mt-1">Toggle between dark and light theme</p>
          </div>
          <button
            onClick={toggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 shadow-sm hover:bg-white/10 transition"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </section>
    </div>
  );
}
