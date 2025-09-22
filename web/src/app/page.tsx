import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import QuotesRotator from "@/components/QuotesRotator";
import AutoRedirectDashboard from "@/components/AutoRedirectDashboard";

export default function Home() {
  // Load quotes from project root file d:\\CascadeProjects\\Adeer-HR\\quots
  // At runtime in Next, resolve relative to repo root by stepping up from web/.
  let quotes: string[] = [];
  try {
    const filePath = path.resolve(process.cwd(), "..", "quots");
    const raw = fs.readFileSync(filePath, "utf8");
    quotes = raw
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0 && !/^\p{Emoji}|^[\p{S}\p{P}]{1,3}$/u.test(l))
      .filter((l) => !l.endsWith(":"));
  } catch {}

  // Choose a deterministic initial index on the server to avoid hydration mismatch
  const initialIndex = quotes.length
    ? Math.abs(new Date().getUTCMinutes()) % quotes.length
    : 0;

  return (
    <div className="relative">
      {/* If authenticated, redirect to proper dashboard */}
      <AutoRedirectDashboard />
      {/* Hero section */}
      <section className="relative isolate overflow-hidden rounded-3xl border border-black/5 bg-gradient-to-br from-brand-light/20 via-white to-white p-10 shadow-md backdrop-blur dark:border-white/10 dark:from-brand-darkPurple/25 dark:via-black dark:to-black md:p-14">
        <div className="container-app grid items-center gap-10 md:grid-cols-2">
          <div className="flex flex-col items-start gap-4 text-left">
            <span className="inline-flex items-center rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-primary ring-1 ring-brand-primary/20">
              Made for modern teams
            </span>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-brand-darkPurple dark:text-brand-light md:text-6xl">
              Adeer HR
            </h1>
            <p className="text-xl font-medium text-brand-darkPurple/80 dark:text-brand-light/90">
              Attendance & Staff Management Simplified
            </p>
            <p className="max-w-xl text-base text-gray-700 dark:text-gray-300">
              One place for attendance, leave, roles, and reports — fast, clean, and mobile-first.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="rounded-xl bg-brand-primary px-6 py-3 text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              >
                Login to HR System
              </Link>
              <Link
                href="#contact-hr"
                className="rounded-xl border border-brand-primary px-6 py-3 text-brand-primary transition hover:bg-brand-primary/5 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              >
                Contact HR
              </Link>
            </div>
          </div>
          <div className="hidden justify-end md:flex">
            <div className="card w-full max-w-sm">
              <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Quick Snapshot</h3>
              <ul className="grid grid-cols-2 gap-3 text-sm">
                <li className="rounded-xl border border-black/5 p-3 text-center dark:border-white/10">
                  <div className="text-2xl font-bold text-brand-primary">✓</div>
                  <div className="mt-1 text-gray-600 dark:text-gray-300">Attendance</div>
                </li>
                <li className="rounded-xl border border-black/5 p-3 text-center dark:border-white/10">
                  <div className="text-2xl font-bold text-brand-primary">↻</div>
                  <div className="mt-1 text-gray-600 dark:text-gray-300">Leaves</div>
                </li>
                <li className="rounded-xl border border-black/5 p-3 text-center dark:border-white/10">
                  <div className="text-2xl font-bold text-brand-primary">☰</div>
                  <div className="mt-1 text-gray-600 dark:text-gray-300">Roles</div>
                </li>
                <li className="rounded-xl border border-black/5 p-3 text-center dark:border-white/10">
                  <div className="text-2xl font-bold text-brand-primary">📈</div>
                  <div className="mt-1 text-gray-600 dark:text-gray-300">Reports</div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Quotes section */}
      <section className="container-app mt-12">
        {/* Gradient border + glow wrapper for more life */}
        <div className="rounded-3xl p-[1px] brand-gradient brand-glow">
          <div className="card rounded-[calc(1.5rem-1px)]">
            <h2 className="section-title">Daily Inspiration</h2>
            <QuotesRotator quotes={quotes} initialIndex={initialIndex} />
          </div>
        </div>
      </section>

      {/* Contact HR */}
      <section id="contact-hr" className="container-app mt-12">
        <div className="card glass">
          <h2 className="section-title">Contact HR</h2>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Need help with access or your account? Reach out to HR.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:hr@company.com"
              className="rounded-xl bg-brand-primary px-5 py-2.5 text-white hover:opacity-90"
            >
              Email HR
            </a>
            <a
              href="tel:+0000000000"
              className="rounded-xl border border-brand-primary px-5 py-2.5 text-brand-primary hover:bg-brand-primary/5"
            >
              Call HR
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

