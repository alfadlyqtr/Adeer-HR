"use client";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";

export default function SettingsButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push("/settings")}
      className="rounded-md border border-white/10 bg-white/5 p-2 transition hover:bg-white/10 hover:border-brand-primary/30"
      title="Settings"
      aria-label="Open Settings"
    >
      <Settings size={20} className="text-current" />
    </button>
  );
}
