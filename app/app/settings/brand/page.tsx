"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
      setBrandPrimary(orgData.brand_primary ?? "#111111");
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

    // Store as: org-assets/<orgId>/logo.png (or original filename)
    const path = `${org.id}/${Date.now()}-${file.name}`;

    const { error: uploadErr } = await supabase.storage
      .from("org-assets")
      .upload(path, file, { upsert: false });

    if (uploadErr) {
      setPageError(uploadErr.message);
      return;
    }

    const { data } = supabase.storage.from("org-assets").getPublicUrl(path);
    const publicUrl = data.publicUrl;

    setLogoUrl(publicUrl);
    setSaveMsg("Logo uploaded. Click Save to apply.");
  }

  if (loading) {
    return <main style={{ maxWidth: 900, margin: "48px auto", padding: 16 }}>Loading…</main>;
  }

  return (
    <main style={{ maxWidth: 900, margin: "48px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Brand Settings</h1>
        <button
          onClick={() => router.push("/projects")}
          style={{ padding: "8px 10px", border: "1px solid #ccc", background: "#fff", borderRadius: 6 }}
        >
          ← Back
        </button>
      </div>

      {pageError && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #f5c2c7", background: "#f8d7da", color: "#842029", borderRadius: 6 }}>
          {pageError}
        </div>
      )}

      {saveMsg && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #badbcc", background: "#d1e7dd", color: "#0f5132", borderRadius: 6 }}>
          {saveMsg}
        </div>
      )}

      <section style={{ marginTop: 24, padding: 16, border: "1px solid #eee", borderRadius: 10 }}>
        <h2 style={{ marginTop: 0 }}>Organisation</h2>

        <label style={{ display: "block", marginBottom: 6 }}>Organisation name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 6, marginBottom: 14 }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Primary colour</label>
            <input
              value={brandPrimary}
              onChange={(e) => setBrandPrimary(e.target.value)}
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Secondary colour</label>
            <input
              value={brandSecondary}
              onChange={(e) => setBrandSecondary(e.target.value)}
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
            />
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={{ display: "block", marginBottom: 6 }}>Footer / disclaimer text</label>
          <textarea
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            rows={3}
            style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Contact email</label>
            <input
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 6 }}>Contact phone</label>
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
            />
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={{ display: "block", marginBottom: 6 }}>Website</label>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
          />
        </div>

        <div style={{ marginTop: 18 }}>
          <label style={{ display: "block", marginBottom: 6 }}>Logo</label>

          {logoUrl ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <img src={logoUrl} alt="Logo" style={{ height: 40, objectFit: "contain" }} />
              <span style={{ fontSize: 12, color: "#555" }}>{logoUrl}</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#555", marginBottom: 10 }}>No logo uploaded yet.</div>
          )}

          <input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleLogoUpload(f);
            }}
          />
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <button
            onClick={handleSave}
            style={{ padding: "10px 12px", border: "1px solid #111", background: "#111", color: "#fff", borderRadius: 6, cursor: "pointer" }}
          >
            Save
          </button>
        </div>
      </section>
    </main>
  );
}
