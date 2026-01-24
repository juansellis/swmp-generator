"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  region: string | null;
  project_type: string | null;
  start_date: string | null; // ISO date
  end_date: string | null; // ISO date
  main_contractor: string | null;
  swmp_owner: string | null;
  created_at: string;
};

type UserView = {
  email: string | null;
  id: string;
};

const REGION_OPTIONS = [
  "Auckland",
  "Wellington",
  "Christchurch",
  "Hamilton/Waikato",
  "Tauranga/BOP",
  "Dunedin/Otago",
  "Other (NZ)",
] as const;

const PROJECT_TYPE_OPTIONS = [
  "Fit-out",
  "New build",
  "Residential",
  "Commercial",
  "Demolition",
  "Civil",
] as const;

export default function ProjectsPage() {
  const router = useRouter();

  const [user, setUser] = useState<UserView | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // Create form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState<(typeof REGION_OPTIONS)[number] | "">("");
  const [projectType, setProjectType] = useState<
    (typeof PROJECT_TYPE_OPTIONS)[number] | ""
  >("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [mainContractor, setMainContractor] = useState("");
  const [swmpOwner, setSwmpOwner] = useState("");

  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  const canCreate = useMemo(() => {
    return !!user?.id && name.trim().length >= 2;
  }, [user?.id, name]);

  useEffect(() => {
    let cancelled = false;
  
    (async () => {
      // Safety: if anything hangs, stop loading after 8 seconds
      const timeout = setTimeout(() => {
        if (!cancelled) {
          setPageError("Loading timed out. Check console for the last successful step.");
          setLoading(false);
        }
      }, 8000);
  
      try {
        console.log("[Projects] start");
  
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        console.log("[Projects] got session", !!session);
  
        if (sessionErr) throw sessionErr;
  
        if (!session) {
          console.log("[Projects] no session, redirecting to login");
          router.push("/login");
          return; // OK to return without setLoading(false) because we’re navigating away
        }
  
        // Bootstrap org (non-blocking: if it fails, we still load projects)
        fetch("/api/orgs/bootstrap", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).then(() => console.log("[Projects] bootstrap ok"))
          .catch((e) => console.warn("[Projects] bootstrap failed", e));
  
        // Now load projects (this MUST be awaited)
        const { data: projects, error: projectsErr } = await supabase
          .from("projects")
          .select("*")
          .order("created_at", { ascending: false });
  
        console.log("[Projects] projects loaded", projects?.length ?? 0);
  
        if (projectsErr) throw projectsErr;
  
        if (!cancelled) {
          setProjects(projects ?? []);
          setPageError(null);
          setLoading(false);
        }
      } catch (e: any) {
        console.error("[Projects] error", e);
        if (!cancelled) {
          setPageError(e?.message ?? "Unknown error while loading projects");
          setLoading(false);
        }
      } finally {
        clearTimeout(timeout);
      }
    })();
  
    return () => {
      cancelled = true;
    };
  }, [router]);
  
  

  async function handleSignOut() {
    setPageError(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setPageError(error.message);
      return;
    }
    router.replace("/login");
  }

  async function fetchProjects() {
    setListLoading(true);
    setPageError(null);

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setPageError(error.message);
      setListLoading(false);
      return;
    }

    setProjects((data as ProjectRow[]) ?? []);
    setListLoading(false);
  }

  useEffect(() => {
    if (!user?.id) return;
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateMessage(null);

    if (!canCreate) {
      setCreateError("Please enter a project name (at least 2 characters).");
      return;
    }

    setCreateLoading(true);

    try {
      const insertPayload = {
        user_id: user!.id,
        name: name.trim(),
        address: address.trim() || null,
        region: region || null,
        project_type: projectType || null,
        start_date: startDate || null,
        end_date: endDate || null,
        main_contractor: mainContractor.trim() || null,
        swmp_owner: swmpOwner.trim() || null,
      };

      const { data, error } = await supabase
        .from("projects")
        .insert(insertPayload)
        .select("id")
        .single();

      if (error) {
        setCreateError(error.message);
        return;
      }

      setCreateMessage("Project created.");
      // Reset form
      setName("");
      setAddress("");
      setRegion("");
      setProjectType("");
      setStartDate("");
      setEndDate("");
      setMainContractor("");
      setSwmpOwner("");

      // Refresh list
      await fetchProjects();

      // Navigate straight to inputs
      if (data?.id) {
        router.push(`/projects/${data.id}/inputs`);
      }
    } finally {
      setCreateLoading(false);
    }
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 1000, margin: "48px auto", padding: 16 }}>
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1000, margin: "48px auto", padding: 16 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>Projects</h1>
          <p style={{ margin: "6px 0 0", color: "#444" }}>
            Logged in as <strong>{user?.email ?? "Unknown"}</strong>
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
  <button
    onClick={() => router.push("/settings/brand")}
    style={{
      padding: "10px 12px",
      border: "1px solid #111",
      background: "#fff",
      borderRadius: 6,
      cursor: "pointer",
    }}
  >
    Brand Settings
  </button>

  <button
    onClick={handleSignOut}
    style={{
      padding: "10px 12px",
      border: "1px solid #111",
      background: "#fff",
      borderRadius: 6,
      cursor: "pointer",
    }}
  >
    Sign out
  </button>
</div>

      </header>



      {pageError && (
        <div
          style={{
            padding: 12,
            border: "1px solid #f5c2c7",
            background: "#f8d7da",
            color: "#842029",
            borderRadius: 6,
            marginBottom: 16,
          }}
        >
          {pageError}
        </div>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 16,
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 10,
          background: "#fafafa",
          marginBottom: 18,
        }}
      >
        <h2 style={{ margin: 0 }}>Create a new project</h2>

        <form onSubmit={handleCreateProject} style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Project name *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Hobson St Fit-out"
                disabled={createLoading}
                style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Site address</span>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g., 26 Hobson Street, Auckland CBD"
                disabled={createLoading}
                style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
              />
            </label>
          </div>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Region</span>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as any)}
                disabled={createLoading}
                style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
              >
                <option value="">Select…</option>
                {REGION_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Project type</span>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value as any)}
                disabled={createLoading}
                style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
              >
                <option value="">Select…</option>
                {PROJECT_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={createLoading}
                style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>End date</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={createLoading}
                style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
              />
            </label>
          </div>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Main contractor</span>
              <input
                value={mainContractor}
                onChange={(e) => setMainContractor(e.target.value)}
                placeholder="Company name"
                disabled={createLoading}
                style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>SWMP owner</span>
              <input
                value={swmpOwner}
                onChange={(e) => setSwmpOwner(e.target.value)}
                placeholder="Name / role"
                disabled={createLoading}
                style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={createLoading || !canCreate}
            style={{
              padding: "10px 12px",
              border: "1px solid #111",
              background: createLoading || !canCreate ? "#eee" : "#111",
              color: createLoading || !canCreate ? "#666" : "white",
              borderRadius: 6,
              cursor: createLoading || !canCreate ? "not-allowed" : "pointer",
              width: 220,
            }}
          >
            {createLoading ? "Creating…" : "Create project"}
          </button>

          {createError && (
            <div
              style={{
                padding: 12,
                border: "1px solid #f5c2c7",
                background: "#f8d7da",
                color: "#842029",
                borderRadius: 6,
              }}
            >
              {createError}
            </div>
          )}

          {createMessage && (
            <div
              style={{
                padding: 12,
                border: "1px solid #badbcc",
                background: "#d1e7dd",
                color: "#0f5132",
                borderRadius: 6,
              }}
            >
              {createMessage}
            </div>
          )}
        </form>
      </section>

      <section
        style={{
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 10,
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 10,
          }}
        >
          <h2 style={{ margin: 0 }}>Your projects</h2>
          <button
            onClick={fetchProjects}
            disabled={listLoading}
            style={{
              padding: "8px 10px",
              border: "1px solid #ccc",
              background: "#fff",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            {listLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {listLoading ? (
          <p>Loading projects…</p>
        ) : projects.length === 0 ? (
          <p style={{ color: "#555" }}>No projects yet. Create your first one above.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => router.push(`/projects/${p.id}/inputs`)}
                style={{
                  textAlign: "left",
                  padding: 12,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  background: "#fafafa",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div style={{ color: "#555", marginTop: 4 }}>
                  {(p.address ?? "No address")} • {(p.region ?? "Region not set")} •{" "}
                  {(p.project_type ?? "Type not set")}
                </div>
                <div style={{ color: "#666", marginTop: 4, fontSize: 13 }}>
                  Created {new Date(p.created_at).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
