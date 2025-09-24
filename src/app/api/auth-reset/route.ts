import { NextRequest, NextResponse } from "next/server";
import { cookies } from 'next/headers';

/**
 * API endpoint for completely resetting auth state
 */
export async function POST(request: NextRequest) {
  try {
    // Clear all cookies related to authentication
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    
    for (const cookie of allCookies) {
      // Try to remove any auth-related cookies
      if (cookie.name.includes('auth') || 
          cookie.name.includes('supabase') || 
          cookie.name.includes('sb-')) {
        cookies().delete(cookie.name);
      }
    }
    
    // Try to call Supabase signout endpoint if credentials available
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      try {
        const signoutUrl = `${supabaseUrl}/auth/v1/logout`;
        await fetch(signoutUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`
          }
        });
      } catch (e) {
        // Ignore errors here
        console.warn("Failed to call Supabase logout endpoint:", e);
      }
    }
    
    return NextResponse.json({ 
      success: true,
      message: "Auth state reset successfully" 
    });
  } catch (error: any) {
    console.error("Auth reset error:", error);
    return NextResponse.json(
      { error: error.message || "Auth reset error" },
      { status: 500 }
    );
  }
}
