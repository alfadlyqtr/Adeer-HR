import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      email,
      fullName,
      role = "staff",
      employmentId,
      tempPassword,
      // Optional profile fields (ignored if not present)
      phone,
      nationality,
      joiningDate,
      address,
      passportNumber,
      passportIssueDate,
      passportExpiryDate,
      idNumber,
      idExpiryDate,
      driverLicenseNumber,
      driverLicenseExpiryDate,
      notes,
    } = body || {};

    if (!email || !tempPassword) {
      return NextResponse.json({ error: "email and tempPassword are required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // 1) Create auth user with temp password and confirmed email
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName || null, must_change_password: true }
    });
    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 400 });
    }
    const uid = created.user?.id;
    if (!uid) {
      return NextResponse.json({ error: "Failed to create auth user" }, { status: 400 });
    }

    // 2) Insert minimal profile row, handling possible schema differences
    // Try progressively simpler payloads to avoid NOT NULL or missing column errors
    const nameValue = fullName || email; // common schema requires `name` NOT NULL
    let usersErr: any = null;
    {
      const { error } = await admin.from("users").insert({ id: uid, email, full_name: fullName || null, name: nameValue });
      usersErr = error;
    }
    if (usersErr) {
      // Retry without full_name in case column doesn't exist
      const { error: err2 } = await admin.from("users").insert({ id: uid, email, name: nameValue });
      usersErr = err2;
    }
    if (usersErr) {
      // Final fallback: insert minimal columns only
      const { error: err3 } = await admin.from("users").insert({ id: uid, email });
      if (err3) {
        // If all attempts failed, don't block auth user creation; log and continue
        console.warn("[create-staff] users insert failed: ", usersErr?.message || err3?.message);
      }
    }

    // Optional: Best-effort update of extra fields if those columns exist in your schema
    // We won't fail the request if these columns don't exist.
    const extra: Record<string, any> = {};
    if (employmentId !== undefined) extra.employment_id = employmentId;
    if (phone !== undefined) extra.phone = phone;
    if (nationality !== undefined) extra.nationality = nationality;
    if (joiningDate !== undefined) extra.joining_date = joiningDate;
    if (address !== undefined) extra.address = address;
    if (passportNumber !== undefined) extra.passport_number = passportNumber;
    if (passportIssueDate !== undefined) extra.passport_issue_date = passportIssueDate;
    if (passportExpiryDate !== undefined) extra.passport_expiry_date = passportExpiryDate;
    if (idNumber !== undefined) extra.id_number = idNumber;
    if (idExpiryDate !== undefined) extra.id_expiry_date = idExpiryDate;
    if (driverLicenseNumber !== undefined) extra.driver_license_number = driverLicenseNumber;
    if (driverLicenseExpiryDate !== undefined) extra.driver_license_expiry_date = driverLicenseExpiryDate;
    if (notes !== undefined) extra.notes = notes;

    if (Object.keys(extra).length > 0) {
      const { error: extraErr } = await admin.from("users").update(extra).eq("id", uid);
      if (extraErr) {
        // Log and continue; don't break the main flow
        console.warn("[create-staff] optional users extra update failed:", extraErr.message);
      }
    }

    // 3) Upsert role in user_roles
    const { error: roleErr } = await admin.from("user_roles").upsert({ user_id: uid, role });
    if (roleErr) {
      // Non-fatal; continue
      console.warn("user_roles upsert failed:", roleErr.message);
    }

    return NextResponse.json({ ok: true, user_id: uid, tempPassword });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
