import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    let page = 1;
    let synced = 0;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      const users = data.users || [];
      if (users.length === 0) break;

      // Upsert minimal rows into public.users and user_roles
      for (const u of users) {
        const uid = u.id;
        const email = u.email || null;
        const full_name = (u.user_metadata as any)?.full_name || null;
        const { error: upErr } = await admin.from("users").upsert({ id: uid, email, full_name }, { onConflict: "id" });
        if (!upErr) {
          synced++;
          await admin.from("user_roles").upsert({ user_id: uid, role: "staff" }, { onConflict: "user_id" });
        }
      }

      page++;
    }

    return NextResponse.json({ ok: true, synced });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
