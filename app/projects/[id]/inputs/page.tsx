"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  region: string | null;
  project_type: string | null;
  start_date: string | null;
  end_date: string | null;
  main_contractor: string | null;
  swmp_owner: string | null;
};

const SORTING_LEVELS = ["Basic", "Moderate", "High"] as const;

const DEFAULT_TARGETS: Record<string, number> = {
  "Fit-out": 60,
  "New build": 70,
  Residential: 70,
  Commercial: 70,
  Demolition: 80,
  Civil: 60,
};

const WASTE_STREAM_LIBRARY = [
  "Mixed C&D",
  "Timber (untreated)",
  "Timber (treated)",
  "Plasterboard / GIB",
  "Metals",
  "Concrete / masonry",
  "Cardboard",
  "Soft plastics (wrap/strapping)",
  "Hard plastics",
  "Glass",
  "E-waste (cables/lighting/appliances)",
  "Paints/adhesives/chemicals",
  "Ceiling tiles",
  "Carpet / carpet tiles",
  "Insulation",
  "Soil / spoil (cleanfill if verified)",
] as const;

const CONSTRAINTS = [
  "CBD / tight site",
  "Limited laydown space",
  "Restricted truck access / time windows",
  "Multi-storey / hoist required",
  "Weather exposure (keep materials dry)",
  "Shared waste area with other trades",
  "Noise/dust sensitive neighbours",
] as const;

