"use client";
import { useState } from "react";
import { supabase, resetSupabaseClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  const handleLogin = async () => {
    try {
      setMessage(null);
      setLoading(true);

      console.log("Attempting login with proxy:", email);
      
      // Use our proxy endpoint to avoid CORS issues
      try {
        // First check if we can reach our own API endpoint
        const healthCheck = await fetch('/api/auth-proxy');
        console.log('API connectivity check:', healthCheck.ok);
      } catch (networkErr) {
        console.warn('Network connectivity test failed:', networkErr);
        // Continue anyway as the actual auth call may still work
      }
      
      // Try to login using our proxy endpoint
      const proxyResponse = await fetch('/api/auth-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          // Pass through Supabase credentials from env or custom inputs
          supabaseUrl: supabaseUrl || undefined,
          supabaseKey: supabaseKey || undefined
        })
      });
      
      // Check for HTTP errors
      if (!proxyResponse.ok) {
        const errorData = await proxyResponse.json();
        throw new Error(errorData.error || `Login failed with status ${proxyResponse.status}`);
      }
      
      // Parse the response
      const authData = await proxyResponse.json().catch(() => ({}));
      
      // Validate response format
      if (!authData || typeof authData !== 'object') {
        throw new Error("Invalid response format from authentication server");
      }
      
      // Validate the response
      if (authData.error) {
        throw new Error(authData.error_description || authData.error);
      }
      
      if (!authData.access_token) {
        throw new Error("No access token returned");
      }
      
      // Store the tokens in localStorage for Supabase client to use
      localStorage.setItem('sb-access-token', authData.access_token);
      localStorage.setItem('sb-refresh-token', authData.refresh_token);

      console.log("Login successful, redirecting to dashboard");
      
      // Wait a moment for tokens to be stored
      setTimeout(() => {
        // Always go to central dashboard for proper role-based routing
        window.location.href = "/dashboard";
      }, 500);

    } catch (err: any) {
      console.error("Login failed:", err);
      // Provide more helpful error messages based on error types
      if (err.message?.includes('Failed to fetch')) {
        setMessage('Network error: Unable to connect to the authentication service. Please check your internet connection.');
      } else if (err.message?.includes('timed out')) {
        setMessage('Request timed out. The server is taking too long to respond.');
      } else if (err.message?.includes('Invalid login')) {
        setMessage('Invalid email or password. Please try again.');
      } else if (err.message?.includes('CORS')) {
        setMessage('Cross-origin request blocked. Using proxy server instead.');
        // Try alternative authentication method
        handleDirectLogin();
        return;
      } else {
        setMessage(err?.message ?? "Login failed");
      }
      setLoading(false);
    }
  };
  
  // Fallback to direct Supabase connection if proxy fails
  const handleDirectLogin = async () => {
    try {
      setMessage("Trying direct authentication...");
      
      // Use Supabase SDK for login with timeout
      const loginPromise = supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Login request timed out after 10 seconds')), 10000);
      });
      
      // Race the login against a timeout
      const result = await Promise.race([loginPromise, timeoutPromise])
        .then(result => result as Awaited<typeof loginPromise>)
        .catch(err => {
          throw err; // Rethrow to be caught by the outer try-catch
        });
        
      // Check if result exists and has expected structure
      if (!result) {
        throw new Error("Authentication returned empty result");
      }
      
      const { data, error } = result;

      if (error) {
        console.error("Direct login error:", error);
        throw error;
      }

      if (!data?.user) {
        throw new Error("No user returned from login");
      }

      console.log("Direct login successful, redirecting to dashboard");
      window.location.href = "/dashboard";
      
    } catch (err: any) {
      console.error("Direct login failed:", err);
      setMessage(`Direct login also failed: ${err?.message}`);
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    try {
      setMessage(null);
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password 
      });

      if (error) throw error;

      if (data.user) {
        setMessage("Account created. Please check your email to verify before login.");
        setLoading(false);
      }
    } catch (err: any) {
      setMessage(err?.message ?? "Signup failed");
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === "login") {
      await handleLogin();
    } else {
      await handleSignup();
    }
  };

  // Show advanced debug options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState<string>('');
  const [supabaseKey, setSupabaseKey] = useState<string>('');
  
  // Test connectivity function
  const testConnectivity = async () => {
    setMessage(null);
    try {
      // Try using custom client if we have custom values
      if (showAdvanced && supabaseUrl && supabaseKey) {
        // Use our reset function to create a new client with the custom credentials
        const testClient = resetSupabaseClient(supabaseUrl, supabaseKey);
        const { data, error } = await testClient.auth.getSession();
        
        if (error) throw error;
        setMessage(`✅ Custom connection OK. Session: ${data.session ? 'Active' : 'None'}`);
        return;
      }
      
      // Otherwise use default client
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      setMessage(`✅ Supabase connection OK. Session: ${data.session ? 'Active' : 'None'}` );
    } catch (err: any) {
      setMessage(`❌ Connection failed: ${err?.message}` );
    }
  };

  // Handle force sign out
  const handleForceSignOut = async () => {
    try {
      setMessage("Forcing sign out...");
      await supabase.auth.signOut();
      // Force clear tokens
      window.localStorage.removeItem('supabase.auth.token');
      window.sessionStorage.removeItem('supabase.auth.token');
      window.localStorage.removeItem('sb-refresh-token');
      window.localStorage.removeItem('sb-access-token');
      window.sessionStorage.removeItem('sb-refresh-token');
      window.sessionStorage.removeItem('sb-access-token');
      window.location.href = '/login?signout=complete';
    } catch (err: any) {
      setMessage(`Sign out error: ${err?.message}`);
    }
  };
  
  // Login with custom client
  const handleCustomLogin = async () => {
    if (!supabaseUrl || !supabaseKey) {
      setMessage('Please provide both Supabase URL and anon key');
      return;
    }
    
    try {
      setMessage(null);
      setLoading(true);
      
      // Use our reset function which will persist these credentials in localStorage
      const customClient = resetSupabaseClient(supabaseUrl, supabaseKey);
      
      const { data, error } = await customClient.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      if (!data?.user) {
        throw new Error("No user returned from login");
      }
      
      setMessage('✅ Login successful with custom client! Redirecting...');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
      
    } catch (err: any) {
      console.error('Custom login failed:', err);
      setMessage(`❌ Custom login failed: ${err?.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-black/5 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#0b0b0b]/70">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{mode === "login" ? "Login" : "Create account"}</h2>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="text-xs text-brand-primary hover:underline"
        >
          {mode === "login" ? "Need an account? Sign up" : "Have an account? Login"}
        </button>
      </div>
      
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-brand-primary"
            placeholder="you@company.com"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-brand-primary"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-primary px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? (mode === "login" ? "Signing in…" : "Creating…") : (mode === "login" ? "Login" : "Create account")}
        </button>
        
        {/* Connection test and debug buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={testConnectivity}
            className="flex-1 rounded-md border px-3 py-2 text-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
          >
            Test Connection
          </button>
          <button
            type="button"
            onClick={handleForceSignOut}
            className="flex-1 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400"
          >
            Force Sign Out
          </button>
        </div>
        
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-brand-primary hover:underline"
          >
            {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}
          </button>
        </div>
        
        {showAdvanced && (
          <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-900/20">
            <h4 className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-300">Custom Connection Settings</h4>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-amber-800 dark:text-amber-300">Supabase URL</label>
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="w-full rounded border border-amber-200 bg-white px-2 py-1 text-xs dark:border-amber-800 dark:bg-black/30"
                />
              </div>
              <div>
                <label className="block text-xs text-amber-800 dark:text-amber-300">Anon Key</label>
                <input
                  type="password"
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1..."
                  className="w-full rounded border border-amber-200 bg-white px-2 py-1 text-xs dark:border-amber-800 dark:bg-black/30"
                />
              </div>
              <button
                type="button"
                onClick={handleCustomLogin}
                disabled={!supabaseUrl || !supabaseKey || loading}
                className="w-full rounded bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Login with Custom Client
              </button>
            </div>
          </div>
        )}
      </form>
      
      {message && (
        <p className={`mt-3 text-sm ${message.includes('❌') ? 'text-rose-600' : message.includes('✅') ? 'text-emerald-600' : message.includes('Forcing') ? 'text-amber-500' : 'text-gray-600 dark:text-gray-300'}` }>
          {message}
        </p>
      )}
    </div>
  );
}
