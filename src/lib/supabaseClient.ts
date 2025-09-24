"use client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Store the initialized client in memory for client-side use
// Using any to avoid TypeScript errors with different versions of the Supabase client
let cachedClient: SupabaseClient | null = null;

// Get the client-side URL and key (from environment or localStorage if set there)
const getCredentials = () => {
  // Check for credentials in localStorage (useful for testing)
  if (typeof window !== 'undefined') {
    const storedUrl = localStorage.getItem('supabase_test_url');
    const storedKey = localStorage.getItem('supabase_test_key');
    
    if (storedUrl && storedKey) {
      return { url: storedUrl, key: storedKey, source: 'localStorage' };
    }
  }
  
  // Get from environment variables
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  return { url, key, source: 'env' };
};

// Create and initialize the Supabase client
const initializeClient = () => {
  // Skip initialization if we already have a client
  if (cachedClient) return cachedClient;
  
  try {
    const { url, key, source } = getCredentials();
    
    // Check for valid credentials
    if (!url || !key) {
      console.error('Invalid Supabase credentials. Authentication will not work properly.', 
        { url: url ? '✓' : '✗', key: key ? '✓' : '✗', source });
      throw new Error('Missing Supabase credentials');
    }
    
    // Create the client
    const client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    
    // Test the client by getting the current session
    (async () => {
      try {
        await client.auth.getSession();
        console.log('Supabase client initialized successfully');
      } catch (err) {
        console.error('Supabase client initialization test failed:', err);
      }
    })();
    
    // Cache and return the client
    cachedClient = client as any;
    return client;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    
    // Create a dummy client for development that won't crash the app
    const dummyClient = createClient('https://example.com', 'dummy-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    
    return dummyClient;
  }
};

// Export the initialized client
export const supabase = initializeClient();

// Export a function to reset the client (useful for testing)
export const resetSupabaseClient = (url?: string, key?: string) => {
  if (url && key) {
    // Store credentials in localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('supabase_test_url', url);
      localStorage.setItem('supabase_test_key', key);
    }
  } else {
    // Clear stored credentials
    if (typeof window !== 'undefined') {
      localStorage.removeItem('supabase_test_url');
      localStorage.removeItem('supabase_test_key');
    }
  }
  
  // Clear the cached client
  cachedClient = null;
  
  // Reinitialize and return
  return initializeClient();
};
