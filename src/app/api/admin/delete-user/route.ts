import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { user_id } = await req.json();
    if (!user_id) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Delete Auth user
    const { error: authErr } = await admin.auth.admin.deleteUser(user_id);
    if (authErr) {
      // If the auth user doesn't exist, continue cleanup in DB
      console.warn("[delete-user] auth delete warning:", authErr.message);
    }

    // Delete from application tables
    await admin.from("user_roles").delete().eq("user_id", user_id);
    const { error: usersErr } = await admin.from("users").delete().eq("id", user_id);
    if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
