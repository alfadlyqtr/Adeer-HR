"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  const [probe, setProbe] = useState<string | null>(null);

  // Standalone REST login so it can be bound to a button and used by onSubmit
  async function restLogin() {
    setMessage(null);
    try {
      if (!supabaseUrl || !supabaseAnon) throw new Error("Missing Supabase env at runtime");
      const url = `${supabaseUrl}/auth/v1/token?grant_type=password`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnon,
          Authorization: `Bearer ${supabaseAnon}`,
        },
        body: JSON.stringify({ email, password }),
      });
      const text = await resp.text();
      if (!resp.ok) throw new Error(`Auth failed (${resp.status}). ${text}`);
      let body: any = {};
      try { body = JSON.parse(text); } catch {}
      if (!body?.access_token || !body?.refresh_token) throw new Error("Auth did not return tokens");
      const { error: setErr } = await supabase.auth.setSession({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
      });
      if (setErr) throw setErr;
      setMessage("Logged in. Redirecting…");
      window.location.href = "/";
    } catch (err: any) {
      setMessage(err?.message ?? "Login failed");
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      // Always use REST login to avoid SDK hang
      if (mode === "login") {
        await restLogin();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) setMessage("Account created. Please check your email to verify before login.");
      }
    } catch (err: any) {
      setMessage(err?.message ?? "Something went wrong");
      console.error("[Auth] submit error:", err);
    } finally {
      setLoading(false);
    }
  };

  async function runConnectivityTest() {
    setProbe(null);
    try {
      if (!supabaseUrl || !supabaseAnon) throw new Error("Missing SUPABASE_URL or ANON KEY at runtime.");
      const url = `${supabaseUrl}/auth/v1/token?grant_type=password`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnon,
          Authorization: `Bearer ${supabaseAnon}`,
        },
        body: JSON.stringify({ email, password }),
      });
      const text = await resp.text();
      setProbe(`Auth token POST → status ${resp.status}. Body: ${text.slice(0, 400)}${text.length > 400 ? "…" : ""}`);
    } catch (err: any) {
      setProbe(`Connectivity test failed: ${err?.message ?? String(err)}`);
    }
  }

  return (
    <div className="relative">
      {/* Top banner */}
      <div className="relative isolate overflow-hidden rounded-3xl border border-black/5 bg-gradient-to-br from-brand-light/25 via-white to-white p-8 dark:border-white/10 dark:from-brand-darkPurple/25 dark:via-black dark:to-black">
        <div className="container-app grid items-center gap-10 md:grid-cols-2">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-brand-darkPurple dark:text-brand-light md:text-5xl">
              Welcome back
            </h1>
            <p className="text-gray-700 dark:text-gray-300">Login to access Adeer HR — attendance, leave, roles and reports in one place.</p>
            <div className="flex items-center gap-3 text-sm">
              <Link href="/" className="text-brand-primary hover:underline">Home</Link>
              <span className="opacity-40">•</span>
              <a href="#contact-hr" className="text-brand-primary hover:underline">Contact HR</a>
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm">
            <div className="rounded-2xl border border-black/5 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#0b0b0b]/70">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">{mode === "login" ? "Login" : "Create account"}</h2>
                <button
                  type="button"
                  onClick={() => setMode(mode === "login" ? "signup" : "login")}
                  className="text-xs text-brand-primary hover:underline"
                >
                  {mode === "login" ? "Need an account? Sign up" : "Have an account? Login"}
                </button>
              </div>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="email" className="block text-sm">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-brand-primary"
                    placeholder="you@company.com"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="password" className="block text-sm">Password</label>
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-md bg-brand-primary px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? (mode === "login" ? "Signing in…" : "Creating…") : (mode === "login" ? "Login" : "Create account")}
                </button>
                <button
                  type="button"
                  onClick={restLogin}
                  className="w-full rounded-md bg-brand-primary/10 px-4 py-2 text-brand-primary border border-brand-primary/30 hover:bg-brand-primary/20"
                >
                  Login using REST (fallback)
                </button>
                <button
                  type="button"
                  onClick={runConnectivityTest}
                  className="w-full rounded-md border px-4 py-2 text-sm"
                >
                  Run Auth Connectivity Test
                </button>
              </form>
              {message && <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{message}</p>}
              {probe && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 break-words">{probe}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
