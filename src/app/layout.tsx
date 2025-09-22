import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import HeaderBadges from "@/components/HeaderBadges";
import { ThemeProvider } from "next-themes";
import ThemeToggle from "@/components/ThemeToggle";
import PWARegister from "@/components/PWARegister";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Adeer HR",
  description: "Adeer HR System",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#4D6BF1" />
      </head>
      <body className={`${inter.className} min-h-dvh bg-[var(--background)] text-[var(--foreground)]`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <PWARegister />
          <header className="sticky top-0 z-20 border-b border-black/5 bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:border-white/10 dark:bg-black/40">
            <div className="container-app flex items-center justify-between gap-3 py-3">
              <Link href="/" className="flex items-center gap-3">
                <Image src="/logo/adeer logo.png" alt="Adeer HR" width={36} height={36} />
                <span className="text-lg font-semibold tracking-tight">Adeer HR</span>
              </Link>

              <div id="header-actions" className="flex items-center gap-3">
                <HeaderBadges />
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main className="container-app py-8 md:py-10">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}

