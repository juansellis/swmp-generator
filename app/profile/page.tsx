"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const FULL_NAME_MAX_LENGTH = 200;
const PHONE_MAX_LENGTH = 50;
const ROLE_TITLE_MAX_LENGTH = 100;
const COMPANY_MAX_LENGTH = 200;

/** Editable profile fields; names must match public.profiles columns. Add new columns via migration first. */
export type ProfileEditableFields = {
  full_name: string | null;
  phone: string | null;
  role_title: string | null;
  company: string | null;
};

type ProfileRow = ProfileEditableFields & {
  id: string;
  is_super_admin: boolean;
  updated_at: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string | null; app_metadata?: { provider?: string } } | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    role_title: "",
    company: "",
  });

  const fetchUserAndProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    setUser(session.user);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, phone, role_title, company, is_super_admin, updated_at")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileError) {
      toast.error(profileError.message);
      setLoading(false);
      return;
    }

    if (profileData) {
      setProfile(profileData as ProfileRow);
      setForm({
        full_name: (profileData.full_name ?? "").trim(),
        phone: (profileData.phone ?? "").trim(),
        role_title: (profileData.role_title ?? "").trim(),
        company: (profileData.company ?? "").trim(),
      });
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("profiles")
        .insert({ id: session.user.id })
        .select("id, full_name, phone, role_title, company, is_super_admin, updated_at")
        .single();

      if (insertError) {
        toast.error(insertError.message);
        setLoading(false);
        return;
      }
      setProfile(inserted as ProfileRow);
      setForm({ full_name: "", phone: "", role_title: "", company: "" });
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchUserAndProfile();
  }, [fetchUserAndProfile]);

  const initialForm = profile
    ? {
        full_name: (profile.full_name ?? "").trim(),
        phone: (profile.phone ?? "").trim(),
        role_title: (profile.role_title ?? "").trim(),
        company: (profile.company ?? "").trim(),
      }
    : null;

  const hasChanges =
    initialForm &&
    (form.full_name !== initialForm.full_name ||
      form.phone !== initialForm.phone ||
      form.role_title !== initialForm.role_title ||
      form.company !== initialForm.company);

  const handleSave = async () => {
    if (!user?.id || !hasChanges) return;
    const fullName = form.full_name.trim().slice(0, FULL_NAME_MAX_LENGTH) || null;
    const phone = form.phone.trim().slice(0, PHONE_MAX_LENGTH) || null;
    const roleTitle = form.role_title.trim().slice(0, ROLE_TITLE_MAX_LENGTH) || null;
    const company = form.company.trim().slice(0, COMPANY_MAX_LENGTH) || null;

    const payload: ProfileEditableFields = {
      full_name: fullName,
      phone,
      role_title: roleTitle,
      company,
    };

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      const msg =
        error.message.includes("does not exist") || error.message.includes("column")
          ? `${error.message} Run migrations: supabase/migrations/20250226000000_profiles_optional_columns.sql`
          : error.message;
      toast.error(msg);
      return;
    }
    toast.success("Profile saved");
    setProfile((prev) =>
      prev ? { ...prev, full_name: fullName, phone, role_title: roleTitle, company } : null
    );
    setForm({ full_name: fullName ?? "", phone: phone ?? "", role_title: roleTitle ?? "", company: company ?? "" });
  };

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-2xl space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <PageHeader title="Profile" subtitle="View and edit your account details." />
          <Button variant="outline" size="sm" asChild>
            <Link href="/projects">Back to projects</Link>
          </Button>
        </div>

        <Card className="rounded-xl border border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
            <CardDescription>Read-only. Email is managed by your sign-in provider.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Email</span>
              <p className="font-medium">{user?.email ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Provider</span>
              <p className="font-medium">{user?.app_metadata?.provider ?? "email"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">User ID</span>
              <p className="font-mono text-xs text-muted-foreground break-all">{user?.id ?? "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Personal details</CardTitle>
            <CardDescription>Edit your display name and contact info.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-full_name">Full name</Label>
              <Input
                id="profile-full_name"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="Your name"
                maxLength={FULL_NAME_MAX_LENGTH}
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">Max {FULL_NAME_MAX_LENGTH} characters.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">Phone</Label>
              <Input
                id="profile-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="Optional"
                maxLength={PHONE_MAX_LENGTH}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-role_title">Role / title</Label>
              <Input
                id="profile-role_title"
                value={form.role_title}
                onChange={(e) => setForm((f) => ({ ...f, role_title: e.target.value }))}
                placeholder="e.g. Sustainability Manager"
                maxLength={ROLE_TITLE_MAX_LENGTH}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-company">Company</Label>
              <Input
                id="profile-company"
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                placeholder="Optional"
                maxLength={COMPANY_MAX_LENGTH}
                disabled={saving}
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button onClick={handleSave} disabled={!hasChanges || saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              {saving && <span className="text-sm text-muted-foreground">Saving…</span>}
              {!saving && hasChanges && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
