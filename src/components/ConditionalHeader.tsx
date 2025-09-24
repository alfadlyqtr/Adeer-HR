"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import HeaderBadges from "@/components/HeaderBadges";
import LogoutButton from "@/components/LogoutButton";

export default function ConditionalHeader() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setIsLoggedIn(!!session);
        }
      } catch (e) {
        console.error("Auth check error:", e);
        if (mounted) {
          setIsLoggedIn(false);
        }
      }
    };
    
    checkAuth();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') setIsLoggedIn(true);
      if (event === 'SIGNED_OUT') setIsLoggedIn(false);
    });
    
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-black/5 bg-white/60 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:border-white/10 dark:bg-black/40">
      <div className="container-app flex items-center justify-between gap-3 py-3">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo/adeer logo.png" alt="Adeer HR" width={36} height={36} />
          <span className="text-lg font-semibold tracking-tight">Adeer HR</span>
        </Link>

        <div className="flex items-center gap-3">
          {/* Show different items based on login state */}
          {isLoggedIn === true ? (
            <>
              <HeaderBadges />
              <LogoutButton />
            </>
          ) : isLoggedIn === false ? (
            <Link 
              href="/login" 
              className="inline-flex h-9 px-4 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Login
            </Link>
          ) : null}
          
          {/* Always show theme toggle */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
