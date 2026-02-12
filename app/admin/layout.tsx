import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminEmail } from "@/lib/auth/isSuperAdmin";
import { AdminShell } from "./admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/projects");

  const email = user.email ?? null;
  const envSuperAdmin = isSuperAdminEmail(email);

  await supabase.from("profiles").upsert(
    {
      id: user.id,
      is_super_admin: envSuperAdmin,
    },
    { onConflict: "id" }
  );
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();
  const isSuperAdmin = profile?.is_super_admin === true || envSuperAdmin;

  if (!isSuperAdmin) redirect("/projects");
  return <AdminShell>{children}</AdminShell>;
}
