"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/ui/section-card";
import { ProjectsDashboardNav } from "@/components/projects-dashboard-nav";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROJECT_TYPE_GROUPS } from "@/lib/projectTypeOptions";
import { fetchProjectStatusDataForProjects } from "@/lib/projectStatus";
import type { ProjectStatusData } from "@/lib/projectStatus";
import { ProjectCard } from "@/components/project-card";
import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog";
import { NewProjectSheet } from "@/components/new-project-sheet";
import type { QuickCreateProjectFormState } from "@/components/quick-create-project-modal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FolderOpen,
  Recycle,
  Building2,
  TrendingUp,
  Search,
  Plus,
} from "lucide-react";
import type { DashboardMetricsResponse } from "@/app/api/dashboard/metrics/route";
import type { PlanningChecklist } from "@/lib/planning/planningChecklist";

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
  primary_waste_contractor_partner_id: string | null;
  created_at: string;
};

/** Explicit select so primary_waste_contractor_partner_id and all list fields load (avoids stale/missing columns). */
const PROJECTS_LIST_SELECT = "id, user_id, name, address, site_address, site_place_id, site_lat, site_lng, region, project_type, start_date, end_date, main_contractor, swmp_owner, primary_waste_contractor_partner_id, created_at";

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

function formatTonnes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n >= 100) return n.toFixed(1);
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(3);
}

