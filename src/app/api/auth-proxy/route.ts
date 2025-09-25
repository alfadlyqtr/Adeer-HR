import { NextRequest, NextResponse } from "next/server";

/**
 * Simple auth proxy to avoid CORS issues with Supabase
 * This proxies requests to Supabase through our Next.js server
 */
export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();

    // Get Supabase URL from environment or request
    const supabaseUrl = requestData.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Get anon key from environment or request
    const supabaseKey = requestData.supabaseKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Validate parameters
    if (!supabaseUrl) {
      return NextResponse.json({ error: "Missing Supabase URL" }, { status: 400 });
    }

    if (!supabaseKey) {
      return NextResponse.json({ error: "Missing Supabase anon key" }, { status: 400 });
    }

    // Construct auth endpoint URL
    const authEndpoint = `${supabaseUrl}/auth/v1/token`;

    // Call the Supabase API
    const response = await fetch(authEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        email: requestData.email,
        password: requestData.password,
        grant_type: "password"
      })
    });

    // Get response data
    const responseData = await response.json();

    // Return proxied response
    return NextResponse.json(
      responseData,
      { status: response.status }
    );
  } catch (error: any) {
    console.error("Auth proxy error:", error);
    return NextResponse.json(
      { error: error.message || "Auth proxy error" },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint
 */
export async function GET(request: NextRequest) {
  try {
    // Extract URL parameters
    const { searchParams } = new URL(request.url);
    const supabaseUrl = searchParams.get('url') || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = searchParams.get('key') || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Validate parameters
    if (!supabaseUrl) {
      return NextResponse.json({ error: "Missing Supabase URL" }, { status: 400 });
    }

    if (!supabaseKey) {
      return NextResponse.json({ error: "Missing Supabase anon key" }, { status: 400 });
    }

    // Try a simple health check
    const healthEndpoint = `${supabaseUrl}/rest/v1/`;

    const response = await fetch(healthEndpoint, {
      method: "GET",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      return NextResponse.json({
        error: "Supabase connection failed",
        status: response.status,
        statusText: response.statusText
      }, { status: response.status });
    }

    return NextResponse.json({
      ok: true,
      status: response.status,
      message: "Supabase connection successful"
    });
  } catch (error: any) {
    console.error("Health check error:", error);
    return NextResponse.json(
      { error: error.message || "Health check failed" },
      { status: 500 }
    );
  }
}
