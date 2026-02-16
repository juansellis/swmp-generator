"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Notice } from "@/components/notice";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROJECT_TYPE_GROUPS, PROJECT_TYPE_OPTIONS } from "@/lib/projectTypeOptions";
import { fetchProjectStatusDataForProjects } from "@/lib/projectStatus";
import type { ProjectStatusData } from "@/lib/projectStatus";
import { ProjectCard } from "@/components/project-card";
import { QuickCreateProjectModal } from "@/components/quick-create-project-modal";
import type { QuickCreateProjectFormState } from "@/components/quick-create-project-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { AddressPicker, type AddressPickerValue } from "@/components/address-picker";
import {
  FolderOpen,
  Recycle,
  Building2,
  TrendingUp,
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

function MetricCard({
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
    <div className="rounded-xl border border-border bg-card/50 shadow-sm p-4 min-h-[92px] flex flex-col justify-center">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 h-4 w-4 shrink-0 flex items-center justify-center text-muted-foreground [&>svg]:size-4">
          {icon}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium leading-snug text-muted-foreground line-clamp-2 break-words tracking-normal">
            {label}
          </p>
          {loading ? (
            <div className="h-8 w-12 animate-pulse rounded bg-muted/80" aria-hidden />
          ) : (
            <p className="text-2xl font-semibold tabular-nums">{value ?? "—"}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTonnes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n >= 100) return n.toFixed(1);
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(3);
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

  // Create form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [siteAddressValidated, setSiteAddressValidated] = useState<AddressPickerValue | null>(null);
  const [region, setRegion] = useState<(typeof REGION_OPTIONS)[number] | "">("");
  const [projectType, setProjectType] = useState("");
  const [projectTypeOther, setProjectTypeOther] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [clientName, setClientName] = useState("");
  const [mainContractor, setMainContractor] = useState("");
  const [swmpOwner, setSwmpOwner] = useState("");

  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateError, setQuickCreateError] = useState<string | null>(null);
  const [quickCreateMessage, setQuickCreateMessage] = useState<string | null>(null);

  const requiredFields = useMemo(() => {
    const effective = projectType === "Other" ? projectTypeOther.trim() : projectType.trim();
    const errors: string[] = [];
    if (!siteAddressValidated?.place_id || siteAddressValidated.lat == null || siteAddressValidated.lng == null) errors.push("Site address (choose from suggestions)");
    if (!region) errors.push("Region");
    if (!effective) errors.push("Project type");
    if (!startDate) errors.push("Start date");
    if (!clientName.trim()) errors.push("Client name");
    if (!mainContractor.trim()) errors.push("Main contractor");
    if (!swmpOwner.trim()) errors.push("SWMP owner");
    return errors;
  }, [siteAddressValidated, region, projectType, projectTypeOther, startDate, clientName, mainContractor, swmpOwner]);

  const canCreate = useMemo(() => {
    return (
      !!user?.id &&
      name.trim().length >= 2 &&
      requiredFields.length === 0
    );
  }, [user?.id, name, requiredFields.length]);

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

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateMessage(null);
    setValidationErrors([]);

    // Validate required fields
    if (requiredFields.length > 0) {
      setValidationErrors(requiredFields);
      setCreateError(`Please fill in all required fields: ${requiredFields.join(", ")}`);
      return;
    }

    if (!user?.id || name.trim().length < 2) {
      setCreateError("Please enter a project name (at least 2 characters).");
      return;
    }

    setCreateLoading(true);

    try {
      const validated = siteAddressValidated;
      if (!validated?.place_id || validated.lat == null || validated.lng == null) {
        setCreateError("Please select a site address from the suggestions.");
        setCreateLoading(false);
        return;
      }
      const validateRes = await fetch("/api/validate-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ place_id: validated.place_id }),
      });
      if (!validateRes.ok) {
        const err = await validateRes.json();
        setCreateError(err?.error ?? "Address validation failed.");
        setCreateLoading(false);
        return;
      }
      const serverAddress = (await validateRes.json()) as { formatted_address: string; place_id: string; lat: number; lng: number };
      const ptSave = projectType === "Other" ? (projectTypeOther.trim() || "Other") : projectType;
      const insertPayload = {
        user_id: user!.id,
        name: name.trim(),
        address: serverAddress.formatted_address,
        site_address: serverAddress.formatted_address,
        site_place_id: serverAddress.place_id,
        site_lat: serverAddress.lat,
        site_lng: serverAddress.lng,
        region: region,
        project_type: ptSave,
        start_date: startDate,
        end_date: endDate.trim() || null,
        client_name: clientName.trim(),
        main_contractor: mainContractor.trim(),
        swmp_owner: swmpOwner.trim(),
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
      setSiteAddressValidated(null);
      setRegion("");
      setProjectType("");
      setProjectTypeOther("");
      setStartDate("");
      setEndDate("");
      setClientName("");
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

  async function handleQuickCreateSubmit(state: QuickCreateProjectFormState) {
    setQuickCreateError(null);
    setQuickCreateMessage(null);
    if (!user?.id || state.name.trim().length < 2) {
      setQuickCreateError("Please enter a project name (at least 2 characters).");
      return;
    }
    const missing: string[] = [];
    if (!state.place_id || state.lat == null || state.lng == null) missing.push("Site address (choose from suggestions)");
    if (!state.region) missing.push("Region");
    const pt = state.projectType === "Other" ? state.projectTypeOther.trim() : state.projectType.trim();
    if (!pt) missing.push("Project type");
    if (!state.startDate) missing.push("Start date");
    if (!state.clientName.trim()) missing.push("Client name");
    if (!state.mainContractor.trim()) missing.push("Main contractor");
    if (!state.swmpOwner.trim()) missing.push("SWMP owner");
    if (missing.length) {
      setQuickCreateError(`Please fill in: ${missing.join(", ")}`);
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
      setQuickCreateError(err?.error ?? "Address validation failed.");
      return;
    }
    const serverAddress = (await validateRes.json()) as { formatted_address: string; place_id: string; lat: number; lng: number };
    const ptSave = state.projectType === "Other" ? (state.projectTypeOther.trim() || "Other") : state.projectType;
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
      setQuickCreateError(error.message);
      return;
    }
    setQuickCreateMessage("Project created.");
    await fetchProjects();
    setQuickCreateOpen(false);
    if (data?.id) router.push(`/projects/${data.id}/inputs`);
  }

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="flex justify-between items-center">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Projects"
          subtitle={
            <span>
              Logged in as{" "}
              <Badge variant="outline" className="ml-1">
                {user?.email ?? "Unknown"}
              </Badge>
            </span>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button variant="primary" size="default" onClick={() => setQuickCreateOpen(true)}>
                Quick Create Project
              </Button>
              {isSuperAdmin && (
                <Button variant="outline" size="default" onClick={() => router.push("/admin")} aria-label="Management (super admin)">
                  Management
                </Button>
              )}
              <Button variant="outline" size="default" onClick={() => router.push("/settings/brand")}>
                Brand Settings
              </Button>
              <Button variant="outline" size="default" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          }
        />

        {pageError ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{pageError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <SectionCard
              title="Create a New Project"
              description="Create a project, then go straight to inputs."
            >
              <form onSubmit={handleCreateProject} className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Project name *</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Hobson St Fit-out"
                      disabled={createLoading}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Site address *</Label>
                    <AddressPicker
                      value={address}
                      onChange={(v) => {
                        setSiteAddressValidated(v);
                        setAddress(v?.formatted_address ?? "");
                      }}
                      onInput={(v) => {
                        setAddress(v);
                        if (!v.trim()) setSiteAddressValidated(null);
                      }}
                      placeholder="Search address…"
                      disabled={createLoading}
                    />
                    <p className="text-xs text-muted-foreground">Choose from suggestions to validate the address.</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Region *</Label>
                    <Select
                      value={region}
                      onValueChange={(value) => setRegion(value as any)}
                      disabled={createLoading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        {REGION_OPTIONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Project type *</Label>
                    <Select
                      value={PROJECT_TYPE_OPTIONS.includes(projectType) ? projectType : projectType ? "Other" : undefined}
                      onValueChange={(value) => {
                        setProjectType(value ?? "");
                        if (value !== "Other") setProjectTypeOther("");
                      }}
                      disabled={createLoading}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select project type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_TYPE_GROUPS.map((group) => (
                          <SelectGroup key={group.label}>
                            <SelectLabel className="font-semibold">{group.label}</SelectLabel>
                            {group.options.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                    {projectType === "Other" && (
                      <Input
                        value={projectTypeOther}
                        onChange={(e) => setProjectTypeOther(e.target.value)}
                        placeholder="Describe project type"
                        disabled={createLoading}
                        className="mt-2"
                      />
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Start date *</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      disabled={createLoading}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>End date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={createLoading}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Client name *</Label>
                  <Input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Auckland Council / Precinct Properties / Client Ltd"
                    disabled={createLoading}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Main contractor *</Label>
                    <Input
                      value={mainContractor}
                      onChange={(e) => setMainContractor(e.target.value)}
                      placeholder="Company name"
                      disabled={createLoading}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>SWMP owner *</Label>
                    <Input
                      value={swmpOwner}
                      onChange={(e) => setSwmpOwner(e.target.value)}
                      placeholder="Name / role"
                      disabled={createLoading}
                    />
                  </div>
                </div>

                {validationErrors.length > 0 ? (
                  <Notice
                    type="error"
                    title="Missing required fields"
                    message={`Please fill in: ${validationErrors.join(", ")}`}
                  />
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="submit"
                    variant="primary"
                    size="default"
                    disabled={createLoading || !canCreate}
                  >
                    {createLoading ? "Creating…" : "Create Project"}
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    Required: project name, site address, region, project type, start date, client name, main contractor, SWMP owner
                  </div>
                </div>

                {createError ? (
                  <Notice
                    type="error"
                    title="Couldn't create project"
                    message={createError}
                  />
                ) : null}

                {createMessage ? (
                  <Notice
                    type="success"
                    title="Success"
                    message={createMessage}
                  />
                ) : null}
              </form>
            </SectionCard>
          </div>

          <div className="lg:col-span-3 space-y-6">
            {/* Project Intelligence metrics strip */}
            <div className="space-y-3">
              {metricsError ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                  <span className="text-destructive">{metricsError}</span>
                  <Button variant="outline" size="sm" onClick={() => fetchMetrics()} disabled={metricsLoading}>
                    Retry
                  </Button>
                </div>
              ) : null}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  icon={<FolderOpen className="size-5 text-muted-foreground" />}
                  label="Active Projects"
                  value={metrics?.activeProjects}
                  loading={metricsLoading}
                />
                <MetricCard
                  icon={<Recycle className="size-5 text-muted-foreground" />}
                  label="Total Waste Streams"
                  value={metrics?.totalWasteStreamsConfigured}
                  loading={metricsLoading}
                />
                <MetricCard
                  icon={<Building2 className="size-5 text-muted-foreground" />}
                  label="Facilities utilised"
                  value={metrics?.facilitiesLinked}
                  loading={metricsLoading}
                />
                <MetricCard
                  icon={<TrendingUp className="size-5 text-muted-foreground" />}
                  label="Total estimated waste (tonnes)"
                  value={metrics?.totalEstimatedWasteTonnes != null ? formatTonnes(metrics.totalEstimatedWasteTonnes) : undefined}
                  loading={metricsLoading}
                />
              </div>
            </div>

            <SectionCard
              title="Your Projects"
              description="Open a project to edit inputs and generate its SWMP."
              actions={
                <Button variant="outline" size="default" onClick={() => { fetchProjects(); fetchMetrics(); }} disabled={listLoading}>
                  {listLoading ? "Refreshing…" : "Refresh"}
                </Button>
              }
            >
              {listLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-44 rounded-xl" />
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <Alert>
                  <AlertTitle>No projects yet</AlertTitle>
                  <AlertDescription>Create your first project using Quick Create or the form.</AlertDescription>
                </Alert>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.map((p) => (
                    <ProjectCard
                      key={p.id}
                      id={p.id}
                      name={p.name}
                      address={p.address}
                      region={p.region}
                      project_type={p.project_type}
                      created_at={p.created_at}
                      status={statusByProjectId.get(p.id) ?? {
                        inputs_complete: false,
                        forecasting_started: false,
                        outputs_generated: false,
                      }}
                      onOpen={() => router.push(`/projects/${p.id}/inputs`)}
                      checklist={checklistByProjectId.get(p.id) ?? null}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>

        <QuickCreateProjectModal
          open={quickCreateOpen}
          onOpenChange={(open) => {
            setQuickCreateOpen(open);
            if (!open) {
              setQuickCreateError(null);
              setQuickCreateMessage(null);
            }
          }}
          onSubmit={handleQuickCreateSubmit}
          loading={createLoading}
          error={quickCreateError}
          successMessage={quickCreateMessage}
          projectTypeOptions={[]}
          projectTypeGroups={PROJECT_TYPE_GROUPS}
        />
      </div>
    </AppShell>
  );
}
