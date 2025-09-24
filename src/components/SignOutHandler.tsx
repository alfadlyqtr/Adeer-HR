"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignOutHandler() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleSignOut = async () => {
      try {
        // Clear all storage items that could contain auth data
        try {
          // Local storage cleanup
          window.localStorage.removeItem('supabase.auth.token');
          window.localStorage.removeItem('sb-refresh-token');
          window.localStorage.removeItem('sb-access-token');
          
          // Session storage cleanup
          window.sessionStorage.removeItem('supabase.auth.token');
          window.sessionStorage.removeItem('sb-refresh-token');
          window.sessionStorage.removeItem('sb-access-token');
        } catch (e) {
          console.warn('Storage cleanup error (non-fatal):', e);
        }

        // Attempt to fetch and use the supabase client (with error guards)
        try {
          // Import dynamically to avoid initialization errors
          const { supabase } = await import('@/lib/supabaseClient');
          if (supabase && supabase.auth && typeof supabase.auth.signOut === 'function') {
            await supabase.auth.signOut();
          }
        } catch (e) {
          console.warn('Supabase signOut error (non-fatal):', e);
        }

        // Add a delay to ensure everything is cleared
        setTimeout(() => {
          // Force navigation to login page
          window.location.href = '/login?signout=complete';
        }, 800);
      } catch (err: any) {
        console.error('Sign out error:', err);
        setMessage(`Sign out error: ${err?.message || 'Unknown error'}`); 
        
        // Still try to redirect after error
        setTimeout(() => {
          window.location.href = '/login?signout=error';
        }, 1000);
      }
    };

    // Start the signout process
    handleSignOut();
    
  }, []);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="rounded-lg border bg-white p-6 shadow-sm dark:bg-[#0b0b0b]">
        <h1 className="mb-4 text-xl font-semibold">Signing Out...</h1>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"></div>
          <p>Please wait while we sign you out</p>
        </div>
        {message && <p className="mt-4 text-sm text-rose-600">{message}</p>}
      </div>
    </div>
  );
}
