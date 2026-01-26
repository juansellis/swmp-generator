"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { AppShell } from "@/components/app-shell";
import { FormSection } from "@/components/form-section";
import { PageHeader } from "@/components/page-header";
import { Notice } from "@/components/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UploadIcon, XIcon } from "lucide-react";

type Org = {
  id: string;
  name: string;
  logo_url: string | null;
  brand_primary: string | null;
  brand_secondary: string | null;
  footer_text: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
};

export default function BrandSettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [org, setOrg] = useState<Org | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [brandPrimary, setBrandPrimary] = useState("#111111");
  const [brandSecondary, setBrandSecondary] = useState("#666666");
  const [footerText, setFooterText] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState<string>("");

  // Logo upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setPageError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        router.push("/login");
        return;
      }

      // Get org for this user via org_members
      const { data: member, error: memErr } = await supabase
        .from("org_members")
        .select("org_id")
        .limit(1)
        .maybeSingle();

      if (memErr || !member?.org_id) {
        setPageError(memErr?.message ?? "No organisation found for this user.");
        setLoading(false);
        return;
      }

      const { data: orgData, error: orgErr } = await supabase
        .from("orgs")
        .select("*")
        .eq("id", member.org_id)
        .single();

      if (orgErr || !orgData) {
        setPageError(orgErr?.message ?? "Failed to load organisation.");
        setLoading(false);
        return;
      }

      setOrg(orgData);

      // Populate form
      setName(orgData.name ?? "");
      // Support both brand_primary_colour and brand_primary for backwards compatibility
      setBrandPrimary((orgData as any).brand_primary_colour ?? orgData.brand_primary ?? "#111111");
      setBrandSecondary(orgData.brand_secondary ?? "#666666");
      setFooterText(orgData.footer_text ?? "");
      setContactEmail(orgData.contact_email ?? "");
      setContactPhone(orgData.contact_phone ?? "");
      setWebsite(orgData.website ?? "");
      setLogoUrl(orgData.logo_url ?? "");

      setLoading(false);
    })();
  }, [router]);

  async function handleSave() {
    if (!org) return;
    setSaveMsg(null);
    setPageError(null);

      const { error } = await supabase
      .from("orgs")
      .update({
        name,
        brand_primary: brandPrimary,
        brand_primary_colour: brandPrimary, // Also save as brand_primary_colour
        brand_secondary: brandSecondary,
        footer_text: footerText,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        website,
        logo_url: logoUrl || null,
      })
      .eq("id", org.id);

    if (error) {
      setPageError(error.message);
      return;
    }

    setSaveMsg("Saved.");
  }

  async function handleLogoUpload(file: File) {
    if (!org) return;
    setSaveMsg(null);
    setPageError(null);
    setUploading(true);
    setUploadProgress(0);

    try {
      // Store as: org-assets/<orgId>/logo.png (or original filename)
      const path = `${org.id}/${Date.now()}-${file.name}`;

      // Simulate progress (Supabase doesn't provide upload progress in the current API)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      const { error: uploadErr } = await supabase.storage
        .from("org-assets")
        .upload(path, file, { upsert: false });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (uploadErr) {
        setPageError(uploadErr.message);
        setUploading(false);
        setUploadProgress(0);
        return;
      }

      const { data } = supabase.storage.from("org-assets").getPublicUrl(path);
      const publicUrl = data.publicUrl;

      setLogoUrl(publicUrl);
      setSaveMsg("Logo uploaded. Click Save to apply.");
    } catch (error: any) {
      setPageError(error?.message ?? "Failed to upload logo");
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 500);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Brand Settings"
          subtitle="Customize your organisation's branding and contact information."
          actions={
            <Button variant="outline" onClick={() => router.push("/projects")}>
              ← Back
            </Button>
          }
        />

        {pageError ? (
          <Notice type="error" title="Error" message={pageError} />
        ) : null}

        {saveMsg ? (
          <Notice type="success" title="Success" message={saveMsg} />
        ) : null}

        <FormSection
          title="Organisation"
          description="Configure your organisation's branding, contact information, and logo."
          className="overflow-hidden"
          contentClassName="overflow-hidden"
        >
          <div className="grid gap-6 w-full">
            <div className="grid gap-2">
              <Label>Organisation name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Primary colour</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={brandPrimary}
                    onChange={(e) => setBrandPrimary(e.target.value)}
                    className="h-10 w-20 cursor-pointer shrink-0"
                  />
                  <Input
                    value={brandPrimary}
                    onChange={(e) => setBrandPrimary(e.target.value)}
                    placeholder="#111111"
                    className="flex-1 min-w-0"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Secondary colour</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={brandSecondary}
                    onChange={(e) => setBrandSecondary(e.target.value)}
                    className="h-10 w-20 cursor-pointer shrink-0"
                  />
                  <Input
                    value={brandSecondary}
                    onChange={(e) => setBrandSecondary(e.target.value)}
                    placeholder="#666666"
                    className="flex-1 min-w-0"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Footer / disclaimer text</Label>
              <Textarea
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                rows={3}
                placeholder="Text to display in the footer of generated SWMP reports"
                className="w-full"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Contact email</Label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contact@example.com"
                  className="w-full"
                />
              </div>

              <div className="grid gap-2">
                <Label>Contact phone</Label>
                <Input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+64 9 123 4567"
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Website</Label>
              <Input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                className="w-full"
              />
            </div>

            <div className="grid gap-3">
              <Label>Logo</Label>

              {logoUrl ? (
                <div className="w-full rounded-lg border p-3 overflow-hidden">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 h-16 w-16 rounded-md border bg-white flex items-center justify-center overflow-hidden">
                      <img
                        src={logoUrl}
                        alt="Organisation logo"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Current logo</p>
                      <p className="text-xs text-muted-foreground break-all">{logoUrl}</p>
                    </div>
                    <div className="shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setLogoUrl("")}
                      >
                        <XIcon className="size-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-6 text-center bg-muted/30">
                  <UploadIcon className="size-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-3">No logo uploaded yet</p>
                </div>
              )}

              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Uploading logo...</span>
                    <span className="font-medium">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLogoUpload(f);
                  }}
                  disabled={uploading}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/png,image/jpeg,image/svg+xml";
                    input.onchange = (e) => {
                      const f = (e.target as HTMLInputElement).files?.[0];
                      if (f) handleLogoUpload(f);
                    };
                    input.click();
                  }}
                  disabled={uploading}
                >
                  <UploadIcon className="size-4" />
                  Choose File
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Supported formats: PNG, JPEG, SVG. Maximum file size recommended: 2MB.
              </p>
            </div>

            <div className="border rounded-lg p-4 bg-card">
              <Button variant="primary" onClick={handleSave} disabled={uploading} className="w-full">
                Save settings
              </Button>
            </div>
          </div>
        </FormSection>
      </div>
    </AppShell>
  );
}
