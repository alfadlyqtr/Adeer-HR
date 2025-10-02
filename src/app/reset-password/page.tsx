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
    <div className="min-h-screen bg-gray-50 dark:bg-black p-4 md:p-6">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <Link href="/login" className="inline-flex items-center gap-2 text-sm text-brand-primary hover:underline mb-4">
            ← Back to Login
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            🔑 Reset Password
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Enter a new password for your account
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-white/5 p-6">
          {!ready ? (
            <div className="text-center py-8">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-brand-primary" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Verifying reset link...</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  New Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label htmlFor="confirm" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confirm Password
                </label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  placeholder="••••••••"
                />
              </div>

              {/* Password Requirements */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Password Requirements:</p>
                <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-0.5">
                  <li>• At least 6 characters long</li>
                  <li>• Use a mix of letters, numbers, and symbols</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={loading || !ready}
                className="w-full rounded-md bg-brand-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Updating...
                  </span>
                ) : (
                  "Update Password"
                )}
              </button>
            </form>
          )}

          {/* Message */}
          {message && (
            <div className={`mt-4 rounded-lg p-3 text-sm ${
              message.includes('updated') || message.includes('login')
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' 
                : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800'
            }`}>
              {message}
              {message.includes('login') && (
                <Link href="/login" className="block mt-2 font-medium underline">
                  Go to Login →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Footer Links */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Remember your password?{' '}
            <Link href="/login" className="font-medium text-brand-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
