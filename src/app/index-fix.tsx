"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * This component fixes the runtime error by ensuring clean redirects
 */
export default function FixRuntimeError() {
  const router = useRouter();
  
  useEffect(() => {
    // Clear any problematic state or cached data
    if (typeof window !== 'undefined') {
      try {
        // Clear authentication tokens
        localStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('sb-access-token');
        localStorage.removeItem('sb-refresh-token');
        sessionStorage.removeItem('supabase.auth.token');
        sessionStorage.removeItem('sb-access-token');
        sessionStorage.removeItem('sb-refresh-token');
        
        // Redirect to login with a clean URL
        window.location.href = '/login';
      } catch (e) {
        console.error('Error during cleanup:', e);
      }
    }
  }, []);
  
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="rounded-lg border bg-white p-6 shadow-md dark:bg-[#0b0b0b]">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-primary border-t-transparent"></div>
          <h1 className="text-lg font-medium">Fixing Application State...</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Please wait while we resolve a technical issue.</p>
        </div>
      </div>
    </div>
  );
}