/** Stat card for dashboard KPIs */
function StatCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string | undefined;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-sm p-5 min-h-[100px] flex flex-col justify-center">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-muted/50 p-2 text-muted-foreground [&>svg]:size-5">
          {icon}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          {loading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <p className="text-2xl font-semibold tabular-nums tracking-tight">{value ?? "—"}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [statusByProjectId, setStatusByProjectId] = useState<Map<string, ProjectStatusData>>(new Map());
  const [checklistByProjectId, setChecklistByProjectId] = useState<Map<string, PlanningChecklist>>(new Map());
  const [checklistsLoading, setChecklistsLoading] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetricsResponse | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const [createLoading, setCreateLoading] = useState(false);
  const [newProjectSheetOpen, setNewProjectSheetOpen] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetMessage, setSheetMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogProject, setDeleteDialogProject] = useState<{ id: string; name: string } | null>(null);

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
          return; // OK to return without setLoading(false) because we're navigating away
        }

        setUser(session.user);

        // Server-side super-admin check (uses SUPER_ADMIN_EMAILS; no NEXT_PUBLIC_ needed)
        fetch("/api/auth/check-admin", { credentials: "include" })
          .then((r) => r.json())
          .then((body) => {
            if (!cancelled && typeof body?.isSuperAdmin === "boolean") {
              setIsSuperAdmin(body.isSuperAdmin);
            }
          })
          .catch(() => {});
  
        // Bootstrap org (non-blocking: if it fails, we still load projects)
        fetch("/api/orgs/bootstrap", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).then(() => console.log("[Projects] bootstrap ok"))
          .catch((e) => console.warn("[Projects] bootstrap failed", e));
  
        // Now load projects (this MUST be awaited)
        const { data: projects, error: projectsErr } = await supabase
          .from("projects")
          .select(PROJECTS_LIST_SELECT)
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
      .select(PROJECTS_LIST_SELECT)
      .order("created_at", { ascending: false });

    if (error) {
      setPageError(error.message);
      setListLoading(false);
      return;
    }

    const list = (data as ProjectRow[]) ?? [];
    setProjects(list);

    const ids = list.map((p) => p.id);
    const statusMap = await fetchProjectStatusDataForProjects(supabase, ids);
    setStatusByProjectId(statusMap);
    setListLoading(false);

    // Fetch planning checklists in parallel (non-blocking)
    if (ids.length > 0) {
      setChecklistsLoading(true);
      Promise.all(
        ids.map((id) =>
          fetch(`/api/projects/${id}/planning-checklist`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        )
      )
        .then((results) => {
          const map = new Map<string, PlanningChecklist>();
          ids.forEach((id, i) => {
            const data = results[i];
            if (data && typeof data.readiness_score === "number" && Array.isArray(data.items)) {
              map.set(id, data as PlanningChecklist);
            }
          });
          setChecklistByProjectId(map);
        })
        .finally(() => setChecklistsLoading(false));
    } else {
      setChecklistByProjectId(new Map());
    }
  }

  useEffect(() => {
    if (!user?.id) return;
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function fetchMetrics() {
    if (!user?.id) return;
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const res = await fetch("/api/dashboard/metrics", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        setMetricsError(data?.error ?? "Couldn't load metrics");
        return;
      }
      setMetrics({
        activeProjects: Number(data.activeProjects ?? 0),
        totalWasteStreamsConfigured: Number(data.totalWasteStreamsConfigured ?? 0),
        facilitiesLinked: Number(data.facilitiesLinked ?? 0),
        totalEstimatedWasteTonnes: Number(data.totalEstimatedWasteTonnes ?? 0),
      });
    } catch {
      setMetricsError("Couldn't load metrics");
    } finally {
      setMetricsLoading(false);
    }
  }

  useEffect(() => {
    if (!user?.id) return;
    fetchMetrics();
  }, [user?.id]);

  // Refetch metrics when user returns to the tab (e.g. after creating/editing a project)
  useEffect(() => {
    const onFocus = () => {
      if (user?.id) fetchMetrics();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user?.id]);

  async function handleNewProjectSubmit(state: QuickCreateProjectFormState) {
    setSheetError(null);
    setSheetMessage(null);
    if (!user?.id || state.name.trim().length < 2) {
      setSheetError("Please enter a project name (at least 2 characters).");
      return;
    }
    const missing: string[] = [];
    if (!state.place_id || state.lat == null || state.lng == null) missing.push("Site address (choose from suggestions)");
    if (!(state.region ?? "").trim()) missing.push("Region");
    const pt = state.projectType === "Other" ? (state.projectTypeOther ?? "").trim() : (state.projectType ?? "").trim();
    if (!pt) missing.push("Project type");
    if (!(state.startDate ?? "").trim()) missing.push("Start date");
    if (!(state.clientName ?? "").trim()) missing.push("Client name");
    if (!(state.mainContractor ?? "").trim()) missing.push("Main contractor");
    if (!(state.swmpOwner ?? "").trim()) missing.push("SWMP owner");
    if (missing.length) {
      setSheetError(`Please complete the highlighted fields: ${missing.join(", ")}`);
      return;
    }
    const validateRes = await fetch("/api/validate-address", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ place_id: state.place_id }),
    });
    if (!validateRes.ok) {
      const err = await validateRes.json();
      setSheetError(err?.error ?? "Address validation failed.");
      return;
    }
    const serverAddress = (await validateRes.json()) as { formatted_address: string; place_id: string; lat: number; lng: number };
    const ptSave = state.projectType === "Other" ? (state.projectTypeOther.trim() || "Other") : state.projectType;
    setCreateLoading(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          name: state.name.trim(),
          address: serverAddress.formatted_address,
          site_address: serverAddress.formatted_address,
          site_place_id: serverAddress.place_id,
          site_lat: serverAddress.lat,
          site_lng: serverAddress.lng,
          region: state.region,
          project_type: ptSave,
          start_date: state.startDate,
          end_date: null,
          client_name: state.clientName.trim(),
          main_contractor: state.mainContractor.trim(),
          swmp_owner: state.swmpOwner.trim(),
        })
        .select("id")
        .single();
      if (error) {
        setSheetError(error.message);
        return;
      }
      setSheetMessage("Project created.");
      await fetchProjects();
      setNewProjectSheetOpen(false);
      if (data?.id) router.push(`/projects/${data.id}/inputs`);
    } finally {
      setCreateLoading(false);
    }
  }

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        (p.name ?? "").toLowerCase().includes(q) ||
        (p.address ?? "").toLowerCase().includes(q) ||
        (p.region ?? "").toLowerCase().includes(q) ||
        (p.project_type ?? "").toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  if (loading) {
    return (
      <AppShell
        topNav={
          <div className="flex w-full items-center justify-between">
            <Skeleton className="h-6 w-24" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[100px] rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Skeleton className="h-48 rounded-xl lg:col-span-4" />
            <div className="space-y-4 lg:col-span-8">
              <Skeleton className="h-12 w-full rounded-lg" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-52 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      topNav={
        <ProjectsDashboardNav
          title="Projects"
          userEmail={user?.email ?? null}
          isSuperAdmin={isSuperAdmin}
          onNewProject={() => setNewProjectSheetOpen(true)}
          onSignOut={handleSignOut}
        />
      }
    >
      <div className="space-y-6">
        {pageError ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{pageError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: minimal Create project card */}
          <div className="lg:col-span-4">
            <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden p-6">
              <div className="flex flex-col items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-3 text-primary">
                  <Plus className="size-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-foreground">Create a project</h2>
                  <p className="text-sm text-muted-foreground">
                    Add a new project with site, region, and dates. You can edit details on the inputs page.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="default"
                  className="w-full sm:w-auto"
                  onClick={() => setNewProjectSheetOpen(true)}
                >
                  <Plus className="size-4 mr-2" />
                  New project
                </Button>
              </div>
            </div>
          </div>

          {/* Right: KPIs + Your Projects */}
          <div className="lg:col-span-8 space-y-6">
            {metricsError ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                <span className="text-destructive">{metricsError}</span>
                <Button variant="outline" size="sm" onClick={() => fetchMetrics()} disabled={metricsLoading}>
                  Retry
                </Button>
              </div>
            ) : null}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={<FolderOpen className="size-5" />}
                label="Active projects"
                value={metrics?.activeProjects}
                loading={metricsLoading}
              />
              <StatCard
                icon={<Recycle className="size-5" />}
                label="Total waste streams"
                value={metrics?.totalWasteStreamsConfigured}
                loading={metricsLoading}
              />
              <StatCard
                icon={<Building2 className="size-5" />}
                label="Facilities utilised"
                value={metrics?.facilitiesLinked}
                loading={metricsLoading}
              />
              <StatCard
                icon={<TrendingUp className="size-5" />}
                label="Estimated waste (t)"
                value={metrics?.totalEstimatedWasteTonnes != null ? formatTonnes(metrics.totalEstimatedWasteTonnes) : undefined}
                loading={metricsLoading}
              />
            </div>

            <SectionCard
              title="Your Projects"
              description="Open a project to edit inputs and generate its SWMP."
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    fetchProjects();
                    fetchMetrics();
                  }}
                  disabled={listLoading}
                >
                  {listLoading ? "Refreshing…" : "Refresh"}
                </Button>
              }
            >
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search projects…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  {searchQuery.trim() ? (
                    <span className="text-xs text-muted-foreground">
                      {filteredProjects.length} of {projects.length} projects
                    </span>
                  ) : null}
                </div>

                {listLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <Skeleton key={i} className="h-52 rounded-xl" />
                    ))}
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="rounded-xl border border-border/50 bg-muted/30 py-12 px-6 text-center">
                    <p className="font-medium text-foreground">
                      {projects.length === 0 ? "No projects yet" : "No projects match your search"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {projects.length === 0
                        ? "Create your first project using the button above or New project in the header."
                        : "Try a different search term."}
                    </p>
                    {projects.length === 0 && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="mt-4"
                        onClick={() => setNewProjectSheetOpen(true)}
                      >
                        New project
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProjects.map((p) => (
                      <ProjectCard
                        key={p.id}
                        id={p.id}
                        name={p.name}
                        address={p.address}
                        region={p.region}
                        project_type={p.project_type}
                        created_at={p.created_at}
                        status={
                          statusByProjectId.get(p.id) ?? {
                            inputs_complete: false,
                            forecasting_started: false,
                            outputs_generated: false,
                          }
                        }
                        onOpen={() => router.push(`/projects/${p.id}/inputs`)}
                        checklist={checklistByProjectId.get(p.id) ?? null}
                        onDeleteRequest={(proj) => setDeleteDialogProject(proj)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
        </div>

        <NewProjectSheet
          open={newProjectSheetOpen}
          onOpenChange={(open) => {
            setNewProjectSheetOpen(open);
            if (!open) {
              setSheetError(null);
              setSheetMessage(null);
            }
          }}
          onSubmit={handleNewProjectSubmit}
          loading={createLoading}
          error={sheetError}
          successMessage={sheetMessage}
          projectTypeGroups={PROJECT_TYPE_GROUPS}
        />

        {deleteDialogProject && (
          <DeleteProjectDialog
            open={!!deleteDialogProject}
            onOpenChange={(open) => !open && setDeleteDialogProject(null)}
            projectId={deleteDialogProject.id}
            projectName={deleteDialogProject.name}
            onDeleted={() => {
              fetchProjects();
              fetchMetrics();
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
