"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // When user lands from email link, Supabase sets a recovery session
    // We just show the form.
    (async () => {
      const { data } = await supabase.auth.getSession();
      setReady(true);
      if (!data.session) {
        setMessage("Open this page from the password reset link we emailed to you.");
      }
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (password !== confirm) {
      setMessage("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage("Password updated. You can now login.");
    } catch (err: any) {
      setMessage(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <div className="relative isolate overflow-hidden rounded-3xl border border-black/5 bg-gradient-to-br from-brand-light/25 via-white to-white p-8 dark:border-white/10 dark:from-brand-darkPurple/25 dark:via-black dark:to-black">
        <div className="container-app grid items-center gap-10 md:grid-cols-2">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-brand-darkPurple dark:text-brand-light md:text-5xl">
              Reset password
            </h1>
            <p className="text-gray-700 dark:text-gray-300">Enter a new password for your account.</p>
            <div className="flex items-center gap-3 text-sm">
              <Link href="/login" className="text-brand-primary hover:underline">Back to Login</Link>
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm">
            <div className="rounded-2xl border border-black/5 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#0b0b0b]/70">
              <h2 className="mb-4 text-lg font-semibold">Set new password</h2>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="password" className="block text-sm">New password</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-brand-primary"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="confirm" className="block text-sm">Confirm password</label>
                  <input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-brand-primary"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !ready}
                  className="w-full rounded-md bg-brand-primary px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? "Saving…" : "Update password"}
                </button>
              </form>
              {message && <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{message}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
