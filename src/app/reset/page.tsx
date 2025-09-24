"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Reset page that clears all state and redirects to login
 */
export default function ResetPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Do a complete cleanup of all state
    const cleanup = async () => {
      try {
        console.log('Starting state reset...');
        
        // Clear all local storage
        localStorage.clear();
        sessionStorage.clear();
        
        // Clear specific auth tokens
        localStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('sb-access-token');
        localStorage.removeItem('sb-refresh-token');
        sessionStorage.removeItem('supabase.auth.token');
        sessionStorage.removeItem('sb-access-token');
        sessionStorage.removeItem('sb-refresh-token');
        
        // Also try to sign out via API to be thorough
        try {
          await fetch('/api/auth-reset', { method: 'POST' });
        } catch (err) {
          // Ignore errors here
        }
        
        console.log('Reset complete, redirecting to login...');
        
        // Wait a moment then redirect
        setTimeout(() => {
          window.location.href = '/login?reset=complete';
        }, 1000);
      } catch (err) {
        console.error('Error during state reset:', err);
        // Still try to redirect
        window.location.href = '/login?reset=error';
      }
    };
    
    cleanup();
  }, []);
  
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="rounded-lg border bg-white p-6 shadow-md dark:bg-[#0b0b0b]">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
          <h1 className="text-lg font-medium">Resetting Application...</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Please wait while we clear all application data.</p>
          <p className="text-xs text-gray-500">You'll be redirected to the login page shortly.</p>
        </div>
      </div>
    </div>
  );
}
