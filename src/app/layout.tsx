import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import PWARegister from "@/components/PWARegister";
import ConditionalHeader from "@/components/ConditionalHeader";

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
          <ConditionalHeader />
          <main className="container-app py-8 md:py-10">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}

