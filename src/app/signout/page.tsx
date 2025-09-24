"use client";
import SignOutHandler from "@/components/SignOutHandler";
import { useEffect } from "react";

export default function SignOutPage() {
  // Backup client-side redirect if the component fails
  useEffect(() => {
    // Set a timeout as a fallback if the component fails
    const timeoutId = setTimeout(() => {
      try {
        // Clear common auth tokens
        window.localStorage.removeItem('supabase.auth.token');
        window.sessionStorage.removeItem('supabase.auth.token');
        // Force redirect
        window.location.href = '/login?signout=backup';
      } catch (e) {
        console.error('Backup signout failed:', e);
      }
    }, 3000); // 3 seconds failsafe
    
    return () => clearTimeout(timeoutId);
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SignOutHandler />
    </div>
  );
}
