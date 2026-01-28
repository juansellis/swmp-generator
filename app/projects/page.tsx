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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

export default function ProjectsPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // Create form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
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

  const requiredFields = useMemo(() => {
    const effective = projectType === "Other" ? projectTypeOther.trim() : projectType.trim();
    const errors: string[] = [];
    if (!address.trim()) errors.push("Site address");
    if (!region) errors.push("Region");
    if (!effective) errors.push("Project type");
    if (!startDate) errors.push("Start date");
    if (!clientName.trim()) errors.push("Client name");
    if (!mainContractor.trim()) errors.push("Main contractor");
    if (!swmpOwner.trim()) errors.push("SWMP owner");
    return errors;
  }, [address, region, projectType, projectTypeOther, startDate, clientName, mainContractor, swmpOwner]);

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
      const ptSave = projectType === "Other" ? (projectTypeOther.trim() || "Other") : projectType;
      const insertPayload = {
        user_id: user!.id,
        name: name.trim(),
        address: address.trim(),
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
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g., 26 Hobson Street, Auckland CBD"
                      disabled={createLoading}
                    />
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

          <div className="lg:col-span-3">
            <SectionCard
              title="Your Projects"
              description="Open a project to edit inputs and generate its SWMP."
              actions={
                <Button variant="outline" size="default" onClick={fetchProjects} disabled={listLoading}>
                  {listLoading ? "Refreshing…" : "Refresh"}
                </Button>
              }
            >
              {listLoading ? (
                <div className="text-sm text-muted-foreground">Loading projects…</div>
              ) : projects.length === 0 ? (
                <Alert>
                  <AlertTitle>No projects yet</AlertTitle>
                  <AlertDescription>Create your first project using the form.</AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((p) => (
                      <TableRow
                        key={p.id}
                        onClick={() => router.push(`/projects/${p.id}/inputs`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(`/projects/${p.id}/inputs`);
                          }
                        }}
                        tabIndex={0}
                        className="cursor-pointer hover:bg-muted focus:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        role="button"
                        aria-label={`Open project ${p.name}`}
                      >
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="max-w-[260px] truncate">
                          {p.address ?? "No address"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{p.region ?? "Not set"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{p.project_type ?? "Not set"}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(p.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/projects/${p.id}/inputs`);
                            }}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
