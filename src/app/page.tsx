import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import QuotesRotator from "@/components/QuotesRotator";

export default function Home() {
  // Load quotes from project root file d:\\CascadeProjects\\Adeer-HR\\quots
  // At runtime in Next, resolve relative to repo root by stepping up from web/.
  let quotes: string[] = [];
  try {
    const filePath = path.resolve(process.cwd(), "quots");
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
      {/* Home page no longer auto-redirects. Use /dashboard as the role checker route. */}
      {/* Hero Section (gradient banner) */}
      <section className="relative isolate overflow-hidden brand-gradient rounded-3xl p-10 text-white shadow-md md:p-14">
        <div className="pointer-events-none absolute -top-32 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-black/10 blur-3xl" />
        <div className="container-app grid items-center gap-10 md:grid-cols-2">
          <div className="flex flex-col items-start gap-4 text-left">
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Welcome to Adeer HR
            </h1>
            <p className="text-lg/7 md:text-xl">
              Your daily hub for attendance, leave, and growth.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="rounded-xl bg-white/95 px-6 py-3 font-medium text-brand-darkPurple shadow-sm transition hover:bg-white"
              >
                Login to HR System
              </Link>
              <Link
                href="#contact-hr"
                className="rounded-xl border border-white/70 px-6 py-3 text-white transition hover:bg-white/10"
              >
                Contact HR
              </Link>
            </div>
          </div>
          {/* Quick Access tiles beside hero on desktop */}
          <div className="hidden justify-end md:flex">
            <ul className="grid w-full max-w-md grid-cols-2 gap-4">
              <li className="tilt-card rounded-2xl bg-white/15 p-4 text-center shadow-sm backdrop-blur">
                <div className="text-2xl">✅</div>
                <div className="mt-1 text-sm">Attendance</div>
              </li>
              <li className="tilt-card rounded-2xl bg-white/15 p-4 text-center shadow-sm backdrop-blur">
                <div className="text-2xl">🕒</div>
                <div className="mt-1 text-sm">Leaves</div>
              </li>
              <li className="tilt-card rounded-2xl bg-white/15 p-4 text-center shadow-sm backdrop-blur">
                <div className="text-2xl">👥</div>
                <div className="mt-1 text-sm">Roles</div>
              </li>
              <li className="tilt-card rounded-2xl bg-white/15 p-4 text-center shadow-sm backdrop-blur">
                <div className="text-2xl">📑</div>
                <div className="mt-1 text-sm">Reports</div>
              </li>
            </ul>
          </div>
        </div>
      </section>


      {/* CEO Message + Daily Inspiration side-by-side */}
      <section className="container-app mt-10 md:mt-12">
        <div className="grid gap-6 md:grid-cols-2">
          {/* CEO Message Card */}
          <div className="card bg-brand-light/10 text-brand-darkPurple dark:text-brand-white">
            <div className="badge-ceo badge-ceo-light mb-3">CEO Message</div>
            <blockquote className="text-center text-base leading-relaxed md:text-lg">
              “At Adeer, every one of you is the heartbeat of our success. Take pride in your role, care for each other, and let’s grow together.”
            </blockquote>
            <div className="mt-4 text-center text-sm font-semibold whitespace-nowrap">≫ CEO Reema Al-kuwari</div>
          </div>

          {/* Daily Inspiration section (soft lavender/blue gradient box) */}
          <div className="rounded-3xl bg-gradient-to-br from-brand-light/20 via-[#f3e8ff] to-white p-6 shadow-sm dark:from-brand-darkPurple/25 dark:via-[#0b0b0b] dark:to-black">
            <div className="flex items-center gap-2">
              <span className="text-xl">💡</span>
              <h2 className="section-title !mb-0">Daily Inspiration</h2>
            </div>
            <div className="mt-3 rounded-2xl border border-black/5 bg-white/90 p-4 dark:border-white/10 dark:bg-[#0b0b0b]/70">
              {quotes.length ? (
                <QuotesRotator quotes={quotes} initialIndex={initialIndex} />
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-300">No inspiration quotes available.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Quick Access (mobile-first separate section) */}
      <section className="container-app mt-10 md:mt-12 md:hidden">
        <h2 className="section-title">Quick Access</h2>
        <ul className="grid grid-cols-2 gap-4">
          <li className="tilt-card rounded-2xl border border-black/5 bg-white p-4 text-center shadow-sm dark:border-white/10 dark:bg-[#0b0b0b]">
            <div className="text-2xl">✅</div>
            <div className="mt-1 text-sm">Attendance</div>
          </li>
          <li className="tilt-card rounded-2xl border border-black/5 bg-white p-4 text-center shadow-sm dark:border-white/10 dark:bg-[#0b0b0b]">
            <div className="text-2xl">🕒</div>
            <div className="mt-1 text-sm">Leaves</div>
          </li>
          <li className="tilt-card rounded-2xl border border-black/5 bg-white p-4 text-center shadow-sm dark:border-white/10 dark:bg-[#0b0b0b]">
            <div className="text-2xl">👥</div>
            <div className="mt-1 text-sm">Roles</div>
          </li>
          <li className="tilt-card rounded-2xl border border-black/5 bg-white p-4 text-center shadow-sm dark:border-white/10 dark:bg-[#0b0b0b]">
            <div className="text-2xl">📑</div>
            <div className="mt-1 text-sm">Reports</div>
          </li>
        </ul>
      </section>

      
    </div>
  );
}
