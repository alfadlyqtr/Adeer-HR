"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AutoRedirectDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    
    const checkAuthAndRedirect = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!active) return;
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          router.replace("/login");
          return;
        }

        if (!session) {
          router.replace("/login");
          return;
        }

        // Get user role
        const { data: userProfile, error: profileError } = await supabase
          .from("users")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (!active) return;

        if (profileError) {
          console.error("Profile error:", profileError);
          // Create default profile if none exists
          if ((profileError as any).code === 'PGRST116') {
            const { error: insertError } = await supabase
              .from("users")
              .insert({
                id: session.user.id,
                email: session.user.email,
                role: "staff"
              });
            
            if (!insertError) {
              router.replace("/staff");
              return;
            }
          }
          router.replace("/login");
          return;
        }

        const role = (userProfile as any).role;
        if (role === "hr" || role === "ceo") {
          router.replace("/hr");
        } else if (role === "manager" || role === "assistant_manager") {
          router.replace("/manager");
        } else if (role === "staff") {
          router.replace("/staff");
        } else {
          router.replace("/staff"); // Default fallback
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndRedirect();
    
    return () => { active = false; };
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-2"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return null;
}
