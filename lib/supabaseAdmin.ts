import { createClient } from "@supabase/supabase-js";
import { envServer } from "@/lib/env/server";

export const supabaseAdmin = createClient(envServer.supabase.url(), envServer.supabase.serviceRoleKey(), {
  auth: { persistSession: false },
});