export default function ProjectInputsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params?.id;

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [project, setProject] = useState<ProjectRow | null>(null);

  // Input state
  const [sortingLevel, setSortingLevel] =
    useState<(typeof SORTING_LEVELS)[number]>("Moderate");

  const [targetDiversion, setTargetDiversion] = useState<number>(70);

  const [selectedConstraints, setSelectedConstraints] = useState<string[]>([]);
  const [selectedWasteStreams, setSelectedWasteStreams] = useState<string[]>([
    "Mixed C&D",
    "Cardboard",
    "Metals",
    "Timber (untreated)",
  ]);

  const [hazAsbestos, setHazAsbestos] = useState(false);
  const [hazLeadPaint, setHazLeadPaint] = useState(false);
  const [hazContaminatedSoil, setHazContaminatedSoil] = useState(false);

  const [wasteContractor, setWasteContractor] = useState("");
  const [binPreference, setBinPreference] = useState<"Recommend" | "Manual">(
    "Recommend"
  );
  const [reportingCadence, setReportingCadence] = useState<
    "Weekly" | "Fortnightly" | "Monthly"
  >("Weekly");

  const [notes, setNotes] = useState("");

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const hazards = useMemo(() => {
    return {
      asbestos: hazAsbestos,
      lead_paint: hazLeadPaint,
      contaminated_soil: hazContaminatedSoil,
    };
  }, [hazAsbestos, hazLeadPaint, hazContaminatedSoil]);

  useEffect(() => {
    if (!projectId) return;
  
    let mounted = true;
  
    (async () => {
      setLoading(true);
      setPageError(null);
  
      // 1️⃣ Fetch project
      const { data: project, error: projectErr } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();
  
      if (!mounted) return;
  
      if (projectErr || !project) {
        setError(projectErr?.message ?? "Project not found");
        setLoading(false);
        return;
      }
  
      setProject(project);
  
      // 2️⃣ Fetch latest saved SWMP inputs (THIS IS OPTION B)
      const { data: savedInputs, error: savedInputsErr } = await supabase
        .from("swmp_inputs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
  
      if (!mounted) return;
  
      if (!savedInputsErr && savedInputs) {
        // 🔁 Hydrate form state from DB
        setSortingLevel(savedInputs.sorting_level ?? "Moderate");
        setTargetDiversion(savedInputs.target_diversion ?? 70);
        setSelectedConstraints(savedInputs.constraints ?? []);
        setSelectedWasteStreams(savedInputs.waste_streams ?? []);
  
        setHazAsbestos(!!savedInputs.hazards?.asbestos);
        setHazLeadPaint(!!savedInputs.hazards?.lead_paint);
        setHazContaminatedSoil(!!savedInputs.hazards?.contaminated_soil);
  
        setWasteContractor(savedInputs.logistics?.waste_contractor ?? "");
        setBinPreference(savedInputs.logistics?.bin_preference ?? "Recommend");
        setReportingCadence(savedInputs.logistics?.reporting_cadence ?? "Weekly");
  
        setNotes(savedInputs.notes ?? "");
      }
  
      setLoading(false);
    })();
  
    return () => {
      mounted = false;
    };
  }, [projectId]);
  

  function toggleInList(value: string, list: string[], setList: (v: string[]) => void) {
    if (list.includes(value)) {
      setList(list.filter((x) => x !== value));
    } else {
      setList([...list, value]);
    }
  }

  async function handleGenerate() {
    setSaveError(null);
    setSaveMessage(null);
  
    if (!projectId) {
      setSaveError("Missing project id.");
      return;
    }
  
    try {
      const res = await fetch("/api/generate-swmp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });
  
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data?.error ?? "Failed to generate SWMP");
        return;
      }
  
      router.push(`/projects/${projectId}/swmp`);
    } catch (e: any) {
      setSaveError(e?.message ?? "Failed to generate SWMP");
    }
  }


  async function handleSaveInputs(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaveMessage(null);

    if (!projectId) {
      setSaveError("Missing project id.");
      return;
    }

    if (selectedWasteStreams.length === 0) {
      setSaveError("Select at least one waste stream.");
      return;
    }

    setSaveLoading(true);

    try {
      const payload = {
        project_id: projectId,
        sorting_level: sortingLevel,
        target_diversion: targetDiversion,
        constraints: selectedConstraints,
        waste_streams: selectedWasteStreams,
        hazards,
        logistics: {
          waste_contractor: wasteContractor.trim() || null,
          bin_preference: binPreference,
          reporting_cadence: reportingCadence,
        },
        notes: notes.trim() || null,
      };

      const { error } = await supabase.from("swmp_inputs").insert(payload);

      if (pageError) {
        setSaveError(error.message);
        return;
      }

      setSaveMessage("Inputs saved. Next: generate SWMP (we’ll add this button next).");
    } finally {
      setSaveLoading(false);
    }
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 1000, margin: "48px auto", padding: 16 }}>
        <p>Loading…</p>
      </main>
    );
  }

  if (pageError) {
    return (
      <main style={{ maxWidth: 1000, margin: "48px auto", padding: 16 }}>
        <button
          onClick={() => router.push("/projects")}
          style={{
            padding: "8px 10px",
            border: "1px solid #ccc",
            background: "#fff",
            borderRadius: 6,
            cursor: "pointer",
            marginBottom: 16,
          }}
        >
          ← Back to projects
        </button>
        <div
          style={{
            padding: 12,
            border: "1px solid #f5c2c7",
            background: "#f8d7da",
            color: "#842029",
            borderRadius: 6,
          }}
        >
          {pageError}
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1000, margin: "48px auto", padding: 16 }}>
      <button
        onClick={() => router.push("/projects")}
        style={{
          padding: "8px 10px",
          border: "1px solid #ccc",
          background: "#fff",
          borderRadius: 6,
          cursor: "pointer",
          marginBottom: 16,
        }}
      >
        ← Back to projects
      </button>

      <h1 style={{ margin: "0 0 6px" }}>SWMP Inputs</h1>
      <p style={{ marginTop: 0, color: "#444" }}>
        Project: <strong>{project?.name}</strong>
        {project?.address ? ` • ${project.address}` : ""}
      </p>

      <section
        style={{
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 10,
          background: "#fafafa",
          marginBottom: 16,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Plan settings</h2>

        <form onSubmit={handleSaveInputs} style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Sorting level</span>
              <select
                value={sortingLevel}
                onChange={(e) => setSortingLevel(e.target.value as any)}
                disabled={saveLoading}
                style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
              >
                {SORTING_LEVELS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Target diversion (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={targetDiversion}
                onChange={(e) => setTargetDiversion(Number(e.target.value))}
                disabled={saveLoading}
                style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
              />
            </label>
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Site constraints</div>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
              {CONSTRAINTS.map((c) => (
                <label key={c} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedConstraints.includes(c)}
                    onChange={() =>
                      toggleInList(c, selectedConstraints, setSelectedConstraints)
                    }
                    disabled={saveLoading}
                  />
                  <span>{c}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Waste streams anticipated</div>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
              {WASTE_STREAM_LIBRARY.map((w) => (
                <label key={w} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedWasteStreams.includes(w)}
                    onChange={() =>
                      toggleInList(w, selectedWasteStreams, setSelectedWasteStreams)
                    }
                    disabled={saveLoading}
                  />
                  <span>{w}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              Regulated / hazard flags (if applicable)
            </div>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={hazAsbestos}
                  onChange={() => setHazAsbestos((v) => !v)}
                  disabled={saveLoading}
                />
                <span>Asbestos (ACM) possible / confirmed</span>
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={hazLeadPaint}
                  onChange={() => setHazLeadPaint((v) => !v)}
                  disabled={saveLoading}
                />
                <span>Lead-based paint / hazardous coatings possible</span>
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={hazContaminatedSoil}
                  onChange={() => setHazContaminatedSoil((v) => !v)}
                  disabled={saveLoading}
                />
                <span>Contaminated soil/spoil possible</span>
              </label>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Waste contractor (if known)</span>
              <input
                value={wasteContractor}
                onChange={(e) => setWasteContractor(e.target.value)}
                placeholder="Company name"
                disabled={saveLoading}
                style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Bin setup</span>
              <select
                value={binPreference}
                onChange={(e) => setBinPreference(e.target.value as any)}
                disabled={saveLoading}
                style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
              >
                <option value="Recommend">Recommend for me</option>
                <option value="Manual">I will specify manually (later)</option>
              </select>
            </label>
          </div>

          <label style={{ display: "grid", gap: 6, maxWidth: 360 }}>
            <span>Monitoring & reporting cadence</span>
            <select
              value={reportingCadence}
              onChange={(e) => setReportingCadence(e.target.value as any)}
              disabled={saveLoading}
              style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
            >
              <option value="Weekly">Weekly</option>
              <option value="Fortnightly">Fortnightly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Additional notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything site-specific that should be reflected in the SWMP."
              disabled={saveLoading}
              rows={4}
              style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
            />
          </label>

          <button
            type="submit"
            disabled={saveLoading}
            style={{
              padding: "10px 12px",
              border: "1px solid #111",
              background: saveLoading ? "#eee" : "#111",
              color: saveLoading ? "#666" : "white",
              borderRadius: 6,
              cursor: saveLoading ? "not-allowed" : "pointer",
              width: 200,
            }}
          >
            {saveLoading ? "Saving…" : "Save inputs"}
          </button>

          {saveError && (
            <div
              style={{
                padding: 12,
                border: "1px solid #f5c2c7",
                background: "#f8d7da",
                color: "#842029",
                borderRadius: 6,
              }}
            >
              {saveError}
            </div>
          )}

          {saveMessage && (
            <div
              style={{
                padding: 12,
                border: "1px solid #badbcc",
                background: "#d1e7dd",
                color: "#0f5132",
                borderRadius: 6,
              }}
            >
              {saveMessage}
            </div>
          )}
        </form>
      </section>

      <section
  style={{
    padding: 16,
    border: "1px dashed #bbb",
    borderRadius: 10,
    background: "#fff",
  }}
>
  <button
    type="button"
    onClick={handleGenerate}
    style={{
      padding: "10px 12px",
      border: "1px solid #111",
      background: "#111",
      color: "white",
      borderRadius: 6,
      cursor: "pointer",
      width: 200,
    }}
  >
    Generate SWMP
  </button>
</section>
</main>
  );
}