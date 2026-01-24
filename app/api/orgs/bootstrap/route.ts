import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
    }

    // Create a user-scoped client to identify auth.uid()
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    const userId = userData?.user?.id;

    if (userErr || !userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    // If user already belongs to an org, do nothing
    const { data: existingMember } = await supabaseAdmin
      .from("org_members")
      .select("org_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (existingMember?.org_id) {
      return NextResponse.json({ ok: true, org_id: existingMember.org_id });
    }

    // Create org + membership
    const { data: org, error: orgErr } = await supabaseAdmin
      .from("orgs")
      .insert({
        name: "My Organisation",
        brand_primary: "#111111",
        brand_secondary: "#666666",
        footer_text: "Prepared by WasteX SWMP Generator",
      })
      .select("id")
      .single();

    if (orgErr || !org) {
      return NextResponse.json({ error: orgErr?.message ?? "Failed to create org" }, { status: 500 });
    }

    const { error: memErr } = await supabaseAdmin.from("org_members").insert({
      org_id: org.id,
      user_id: userId,
      role: "admin",
    });

    if (memErr) {
      return NextResponse.json({ error: memErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, org_id: org.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
