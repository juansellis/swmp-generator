"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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

  const [name, setName] = useState("");
  const [brandPrimary, setBrandPrimary] = useState("#111111");
  const [brandSecondary, setBrandSecondary] = useState("#666666");
  const [footerText, setFooterText] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState<string>("");

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
      setName(orgData.name ?? "");
      setBrandPrimary((orgData as { brand_primary_colour?: string }).brand_primary_colour ?? orgData.brand_primary ?? "#111111");
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
        brand_primary_colour: brandPrimary,
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
      const path = `${org.id}/${Date.now()}-${file.name}`;
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
      setLogoUrl(data.publicUrl);
      setSaveMsg("Logo uploaded. Click Save to apply.");
    } catch (error: unknown) {
      setPageError(error instanceof Error ? error.message : "Failed to upload logo");
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
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <PageHeader
          title="Settings"
          subtitle="Manage your organisation branding and preferences."
          actions={
            <div className="flex items-center gap-3">
              {saveMsg && (
                <span className="text-sm text-muted-foreground" aria-live="polite">
                  {saveMsg}
                </span>
              )}
              <Button variant="outline" size="default" onClick={() => router.push("/projects")}>
                ← Back
              </Button>
            </div>
          }
        />

        {pageError && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {pageError}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>
              Organisation name, colours, footer text, and contact details used in generated reports.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="org-name">Organisation name</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="max-w-md"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 max-w-md">
              <div className="grid gap-2">
                <Label htmlFor="brand-primary">Primary colour</Label>
                <div className="flex gap-2">
                  <Input
                    id="brand-primary"
                    type="color"
                    value={brandPrimary}
                    onChange={(e) => setBrandPrimary(e.target.value)}
                    className="h-10 w-14 cursor-pointer shrink-0 p-1"
                  />
                  <Input
                    value={brandPrimary}
                    onChange={(e) => setBrandPrimary(e.target.value)}
                    placeholder="#111111"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="brand-secondary">Secondary colour</Label>
                <div className="flex gap-2">
                  <Input
                    id="brand-secondary"
                    type="color"
                    value={brandSecondary}
                    onChange={(e) => setBrandSecondary(e.target.value)}
                    className="h-10 w-14 cursor-pointer shrink-0 p-1"
                  />
                  <Input
                    value={brandSecondary}
                    onChange={(e) => setBrandSecondary(e.target.value)}
                    placeholder="#666666"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="footer-text">Footer / disclaimer text</Label>
              <Textarea
                id="footer-text"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                rows={3}
                placeholder="Text shown in the footer of generated SWMP reports"
                className="max-w-2xl"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
              <div className="grid gap-2">
                <Label htmlFor="contact-email">Contact email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contact@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact-phone">Contact phone</Label>
                <Input
                  id="contact-phone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+64 9 123 4567"
                />
              </div>
            </div>
            <div className="grid gap-2 max-w-2xl">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Logo</Label>
              <div className="flex flex-col sm:flex-row items-start gap-4 min-w-0">
                <div className="shrink-0">
                  {logoUrl ? (
                    <div className="h-16 w-16 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                      <img src={logoUrl} alt="Organisation logo" className="h-full w-full object-contain" />
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-lg border border-dashed border-border bg-muted/20 flex items-center justify-center">
                      <UploadIcon className="size-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2 w-full">
                  {logoUrl && (
                    <p className="text-sm text-muted-foreground truncate" title={logoUrl}>
                      Current logo
                    </p>
                  )}
                  {uploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Uploading…</span>
                        <span className="font-medium tabular-nums">{uploadProgress}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleLogoUpload(f);
                      }}
                      disabled={uploading}
                      className="max-w-[200px]"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="default"
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
                      Choose file
                    </Button>
                    {logoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="default"
                        className="ml-auto text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setLogoUrl("")}
                      >
                        <XIcon className="size-4" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPEG, or SVG. Recommended max 2MB.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end border-t border-border/50 pt-6">
            <Button variant="primary" size="default" onClick={handleSave} disabled={uploading}>
              Save changes
            </Button>
          </CardFooter>
        </Card>
      </div>
    </AppShell>
  );
}
