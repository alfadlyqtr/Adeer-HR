"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  // If already authenticated, redirect based on role
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!active) return;
        if (error) return; // Stay on login
        if (!session) return; // Not logged in

        // Fetch role
        const { data: userProfile, error: profileError } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (!active) return;

        if (profileError) {
          // Create default profile and go to staff
          if ((profileError as any).code === 'PGRST116') {
            const { error: insertError } = await supabase
              .from("users")
              .insert({ id: session.user.id, email: session.user.email, role: "staff" });
            if (!insertError) {
              router.replace("/staff");
              return;
            }
          }
          return; // If other error, stay here
        }

        const role = (userProfile as any)?.role;
        if (role === "hr" || role === "ceo") router.replace("/hr");
        else if (role === "manager" || role === "assistant_manager") router.replace("/manager");
        else router.replace("/staff");
      } catch {}
    })();
    return () => { active = false; };
  }, [router]);

  const handleLogin = async () => {
    try {
      setMessage(null);
      setLoading(true);

      console.log("Attempting login with:", email);
      
      // Use Supabase SDK for login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Login error:", error);
        throw error;
      }

      if (!data.user) {
        throw new Error("No user returned from login");
      }

      console.log("Login successful, user:", data.user.id);

      // Check if user profile exists
      const { data: userProfile, error: profileError } = await supabase
        .from("users")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profileError) {
        console.error("Error fetching user profile:", profileError);
        
        // If user doesn't exist in users table, create with default role
        if ((profileError as any).code === 'PGRST116') {
          console.log("Creating user profile with default staff role");
          const { error: insertError } = await supabase
            .from("users")
            .insert({
              id: data.user.id,
              email: data.user.email,
              role: "staff"
            });
          
          if (insertError) {
            console.error("Error creating user profile:", insertError);
            throw new Error("Failed to create user profile");
          }
          
          // Redirect to staff dashboard as default
          router.push("/staff");
          return;
        }
        throw profileError;
      }

      console.log("User role:", (userProfile as any).role);

      // Redirect based on role
      const role = (userProfile as any).role;
      if (role === "hr" || role === "ceo") {
        router.push("/hr");
      } else if (role === "manager" || role === "assistant_manager") {
        router.push("/manager");
      } else if (role === "staff") {
        router.push("/staff");
      } else {
        router.push("/staff"); // Default fallback
      }

    } catch (err: any) {
      console.error("Login failed:", err);
      setMessage(err?.message ?? "Login failed");
    } finally {
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
      }
    } catch (err: any) {
      setMessage(err?.message ?? "Signup failed");
    } finally {
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

  // Test connectivity function
  const testConnectivity = async () => {
    setMessage(null);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      setMessage(`✅ Supabase connection OK. Session: ${data.session ? 'Active' : 'None'}` );
    } catch (err: any) {
      setMessage(`❌ Connection failed: ${err?.message}` );
    }
  };

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
          </div>

          <div className="mx-auto w-full max-w-sm">
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
                
                <button
                  type="button"
                  onClick={testConnectivity}
                  className="w-full rounded-md border px-4 py-2 text-sm"
                >
                  Test Connection
                </button>
              </form>
              
              {message && (
                <p className={`mt-3 text-sm ${message.includes('❌') ? 'text-rose-600' : message.includes('✅') ? 'text-emerald-600' : 'text-gray-600 dark:text-gray-300'}` }>
                  {message}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
