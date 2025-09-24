"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoginForm from "./LoginForm";
import SupabaseTest from "./SupabaseTest";

export default function LoginPage() {
  const router = useRouter();
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [connectionChecked, setConnectionChecked] = useState(false);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);

  // Handle signout completion
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('signout')) {
      // Clear session storage to prevent stuck loops
      window.localStorage.removeItem('supabase.auth.token');
      window.sessionStorage.removeItem('supabase.auth.token');
      // Clear any other auth tokens
      window.localStorage.removeItem('sb-refresh-token');
      window.localStorage.removeItem('sb-access-token');
      window.sessionStorage.removeItem('sb-refresh-token');
      window.sessionStorage.removeItem('sb-access-token');
      // Clean up URL parameter
      if (typeof window !== 'undefined') {
        url.searchParams.delete('signout');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, []);

  // Test basic connectivity
  useEffect(() => {
    if (connectionChecked) return;
    
    const checkConnection = async () => {
      try {
        // Just a simple connection test
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        if (!supabaseUrl) {
          setConnectionOk(false);
          return;
        }
        
        const testResponse = await fetch(supabaseUrl, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache'
        }).catch(() => null);
        
        // With no-cors mode we can't check status, but if it didn't throw, the request went through
        setConnectionOk(true);
      } catch (e) {
        console.error('Connection test failed:', e);
        setConnectionOk(false);
      } finally {
        setConnectionChecked(true);
      }
    };
    
    checkConnection();
  }, [connectionChecked]);

  // Check if already authenticated, redirect to dashboard
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active || !session) return;
        
        console.log("User already signed in, redirecting to dashboard");
        router.replace("/dashboard");
      } catch (e) {
        console.error("Session check error:", e);
      }
    })();
    return () => { active = false; };
  }, [router]);

  return (
    <div className="relative">
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
            
            {/* Connection status indicator */}
            {connectionChecked && (
              <div className="mt-2">
                <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${connectionOk ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                  <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${connectionOk ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                  Supabase: {connectionOk ? 'Connected' : 'Connection Issues'}
                </div>
                {!connectionOk && (
                  <button 
                    onClick={() => setShowDiagnostics(true)}
                    className="ml-2 text-xs text-brand-primary hover:underline"
                  >
                    Show Diagnostics
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mx-auto w-full max-w-sm">
            <LoginForm />
            {showDiagnostics && <SupabaseTest />}
          </div>
        </div>
      </div>
    </div>
  );
}
