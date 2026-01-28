"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { AppShell } from "@/components/app-shell";
import { SubPanel } from "@/components/form-section";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { Notice } from "@/components/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ChevronDownIcon, ChevronUpIcon, XIcon, UploadIcon, Loader2Icon } from "lucide-react";


type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  site_address?: string | null;
  address: string | null;
  region: string | null;
  project_type: string | null;
  start_date: string | null;
  end_date: string | null;
  client_name: string | null;
  client_logo_url: string | null;
  report_title: string | null;
  report_footer_override: string | null;
  main_contractor: string | null;
  swmp_owner: string | null;
};

const SORTING_LEVELS = ["Basic", "Moderate", "High"] as const;

/** Sorting level → default target diversion. Only applied when target is 0 or user clicks "Apply template defaults". */
const SORTING_LEVEL_TARGET: Record<(typeof SORTING_LEVELS)[number], number> = {
  Basic: 40,
  Moderate: 60,
  High: 80,
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

const WASTE_STREAM_SET = new Set<string>(WASTE_STREAM_LIBRARY);

/** Project type → default waste streams. Only labels present in WASTE_STREAM_LIBRARY are used. */
const PROJECT_TYPE_WASTE_STREAMS: Record<string, string[]> = {
  "New build house": [
    "Mixed C&D",
    "Timber (untreated)",
    "Timber (treated)",
    "Metals",
    "Cardboard",
    "Hard plastics",
    "Soft plastics (wrap/strapping)",
    "Insulation",
    "Plasterboard / GIB",
    "Concrete / masonry",
    "Carpet / carpet tiles",
    "Paints/adhesives/chemicals",
    "E-waste (cables/lighting/appliances)",
    "Soil / spoil (cleanfill if verified)",
  ].filter((s) => WASTE_STREAM_SET.has(s)),
  "Civil works / earthworks": [
    "Concrete / masonry",
    "Soil / spoil (cleanfill if verified)",
    "Soft plastics (wrap/strapping)",
    "Metals",
  ].filter((s) => WASTE_STREAM_SET.has(s)),
  "Commercial fit-out": [
    "Plasterboard / GIB",
    "Timber (untreated)",
    "Timber (treated)",
    "Metals",
    "Cardboard",
    "Soft plastics (wrap/strapping)",
    "Hard plastics",
    "Carpet / carpet tiles",
    "Paints/adhesives/chemicals",
    "E-waste (cables/lighting/appliances)",
    "Mixed C&D",
  ].filter((s) => WASTE_STREAM_SET.has(s)),
  "Demolition / strip-out (commercial)": [
    "Concrete / masonry",
    "Metals",
    "Timber (untreated)",
    "Timber (treated)",
    "Plasterboard / GIB",
    "Glass",
    "Mixed C&D",
  ].filter((s) => WASTE_STREAM_SET.has(s)),
};

function getWasteStreamsForProjectType(projectType: string): string[] {
  const mapped = PROJECT_TYPE_WASTE_STREAMS[projectType];
  if (mapped && mapped.length > 0) return [...mapped];
  return ["Mixed C&D"];
}

type WasteStreamPlan = {
  category: string;
  sub_material?: string | null;
  outcomes: Outcome[];
  partner?: string | null;
  partner_overridden?: boolean;
  pathway: string;
  notes?: string | null;
  estimated_qty?: number | null;
  unit?: "kg" | "t" | "m3" | "skip" | "load" | null;
};

const OUTCOME_OPTIONS = ["Reuse", "Recycle", "Cleanfill", "Landfill"] as const;
type Outcome = (typeof OUTCOME_OPTIONS)[number];

const MONITORING_METHOD_OPTIONS = [
  "Dockets",
  "Invoices/receipts",
  "Photos",
  "Monthly reporting",
  "Toolbox talks",
] as const;

type ResponsibilityRow = { role: string; party: string; responsibilities: string[] };

type AdditionalResponsibility = {
  name: string;
  role: string;
  email?: string;
  phone?: string;
  responsibilities: string;
};

const DEFAULT_RESPONSIBILITIES: ResponsibilityRow[] = [
  { role: "SWMP Owner", party: "SWMP Owner", responsibilities: ["Maintain SWMP", "Coordinate waste streams and reporting", "Drive improvements"] },
  { role: "Main Contractor / Site Manager", party: "Main Contractor", responsibilities: ["Ensure segregation is followed", "Manage contamination", "Coordinate contractor"] },
  { role: "All trades", party: "Subcontractors", responsibilities: ["Follow segregation rules", "Keep areas tidy", "Report issues promptly"] },
];

const COMMON_STREAM_SET = [
  "Mixed C&D",
  "Timber (untreated)",
  "Metals",
  "Cardboard",
  "Plasterboard / GIB",
  "Concrete / masonry",
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

import { PROJECT_TYPE_GROUPS, PROJECT_TYPE_OPTIONS } from "@/lib/projectTypeOptions";

export default function ProjectInputsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params?.id;

  const [project, setProject] = useState<ProjectRow | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [pageError, setPageError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  

  // Input state
  const [clientLogoUrl, setClientLogoUrl] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [reportFooter, setReportFooter] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [region, setRegion] = useState("");
  const [projectType, setProjectType] = useState("");
  const [projectTypeOther, setProjectTypeOther] = useState("");
  const [startDate, setStartDate] = useState(""); // YYYY-MM-DD
  const [clientName, setClientName] = useState("");
  const [mainContractor, setMainContractor] = useState("");
  const [swmpOwner, setSwmpOwner] = useState("");
  const [projectClientName, setProjectClientName] = useState(""); // optional
  const [saveProjectMsg, setSaveProjectMsg] = useState<string | null>(null);
  const [saveProjectError, setSaveProjectError] = useState<string | null>(null);

  // Client logo upload state
  const [uploadingClientLogo, setUploadingClientLogo] = useState(false);
  const [clientLogoUploadProgress, setClientLogoUploadProgress] = useState(0);

  const [streamPlans, setStreamPlans] = useState<WasteStreamPlan[]>([]);
  const [streamPlanMsg, setStreamPlanMsg] = useState<string | null>(null);
  const [streamPlanErr, setStreamPlanErr] = useState<string | null>(null);

  const [sortingLevel, setSortingLevel] =
    useState<(typeof SORTING_LEVELS)[number]>("Moderate");

  const [targetDiversion, setTargetDiversion] = useState<number>(70);

  const [selectedConstraints, setSelectedConstraints] = useState<string[]>([]);
  const [selectedWasteStreams, setSelectedWasteStreams] = useState<string[]>(["Mixed C&D"]);

  const [wasteStreamSearch, setWasteStreamSearch] = useState("");
  const [expandedStreamPlans, setExpandedStreamPlans] = useState<Record<string, boolean>>({});
  const [copyFromStream, setCopyFromStream] = useState<string>("");
  const [wasteContractor, setWasteContractor] = useState("");

  const [monitoringMethods, setMonitoringMethods] = useState<string[]>(["Dockets"]);
  const [usesSoftware, setUsesSoftware] = useState(false);
  const [softwareName, setSoftwareName] = useState("");
  const DEFAULT_DOCKETS_DESCRIPTION =
    "All waste movements will be supported by weighbridge dockets and/or disposal receipts/invoices. These records will be retained as evidence of disposal pathway and used for SWMP reporting and diversion tracking.";
  const [docketsDescription, setDocketsDescription] = useState(DEFAULT_DOCKETS_DESCRIPTION);

  const [projectSaveMsg, setProjectSaveMsg] = useState<string | null>(null);
  const [projectSaveErr, setProjectSaveErr] = useState<string | null>(null);

  const effectiveProjectType = projectType === "Other" ? projectTypeOther.trim() : projectType.trim();
  const requiredOk =
    siteAddress.trim().length > 0 &&
    region.trim().length > 0 &&
    effectiveProjectType.length > 0 &&
    startDate.trim().length > 0 &&
    clientName.trim().length > 0 &&
    mainContractor.trim().length > 0 &&
    swmpOwner.trim().length > 0;

  // Ensure at least one monitoring method is selected.
  useEffect(() => {
    if (monitoringMethods.length === 0) {
      setMonitoringMethods(["Dockets"]);
    }
  }, [monitoringMethods]);



  // Keep detailed stream plans in sync with the selected streams.
  // - One plan per selected stream (category === stream)
  // - Remove plans for unselected streams
  useEffect(() => {
    setStreamPlans((prev) => {
      const prevByCategory = new Map(prev.map((p) => [p.category, p] as const));

      const next = selectedWasteStreams.map((stream) => {
        const existing = prevByCategory.get(stream);
        if (existing) return existing;

        return {
          category: stream,
          sub_material: null,
          outcomes: ["Recycle"] as Outcome[],
          partner: null,
          partner_overridden: false,
          pathway: `Segregate ${stream} where practical and send to an approved recycler/processor.`,
          notes: null,
          estimated_qty: null,
          unit: null,
        };
      });

      // Avoid unnecessary state updates when nothing changed.
      if (
        prev.length === next.length &&
        prev.every((p, i) => p.category === next[i]?.category && p === next[i])
      ) {
        return prev;
      }

      return next;
    });
  }, [selectedWasteStreams]);

  // Default selection for new/empty projects: ensure Mixed C&D is selected on first load.
  const didInitDefaultStreamsRef = useRef(false);
  useEffect(() => {
    if (didInitDefaultStreamsRef.current) return;
    if (loading) return;

    if (selectedWasteStreams.length === 0) {
      setSelectedWasteStreams(["Mixed C&D"]);
    }

    didInitDefaultStreamsRef.current = true;
  }, [loading, selectedWasteStreams.length]);

  // When project type changes and no streams are selected, auto-apply project-type template.
  useEffect(() => {
    if (selectedWasteStreams.length > 0) return;
    const next = getWasteStreamsForProjectType(effectiveProjectType);
    if (next.length > 0) setSelectedWasteStreams(next);
  }, [effectiveProjectType, selectedWasteStreams.length]);

  // Auto-populate partner from waste contractor unless user overrides per plan.
  useEffect(() => {
    const contractor = wasteContractor.trim() || null;

    setStreamPlans((prev) => {
      let changed = false;
      const next = prev.map((p) => {
        const overridden = !!p.partner_overridden;
        if (overridden) return p;

        const nextPartner = contractor;
        if ((p.partner ?? null) === nextPartner) return p;

        changed = true;
        return { ...p, partner: nextPartner };
      });

      return changed ? next : prev;
    });
  }, [wasteContractor]);

  // Keep expand/collapse state aligned to current selection.
  useEffect(() => {
    setExpandedStreamPlans((prev) => {
      const next: Record<string, boolean> = {};
      for (const s of selectedWasteStreams) {
        next[s] = prev[s] ?? false; // collapsed by default
      }
      return next;
    });
  }, [selectedWasteStreams]);

  useEffect(() => {
    setCopyFromStream((prev) => {
      if (selectedWasteStreams.length === 0) return "";
      if (!prev || !selectedWasteStreams.includes(prev)) return selectedWasteStreams[0];
      return prev;
    });
  }, [selectedWasteStreams]);

  const [hazAsbestos, setHazAsbestos] = useState(false);
  const [hazLeadPaint, setHazLeadPaint] = useState(false);
  const [hazContaminatedSoil, setHazContaminatedSoil] = useState(false);

  const [binPreference, setBinPreference] = useState<"Recommend" | "Manual">(
    "Recommend"
  );
  const [reportingCadence, setReportingCadence] = useState<
    "Weekly" | "Fortnightly" | "Monthly"
  >("Weekly");

  const [notes, setNotes] = useState("");

  const [responsibilities, setResponsibilities] = useState<ResponsibilityRow[]>(DEFAULT_RESPONSIBILITIES);
  const [additionalResponsibilities, setAdditionalResponsibilities] = useState<AdditionalResponsibility[]>([]);

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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
        setPageError(projectErr?.message ?? "Project not found");
        setLoading(false);
        return;
      }
  
      setProject(project);
      setClientLogoUrl(project.client_logo_url ?? "");
      setReportTitle(project.report_title ?? "");
      setReportFooter(project.report_footer_override ?? "");
      setProjectClientName(project.client_name ?? "");
      setSiteAddress((project.site_address ?? project.address ?? "") as string);
      setRegion(project.region ?? "");
      const pt = project.project_type ?? "";
      if (pt && !PROJECT_TYPE_OPTIONS.includes(pt)) {
        setProjectType("Other");
        setProjectTypeOther(pt);
      } else {
        setProjectType(pt);
        setProjectTypeOther("");
      }
      setStartDate(project.start_date ?? ""); // YYYY-MM-DD
      setClientName(project.client_name ?? "");
      setMainContractor(project.main_contractor ?? "");
      setSwmpOwner(project.swmp_owner ?? "");

  
      // 2️⃣ Fetch latest saved SWMP inputs (THIS IS OPTION B)
      const { data: savedInputs, error: savedInputsErr } = await supabase
        .from("swmp_inputs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
  
      if (!mounted) return;

      if (savedInputsErr) console.warn(savedInputsErr);
  
      if (!savedInputsErr && savedInputs) {
        // 🔁 Hydrate form state from DB (normalize "Medium" → "Moderate" for sorting level)
        const rawLevel = savedInputs.sorting_level ?? "Moderate";
        setSortingLevel((rawLevel === "Medium" ? "Moderate" : rawLevel) as (typeof SORTING_LEVELS)[number]);
        setTargetDiversion(savedInputs.target_diversion ?? 70);
        setSelectedConstraints(savedInputs.constraints ?? []);
        setSelectedWasteStreams(savedInputs.waste_streams ?? []);
  
        setHazAsbestos(!!savedInputs.hazards?.asbestos);
        setHazLeadPaint(!!savedInputs.hazards?.lead_paint);
        setHazContaminatedSoil(!!savedInputs.hazards?.contaminated_soil);
  
        setWasteContractor(savedInputs.logistics?.waste_contractor ?? "");
        setBinPreference(savedInputs.logistics?.bin_preference ?? "Recommend");
        setReportingCadence(savedInputs.logistics?.reporting_cadence ?? "Weekly");
        setMonitoringMethods(savedInputs.monitoring?.methods ?? ["Dockets"]);
        setUsesSoftware(!!savedInputs.monitoring?.uses_software);
        setSoftwareName(savedInputs.monitoring?.software_name ?? "");
        setDocketsDescription(savedInputs.monitoring?.dockets_description ?? DEFAULT_DOCKETS_DESCRIPTION);

  
        const rawPlans = Array.isArray(savedInputs.waste_stream_plans)
          ? savedInputs.waste_stream_plans
          : [];

        // Migrate legacy `{ outcome: "Dispose" }` to `{ outcomes: ["Landfill"] }` etc in-memory.
        const migratedPlans = rawPlans.map((p: any) => {
          const rawOutcomes = Array.isArray(p?.outcomes)
            ? p.outcomes
            : typeof p?.outcome === "string"
              ? [p.outcome]
              : ["Recycle"];

          const allowed = new Set(OUTCOME_OPTIONS as readonly string[]);
          const normalizeOutcome = (x: string) => {
            const v = x.trim();
            if (v === "Dispose") return "Landfill";
            if (v === "Recover") return "Recycle";
            if (v === "Clean fill") return "Cleanfill";
            return v;
          };

          const safeOutcomes = (rawOutcomes as any[])
            .map((x) => normalizeOutcome(String(x)))
            .filter((x) => allowed.has(x)) as Outcome[];

          const outcomes: Outcome[] = safeOutcomes.length > 0 ? safeOutcomes : ["Recycle"];

          return {
            category: String(p?.category ?? ""),
            sub_material: p?.sub_material ?? null,
            outcomes,
            partner: p?.partner ?? null,
            partner_overridden: !!p?.partner_overridden,
            pathway: String(
              p?.pathway ??
                `Segregate ${String(p?.category ?? "this stream")} where practical and send to an approved recycler/processor.`
            ),
            notes: p?.notes ?? null,
            estimated_qty: p?.estimated_qty ?? null,
            unit: p?.unit ?? null,
          } satisfies WasteStreamPlan;
        });

        setStreamPlans(migratedPlans);

        setNotes(savedInputs.notes ?? "");

        const rawResp = (savedInputs as any).responsibilities;
        const defaultRespWithParty = DEFAULT_RESPONSIBILITIES.map((d, i) => ({
          ...d,
          party: i === 0 ? (project?.swmp_owner ?? d.party) : i === 1 ? (project?.main_contractor ?? d.party) : d.party,
        }));
        if (Array.isArray(rawResp)) {
          const main = rawResp.filter((r: any) => !r?.__additional);
          const additionalFromResp = rawResp.filter((r: any) => r?.__additional).map((a: any) => ({
            name: String(a?.name ?? "").trim(),
            role: String(a?.role ?? "").trim(),
            email: a?.email != null ? String(a.email).trim() : undefined,
            phone: a?.phone != null ? String(a.phone).trim() : undefined,
            responsibilities: String(a?.responsibilities ?? "").trim(),
          }));
          if (main.length >= 3) {
            setResponsibilities(
              main.slice(0, 3).map((r: any) => ({
                role: String(r?.role ?? "").trim() || "Role",
                party: String(r?.party ?? "").trim() || "—",
                responsibilities: Array.isArray(r?.responsibilities)
                  ? r.responsibilities.map((x: any) => String(x ?? "").trim()).filter(Boolean)
                  : [],
              }))
            );
          } else {
            setResponsibilities(defaultRespWithParty);
          }
          const extra = additionalFromResp.filter((a) => a.name || a.role || a.responsibilities);
          if (extra.length > 0) {
            setAdditionalResponsibilities(extra);
          } else {
            const legacy = (savedInputs as any).additional_responsibilities;
            if (Array.isArray(legacy)) {
              setAdditionalResponsibilities(
                legacy.map((a: any) => ({
                  name: String(a?.name ?? "").trim(),
                  role: String(a?.role ?? "").trim(),
                  email: a?.email != null ? String(a.email).trim() : undefined,
                  phone: a?.phone != null ? String(a.phone).trim() : undefined,
                  responsibilities: String(a?.responsibilities ?? "").trim(),
                })).filter((a) => a.name || a.role || a.responsibilities)
              );
            } else {
              setAdditionalResponsibilities([]);
            }
          }
        } else {
          const rawAdditional = (savedInputs as any).additional_responsibilities;
          if (Array.isArray(rawAdditional)) {
            setAdditionalResponsibilities(
              rawAdditional.map((a: any) => ({
                name: String(a?.name ?? "").trim(),
                role: String(a?.role ?? "").trim(),
                email: a?.email != null ? String(a.email).trim() : undefined,
                phone: a?.phone != null ? String(a.phone).trim() : undefined,
                responsibilities: String(a?.responsibilities ?? "").trim(),
              })).filter((a) => a.name || a.role || a.responsibilities)
            );
          } else {
            setAdditionalResponsibilities([]);
          }
          setResponsibilities(defaultRespWithParty);
        }
      } else if (project) {
        setSelectedWasteStreams(getWasteStreamsForProjectType(project.project_type ?? ""));
        setAdditionalResponsibilities([]);
        setResponsibilities(
          DEFAULT_RESPONSIBILITIES.map((d, i) => ({
            ...d,
            party: i === 0 ? (project.swmp_owner ?? d.party) : i === 1 ? (project.main_contractor ?? d.party) : d.party,
          }))
        );
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

  async function handleClientLogoUpload(file: File) {
    if (!projectId) return;
    setSaveProjectMsg(null);
    setSaveProjectError(null);
    setUploadingClientLogo(true);
    setClientLogoUploadProgress(0);

    try {
      // Get file extension
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      // Store as: projects/<projectId>/client-logo.<ext>
      const path = `${projectId}/client-logo.${ext}`;

      // Simulate progress (Supabase doesn't provide upload progress in the current API)
      const progressInterval = setInterval(() => {
        setClientLogoUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      const { error: uploadErr } = await supabase.storage
        .from("brand-assets")
        .upload(path, file, { upsert: true });

      clearInterval(progressInterval);
      setClientLogoUploadProgress(100);

      if (uploadErr) {
        setSaveProjectError(uploadErr.message);
        setUploadingClientLogo(false);
        setClientLogoUploadProgress(0);
        return;
      }

      const { data } = supabase.storage.from("brand-assets").getPublicUrl(path);
      const publicUrl = data.publicUrl;

      // Save to project
      const { error: updateErr } = await supabase
        .from("projects")
        .update({ client_logo_url: publicUrl })
        .eq("id", projectId);

      if (updateErr) {
        setSaveProjectError(updateErr.message);
        setUploadingClientLogo(false);
        setClientLogoUploadProgress(0);
        return;
      }

      setClientLogoUrl(publicUrl);
      setSaveProjectMsg("Client logo uploaded successfully.");
    } catch (error: any) {
      setSaveProjectError(error?.message ?? "Failed to upload logo");
    } finally {
      setUploadingClientLogo(false);
      setTimeout(() => setClientLogoUploadProgress(0), 500);
    }
  }

  async function handleGenerate() {
    setSaveError(null);
    setSaveMessage(null);
  
    if (!projectId) {
      setSaveError("Missing project id.");
      return;
    }

    if (!requiredOk) {
      setSaveError(
        "Please complete Project details (required) before saving inputs or generating the SWMP."
      );
      return;
    }
  
    setIsGenerating(true);
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
    } finally {
      setIsGenerating(false);
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

    if (!requiredOk) {
      setSaveError(
        "Please complete Project details (required) before saving inputs or generating the SWMP."
      );
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
        target_diversion: Math.min(100, Math.max(0, Math.round(Number(targetDiversion)) || 0)),
        constraints: selectedConstraints,
        waste_streams: selectedWasteStreams,
        hazards,
        waste_stream_plans: streamPlans,
        responsibilities: [
          ...responsibilities.map((r) => {
            const list = r.responsibilities.filter(Boolean);
            return {
              role: r.role.trim() || "Role",
              party: r.party.trim() || "—",
              responsibilities: list.length ? list : ["—"],
            };
          }),
          ...additionalResponsibilities
            .filter((a) => a.name.trim() || a.role.trim() || a.responsibilities.trim())
            .map((a) => ({
              __additional: true as const,
              name: a.name.trim(),
              role: a.role.trim(),
              email: a.email?.trim() || undefined,
              phone: a.phone?.trim() || undefined,
              responsibilities: a.responsibilities.trim(),
            })),
        ],
        logistics: {
          waste_contractor: wasteContractor.trim() || null,
          bin_preference: binPreference,
          reporting_cadence: reportingCadence,
        },
        monitoring: {
          methods: monitoringMethods,
          uses_software: usesSoftware,
          software_name: softwareName || null,
          dockets_description: docketsDescription,
        },
        notes: notes.trim() || null,
      };

      const { error } = await supabase.from("swmp_inputs").insert(payload);

      if (error) {
        setSaveError(error.message || "Failed to save inputs.");
        return;
      }

      setSaveMessage("Inputs saved. Next: generate SWMP (we’ll add this button next).");
    } finally {
      setSaveLoading(false);
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

  if (pageError) {
    return (
      <AppShell>
        <div className="space-y-6">
          <PageHeader
            title="SWMP Inputs"
            actions={
              <Button variant="outline" size="default" onClick={() => router.push("/projects")} className="transition-colors hover:bg-muted/80">
                ← Back to projects
              </Button>
            }
          />
          <Notice type="error" title="Error" message={pageError} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="SWMP Inputs"
          subtitle={
            <span>
              Project: <strong>{project?.name}</strong>
              {project?.address ? ` • ${project.address}` : ""}
            </span>
          }
          actions={
            <Button variant="outline" size="default" onClick={() => router.push("/projects")} className="transition-colors hover:bg-muted/80">
              ← Back to projects
            </Button>
          }
        />

        <SectionCard
          title="Project Details (Required)"
          description="Complete these fields to enable Save inputs and Generate SWMP."
        >
          {projectSaveErr ? (
            <Notice type="error" title="Error" message={projectSaveErr} className="mb-4" />
          ) : null}
          {projectSaveMsg ? (
            <Notice type="success" title="Success" message={projectSaveMsg} className="mb-4" />
          ) : null}
          {!requiredOk ? (
            <Notice
              type="info"
              title="Required fields incomplete"
              message="Complete these required fields to enable Save inputs and Generate SWMP."
              className="mb-4"
            />
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Site address *</Label>
              <Input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label>Region *</Label>
              <Input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. Auckland / Waikato / Canterbury"
              />
            </div>

            <div className="grid gap-2">
              <Label>Project type *</Label>
              <Select
                value={PROJECT_TYPE_OPTIONS.includes(projectType) ? projectType : "Other"}
                onValueChange={(v) => {
                  setProjectType(v ?? "");
                  if (v !== "Other") setProjectTypeOther("");
                }}
                disabled={saveLoading}
              >
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Select project type" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover text-popover-foreground border shadow-md max-h-[min(var(--radix-select-content-available-height),20rem)]">
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
                  disabled={saveLoading}
                  className="mt-2"
                />
              )}
            </div>

            <div className="grid gap-2">
              <Label>Start date *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label>Client name *</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label>Main contractor *</Label>
              <Input
                value={mainContractor}
                onChange={(e) => setMainContractor(e.target.value)}
              />
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label>SWMP owner *</Label>
              <Input
                value={swmpOwner}
                onChange={(e) => setSwmpOwner(e.target.value)}
                placeholder="Person responsible for the SWMP"
              />
            </div>
          </div>

          <SubPanel className="mt-4 shadow-sm border-muted-foreground/15">
            <Button
              type="button"
              variant="primary"
              disabled={saveLoading}
              onClick={async () => {
                setProjectSaveMsg(null);
                setProjectSaveErr(null);

                if (!projectId) {
                  setProjectSaveErr("Missing project id.");
                  return;
                }

                // required validation
                const missing: string[] = [];
                if (!siteAddress.trim()) missing.push("Site address");
                if (!region.trim()) missing.push("Region");
                const ptSave = projectType === "Other" ? (projectTypeOther.trim() || "Other") : projectType.trim();
                if (!ptSave) missing.push("Project type");
                if (!startDate.trim()) missing.push("Start date");
                if (!clientName.trim()) missing.push("Client name");
                if (!mainContractor.trim()) missing.push("Main contractor");
                if (!swmpOwner.trim()) missing.push("SWMP owner");

                if (missing.length) {
                  setProjectSaveErr(`Please complete required fields: ${missing.join(", ")}`);
                  return;
                }

                const { error } = await supabase
                  .from("projects")
                  .update({
                    site_address: siteAddress.trim(),
                    address: siteAddress.trim(), // keep compatibility if both columns exist
                    region: region.trim(),
                    project_type: ptSave,
                    start_date: startDate,
                    client_name: clientName.trim(),
                    main_contractor: mainContractor.trim(),
                    swmp_owner: swmpOwner.trim(),
                  })
                  .eq("id", projectId);

                if (error) {
                  setProjectSaveErr(error.message);
                  return;
                }
                setProjectSaveMsg("Saved project details.");
              }}
            >
              Save project details
            </Button>
          </SubPanel>
        </SectionCard>

        <Accordion type="single" collapsible defaultValue="" className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
          <AccordionItem value="report" className="border-b-0 px-0">
            <AccordionTrigger className="w-full px-6 py-4 bg-muted/40 hover:bg-muted/60 transition-colors [&[data-state=open]]:bg-muted/60 rounded-t-xl data-[state=open]:rounded-b-none">
              <span className="flex flex-col items-start text-left gap-0.5">
                <span className="font-semibold text-lg">Report Customisation</span>
                <span className="text-sm font-normal text-muted-foreground">
                  Report: {[reportTitle.trim() && "title set", clientLogoUrl && "logo set"].filter(Boolean).join(" / ") || "not configured"}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
          <div className="px-6 pb-6">
            {saveProjectError ? (
              <Notice type="error" title="Error" message={saveProjectError} className="mb-4" />
            ) : null}
            {saveProjectMsg ? (
              <Notice type="success" title="Success" message={saveProjectMsg} className="mb-4" />
            ) : null}
            <SubPanel className="bg-muted/30 space-y-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Client name</Label>
              <Input
                value={projectClientName}
                onChange={(e) => setProjectClientName(e.target.value)}
              />
            </div>

            <div className="grid gap-3">
              <Label>Client logo (optional)</Label>

              {clientLogoUrl ? (
                <div className="w-full rounded-lg border p-3 overflow-hidden">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 h-16 w-16 rounded-md border bg-white flex items-center justify-center overflow-hidden">
                      <img
                        src={clientLogoUrl}
                        alt="Client logo"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Current client logo</p>
                      <p className="text-xs text-muted-foreground break-all">{clientLogoUrl}</p>
                    </div>
                    <div className="shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!projectId) return;
                          setUploadingClientLogo(true);
                          try {
                            const { error } = await supabase
                              .from("projects")
                              .update({ client_logo_url: null })
                              .eq("id", projectId);
                            if (error) {
                              setSaveProjectError(error.message);
                            } else {
                              setClientLogoUrl("");
                              setSaveProjectMsg("Client logo removed.");
                            }
                          } catch (error: any) {
                            setSaveProjectError(error?.message ?? "Failed to remove logo");
                          } finally {
                            setUploadingClientLogo(false);
                          }
                        }}
                        disabled={uploadingClientLogo}
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
                  <p className="text-sm text-muted-foreground mb-3">No client logo uploaded yet</p>
                </div>
              )}

              {uploadingClientLogo && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Uploading logo...</span>
                    <span className="font-medium">{clientLogoUploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${clientLogoUploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && projectId) {
                      handleClientLogoUpload(f);
                    }
                  }}
                  disabled={uploadingClientLogo}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = (e) => {
                      const f = (e.target as HTMLInputElement).files?.[0];
                      if (f && projectId) {
                        handleClientLogoUpload(f);
                      }
                    };
                    input.click();
                  }}
                  disabled={uploadingClientLogo}
                >
                  <UploadIcon className="size-4" />
                  Choose File
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Supported formats: PNG, JPEG, SVG. Maximum file size recommended: 2MB.
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Report title (optional)</Label>
              <Input
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                placeholder="Leave blank to use default SWMP title"
              />
            </div>

            <div className="grid gap-2">
              <Label>Footer / disclaimer override (optional)</Label>
              <Textarea
                value={reportFooter}
                onChange={(e) => setReportFooter(e.target.value)}
                rows={3}
              />
            </div>

            <SubPanel className="mt-4 shadow-sm">
              <Button
                type="button"
                variant="primary"
                size="default"
                className="w-full"
                onClick={async () => {
                  setSaveProjectMsg(null);
                  setSaveProjectError(null);

                  if (!projectId) {
                    setSaveProjectError("Missing project id.");
                    return;
                  }

                  const { error } = await supabase
                    .from("projects")
                    .update({
                      client_name: projectClientName || null,
                      client_logo_url: clientLogoUrl || null,
                      report_title: reportTitle || null,
                      report_footer_override: reportFooter || null,
                    })
                    .eq("id", projectId);

                  if (error) {
                    setSaveProjectError(error.message);
                    return;
                  }
                  setSaveProjectMsg("Saved report settings.");
                }}
              >
                Save report settings
              </Button>
            </SubPanel>
          </div>
          </SubPanel>
          </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <SectionCard title="Plan Settings" description="Configure waste streams, constraints, and monitoring.">
          <form onSubmit={handleSaveInputs} className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Sorting level</Label>
                <Select
                  value={sortingLevel}
                  onValueChange={(v) => {
                    const level = v as (typeof SORTING_LEVELS)[number];
                    setSortingLevel(level);
                    if (targetDiversion === 0) {
                      setTargetDiversion(SORTING_LEVEL_TARGET[level] ?? 60);
                    }
                  }}
                  disabled={saveLoading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORTING_LEVELS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Target diversion (%)</Label>
                <div className="flex items-end gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={targetDiversion}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        setTargetDiversion(0);
                        return;
                      }
                      const n = Math.round(parseFloat(raw));
                      if (Number.isNaN(n)) return;
                      setTargetDiversion(Math.min(100, Math.max(0, n)));
                    }}
                    disabled={saveLoading}
                    className="flex-1 min-w-0"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    disabled={saveLoading}
                    onClick={() => setTargetDiversion(SORTING_LEVEL_TARGET[sortingLevel] ?? 60)}
                    className="transition-colors hover:bg-muted/80"
                  >
                    Apply template defaults
                  </Button>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            <div>
              <Label className="mb-3 block font-semibold">Site constraints</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {CONSTRAINTS.map((c) => (
                  <div key={c} className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedConstraints.includes(c)}
                      onCheckedChange={() =>
                        toggleInList(c, selectedConstraints, setSelectedConstraints)
                      }
                      disabled={saveLoading}
                    />
                    <Label className="font-normal">{c}</Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="my-4" />

            <div>
              <Label className="mb-3 block text-lg font-semibold">Waste Streams Anticipated</Label>

              {selectedWasteStreams.length > 0 &&
                effectiveProjectType &&
                PROJECT_TYPE_WASTE_STREAMS[effectiveProjectType] != null && (
                  <p className="text-sm text-muted-foreground mb-2">
                    Template available — click Apply template to set default waste streams for this project type.
                  </p>
                )}

              <div className="flex flex-wrap gap-2 items-center mb-4">
                <Input
                  value={wasteStreamSearch}
                  onChange={(e) => setWasteStreamSearch(e.target.value)}
                  placeholder="Search streams…"
                  disabled={saveLoading}
                  className="flex-1 min-w-[240px]"
                />

                {effectiveProjectType && PROJECT_TYPE_WASTE_STREAMS[effectiveProjectType] != null && (
                  <Button
                    type="button"
                    variant="outline"
                    size="default"
                    disabled={saveLoading}
                    onClick={() =>
                      setSelectedWasteStreams(getWasteStreamsForProjectType(effectiveProjectType))
                    }
                    className="transition-colors hover:bg-muted/80"
                  >
                    Apply template
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  disabled={saveLoading}
                  onClick={() => {
                    setSelectedWasteStreams((prev) => {
                      const set = new Set(prev);
                      for (const s of COMMON_STREAM_SET) set.add(s);
                      return Array.from(set);
                    });
                  }}
                  className="transition-colors hover:bg-muted/80"
                >
                  Add common set
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  disabled={saveLoading}
                  onClick={() => setSelectedWasteStreams([])}
                  className="transition-colors hover:bg-muted/80"
                >
                  Clear
                </Button>
              </div>

              {selectedWasteStreams.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedWasteStreams.map((s) => (
                    <Badge
                      key={s}
                      variant="secondary"
                      className="flex items-center gap-2 px-3 py-1.5 bg-muted border border-border rounded-full"
                    >
                      <span>{s}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedWasteStreams((prev) => prev.filter((x) => x !== s));
                        }}
                        className="ml-1 h-5 w-5 rounded-full p-0"
                        aria-label={`Remove ${s}`}
                        title="Remove"
                      >
                        <XIcon className="size-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {WASTE_STREAM_LIBRARY.filter((w) =>
                  w.toLowerCase().includes(wasteStreamSearch.trim().toLowerCase())
                ).map((w) => (
                  <div key={w} className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedWasteStreams.includes(w)}
                      onCheckedChange={() =>
                        toggleInList(w, selectedWasteStreams, setSelectedWasteStreams)
                      }
                      disabled={saveLoading}
                    />
                    <Label className="font-normal">{w}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <Label className="mb-3 block font-semibold">Waste stream plans (detailed)</Label>
              <p className="text-sm text-muted-foreground mb-4">
                One plan card per selected stream. Partner defaults to the Waste contractor unless you override it.
              </p>

              {selectedWasteStreams.length > 1 && (
                <div className="flex flex-wrap gap-2 items-center mb-4">
                  <Label className="text-sm">Copy from</Label>
                  <Select value={copyFromStream} onValueChange={setCopyFromStream}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedWasteStreams.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const src = streamPlans.find((p) => p.category === copyFromStream);
                      if (!src) return;
                      setStreamPlans((prev) =>
                        prev.map((p) => ({
                          ...p,
                          outcomes: (src.outcomes.length ? src.outcomes : ["Recycle"]) as Outcome[],
                        }))
                      );
                    }}
                  >
                    Copy outcomes to all
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const src = streamPlans.find((p) => p.category === copyFromStream);
                      if (!src) return;
                      setStreamPlans((prev) => prev.map((p) => ({ ...p, pathway: src.pathway })));
                    }}
                  >
                    Copy pathway to all
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const src = streamPlans.find((p) => p.category === copyFromStream);
                      if (!src) return;
                      setStreamPlans((prev) =>
                        prev.map((p) => ({
                          ...p,
                          partner: src.partner ?? null,
                          partner_overridden: true,
                        }))
                      );
                    }}
                  >
                    Copy partner to all
                  </Button>
                </div>
              )}

              {streamPlanErr ? (
                <Notice type="error" title="Error" message={streamPlanErr} className="mb-4" />
              ) : null}
              {streamPlanMsg ? (
                <Notice type="success" title="Success" message={streamPlanMsg} className="mb-4" />
              ) : null}

              {selectedWasteStreams.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Select at least one waste stream above to configure plans.
                </div>
              ) : (
                <div className="grid gap-3">
                  {selectedWasteStreams.map((stream) => {
                    const plan = streamPlans.find(
                      (p) => p.category === stream
                    ) as WasteStreamPlan | undefined;
                    const safePlan: WasteStreamPlan =
                      plan ??
                      ({
                        category: stream,
                        sub_material: null,
                        outcomes: ["Recycle"],
                        partner: wasteContractor.trim() || null,
                        partner_overridden: false,
                        pathway: `Segregate ${stream} where practical and send to an approved recycler/processor.`,
                        notes: null,
                        estimated_qty: null,
                        unit: null,
                      } as WasteStreamPlan);

                    const expanded = expandedStreamPlans[stream] ?? false;
                    const summaryPartner =
                      (safePlan.partner ?? null) ?? (wasteContractor.trim() || "—");
                    const summaryOutcomes =
                      (safePlan.outcomes?.length ? safePlan.outcomes : ["Recycle"]).join(", ");

                    return (
                      <div
                        key={stream}
                        className="border rounded-lg bg-card p-3 space-y-3"
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            setExpandedStreamPlans((prev) => ({
                              ...prev,
                              [stream]: !(prev[stream] ?? false),
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setExpandedStreamPlans((prev) => ({
                                ...prev,
                                [stream]: !(prev[stream] ?? false),
                              }));
                            }
                          }}
                          className="w-full text-left flex items-center justify-between gap-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
                        >
                          <div className="flex-1">
                            <div className="font-semibold">
                              {stream}{" "}
                              <span className="text-muted-foreground font-normal">
                                — {summaryOutcomes} — {summaryPartner}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {expanded ? "Click to collapse" : "Click to expand"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {expanded ? (
                              <ChevronUpIcon className="size-4" />
                            ) : (
                              <ChevronDownIcon className="size-4" />
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedWasteStreams((prev) =>
                                  prev.filter((x) => x !== stream)
                                );
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>

                        {expanded && (
                          <div className="space-y-4 pt-3 border-t">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="grid gap-2">
                                <Label>Sub-material (optional)</Label>
                                <Input
                                  value={safePlan.sub_material ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setStreamPlans((prev) =>
                                      prev.map((p) =>
                                        p.category === stream
                                          ? { ...p, sub_material: v || null }
                                          : p
                                      )
                                    );
                                  }}
                                />
                              </div>

                              <div className="grid gap-2">
                                <Label>Intended outcomes (select one or more)</Label>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {OUTCOME_OPTIONS.map((o) => {
                                    const checked = (safePlan.outcomes ?? ["Recycle"]).includes(o);
                                    return (
                                      <div key={o} className="flex items-center gap-2">
                                        <Checkbox
                                          checked={checked}
                                          onCheckedChange={() => {
                                            setStreamPlans((prev) =>
                                              prev.map((p) => {
                                                if (p.category !== stream) return p;
                                                const current =
                                                  Array.isArray(p.outcomes) && p.outcomes.length > 0
                                                    ? p.outcomes
                                                    : (["Recycle"] as Outcome[]);
                                                const has = current.includes(o);
                                                const next = has
                                                  ? current.filter((x) => x !== o)
                                                  : [...current, o];
                                                return {
                                                  ...p,
                                                  outcomes:
                                                    next.length > 0
                                                      ? (next as Outcome[])
                                                      : (["Recycle"] as Outcome[]),
                                                };
                                              })
                                            );
                                          }}
                                          disabled={saveLoading}
                                        />
                                        <Label className="font-normal">{o}</Label>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            <div className="grid gap-2">
                              <Label>Partner / processor (optional)</Label>
                              <div className="flex gap-2">
                                <Input
                                  value={safePlan.partner ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    const trimmed = v.trim();
                                    const contractor = wasteContractor.trim();

                                    setStreamPlans((prev) =>
                                      prev.map((p) => {
                                        if (p.category !== stream) return p;

                                        // Clearing partner removes override and re-applies contractor
                                        if (!trimmed) {
                                          return {
                                            ...p,
                                            partner: contractor || null,
                                            partner_overridden: false,
                                          };
                                        }

                                        return {
                                          ...p,
                                          partner: v,
                                          partner_overridden: contractor
                                            ? trimmed !== contractor
                                            : true,
                                        };
                                      })
                                    );
                                  }}
                                  placeholder={
                                    wasteContractor
                                      ? "Defaults to waste contractor"
                                      : "e.g. Approved recycler"
                                  }
                                  disabled={saveLoading}
                                  className="flex-1"
                                />

                                {!!safePlan.partner_overridden && wasteContractor.trim() && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const contractor = wasteContractor.trim();
                                      setStreamPlans((prev) =>
                                        prev.map((p) =>
                                          p.category === stream
                                            ? {
                                                ...p,
                                                partner: contractor || null,
                                                partner_overridden: false,
                                              }
                                            : p
                                        )
                                      );
                                    }}
                                  >
                                    Use contractor
                                  </Button>
                                )}
                              </div>
                            </div>

                            <div className="grid gap-2">
                              <Label>Planned pathway / planned actions</Label>
                              <Textarea
                                value={safePlan.pathway}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setStreamPlans((prev) =>
                                    prev.map((p) =>
                                      p.category === stream ? { ...p, pathway: v } : p
                                    )
                                  );
                                }}
                                rows={2}
                                placeholder="e.g. Segregate where practical and send to approved recycler."
                                disabled={saveLoading}
                              />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="grid gap-2">
                                <Label>Estimated quantity (optional)</Label>
                                <Input
                                  type="number"
                                  value={safePlan.estimated_qty ?? ""}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setStreamPlans((prev) =>
                                      prev.map((p) =>
                                        p.category === stream
                                          ? { ...p, estimated_qty: v === "" ? null : Number(v) }
                                          : p
                                      )
                                    );
                                  }}
                                  disabled={saveLoading}
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label>Unit (optional)</Label>
                                <Select
                                  value={safePlan.unit ?? undefined}
                                  onValueChange={(v) => {
                                    setStreamPlans((prev) =>
                                      prev.map((p) =>
                                        p.category === stream
                                          ? { ...p, unit: (v === "none" ? null : (v || null)) as any }
                                          : p
                                      )
                                    );
                                  }}
                                  disabled={saveLoading}
                                >
                                  <SelectTrigger className="w-full bg-background">
                                    <SelectValue placeholder="—" />
                                  </SelectTrigger>
                                  <SelectContent className="z-50 bg-popover border border-border">
                                    <SelectItem value="none">—</SelectItem>
                                    <SelectItem value="kg">kg</SelectItem>
                                    <SelectItem value="t">t</SelectItem>
                                    <SelectItem value="m3">m3</SelectItem>
                                    <SelectItem value="skip">skip</SelectItem>
                                    <SelectItem value="load">load</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="grid gap-2">
                              <Label>Notes / methodology (optional)</Label>
                              <Textarea
                                value={safePlan.notes ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setStreamPlans((prev) =>
                                    prev.map((p) =>
                                      p.category === stream ? { ...p, notes: v || null } : p
                                    )
                                  );
                                }}
                                rows={2}
                                placeholder="Extra notes or methodology for this stream."
                                disabled={saveLoading}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <Label className="mb-3 block font-semibold">
                Regulated / hazard flags (if applicable)
              </Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={hazAsbestos}
                    onCheckedChange={() => setHazAsbestos((v) => !v)}
                    disabled={saveLoading}
                  />
                  <Label className="font-normal">Asbestos (ACM) possible / confirmed</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={hazLeadPaint}
                    onCheckedChange={() => setHazLeadPaint((v) => !v)}
                    disabled={saveLoading}
                  />
                  <Label className="font-normal">
                    Lead-based paint / hazardous coatings possible
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={hazContaminatedSoil}
                    onCheckedChange={() => setHazContaminatedSoil((v) => !v)}
                    disabled={saveLoading}
                  />
                  <Label className="font-normal">Contaminated soil/spoil possible</Label>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Waste contractor (if known)</Label>
                <Input
                  value={wasteContractor}
                  onChange={(e) => setWasteContractor(e.target.value)}
                  placeholder="Company name"
                  disabled={saveLoading}
                />
              </div>

              <div className="grid gap-2">
                <Label>Bin setup</Label>
                <Select
                  value={binPreference}
                  onValueChange={(v) => setBinPreference(v as any)}
                  disabled={saveLoading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Recommend">Recommend for me</SelectItem>
                    <SelectItem value="Manual">I will specify manually (later)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Accordion type="single" collapsible defaultValue="" className="w-full">
              <AccordionItem value="monitoring" className="border rounded-lg px-0 mb-2 overflow-hidden">
                <AccordionTrigger className="w-full px-4 py-4 bg-muted/40 hover:bg-muted/60 transition-colors [&[data-state=open]]:bg-muted/60 rounded-t-lg data-[state=open]:rounded-b-none">
                  <span className="flex flex-col items-start text-left gap-0.5">
                    <span className="font-semibold text-lg">Monitoring & Reporting</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {monitoringMethods.length ? `${monitoringMethods.join(", ")}` : "Not configured"}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
            <div className="space-y-4">
              <div className="grid gap-2 max-w-sm">
                <Label>Monitoring & reporting cadence</Label>
                <Select
                value={reportingCadence}
                onValueChange={(v) => setReportingCadence(v as any)}
                disabled={saveLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                  <SelectItem value="Fortnightly">Fortnightly</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
              </div>

              <SubPanel className="space-y-4">
                <Label className="font-semibold">Monitoring evidence</Label>
              <p className="text-sm text-muted-foreground">
              Choose how you’ll evidence waste movements and performance.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {MONITORING_METHOD_OPTIONS.map((m) => (
                  <div key={m} className="flex items-center gap-2">
                    <Checkbox
                      checked={monitoringMethods.includes(m)}
                      onCheckedChange={() =>
                        toggleInList(m, monitoringMethods, setMonitoringMethods)
                      }
                      disabled={saveLoading}
                    />
                    <Label className="font-normal">{m}</Label>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-input p-3 bg-card">
                  <Label className="font-normal">We use software to track waste</Label>
                  <Switch
                    checked={usesSoftware}
                    onCheckedChange={() => setUsesSoftware((v) => !v)}
                    disabled={saveLoading}
                    className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted border border-input data-[state=checked]:border-primary data-[state=unchecked]:border-border"
                  />
                </div>
                {usesSoftware && (
                  <Input
                    value={softwareName}
                    onChange={(e) => setSoftwareName(e.target.value)}
                    placeholder="Software name (e.g. WasteX / Excel )"
                    disabled={saveLoading}
                    className="mt-2"
                  />
                )}
              </div>

              <div className="grid gap-2">
                <Label>Dockets / receipts description</Label>
                <Textarea
                  value={docketsDescription}
                  onChange={(e) => setDocketsDescription(e.target.value)}
                  rows={3}
                  disabled={saveLoading}
                />
              </div>
            </SubPanel>
            </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="responsibilities" className="border rounded-lg px-0 mb-2 overflow-hidden">
                <AccordionTrigger className="w-full px-4 py-4 bg-muted/40 hover:bg-muted/60 transition-colors [&[data-state=open]]:bg-muted/60 rounded-t-lg data-[state=open]:rounded-b-none">
                  <span className="flex flex-col items-start text-left gap-0.5">
                    <span className="font-semibold text-lg">Responsibilities</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {3 + additionalResponsibilities.length} people
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
            <SubPanel className="space-y-4 bg-muted/30">
              <Label className="font-semibold block">Responsibilities (editable)</Label>
              <p className="text-sm text-muted-foreground">
                Edit roles, parties, and responsibility text. These appear in the generated SWMP.
              </p>
              {responsibilities.map((r, idx) => (
                <SubPanel key={idx} className="space-y-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Role</Label>
                      <Input
                        value={r.role}
                        onChange={(e) => {
                          const v = e.target.value;
                          setResponsibilities((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, role: v } : p))
                          );
                        }}
                        placeholder="e.g. SWMP Owner"
                        disabled={saveLoading}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Party / name</Label>
                      <Input
                        value={r.party}
                        onChange={(e) => {
                          const v = e.target.value;
                          setResponsibilities((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, party: v } : p))
                          );
                        }}
                        placeholder="e.g. Main Contractor"
                        disabled={saveLoading}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Responsibilities (one per line)</Label>
                    <Textarea
                      value={r.responsibilities.join("\n")}
                      onChange={(e) => {
                        const lines = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
                        setResponsibilities((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, responsibilities: lines } : p))
                        );
                      }}
                      rows={3}
                      placeholder="Maintain SWMP\nCoordinate waste streams"
                      disabled={saveLoading}
                    />
                  </div>
                </SubPanel>
              ))}
              <SubPanel className="space-y-4 mt-4">
                <Label className="font-semibold block">Additional people</Label>
                <p className="text-sm text-muted-foreground">
                  Add any extra roles (name, role, optional contact, responsibilities).
                </p>
                {additionalResponsibilities.map((a, idx) => (
                  <div key={idx} className="border rounded-lg p-4 bg-muted/30 space-y-3">
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setAdditionalResponsibilities((prev) => prev.filter((_, i) => i !== idx))
                        }
                        disabled={saveLoading}
                        className="text-destructive hover:text-destructive"
                      >
                        <XIcon className="size-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Name</Label>
                        <Input
                          value={a.name}
                          onChange={(e) =>
                            setAdditionalResponsibilities((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p))
                            )
                          }
                          placeholder="Full name"
                          disabled={saveLoading}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Role</Label>
                        <Input
                          value={a.role}
                          onChange={(e) =>
                            setAdditionalResponsibilities((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, role: e.target.value } : p))
                            )
                          }
                          placeholder="e.g. Site foreman"
                          disabled={saveLoading}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Email (optional)</Label>
                        <Input
                          type="email"
                          value={a.email ?? ""}
                          onChange={(e) =>
                            setAdditionalResponsibilities((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, email: e.target.value || undefined } : p))
                            )
                          }
                          placeholder="email@example.com"
                          disabled={saveLoading}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Phone (optional)</Label>
                        <Input
                          value={a.phone ?? ""}
                          onChange={(e) =>
                            setAdditionalResponsibilities((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, phone: e.target.value || undefined } : p))
                            )
                          }
                          placeholder=""
                          disabled={saveLoading}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Responsibilities</Label>
                      <Textarea
                        value={a.responsibilities}
                        onChange={(e) =>
                          setAdditionalResponsibilities((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, responsibilities: e.target.value } : p))
                          )
                        }
                        rows={2}
                        placeholder="Duties for this role"
                        disabled={saveLoading}
                      />
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setAdditionalResponsibilities((prev) => [...prev, { name: "", role: "", responsibilities: "" }])
                  }
                  disabled={saveLoading}
                >
                  Add person
                </Button>
            </SubPanel>
            </SubPanel>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="notes" className="border rounded-lg px-0 mb-2 overflow-hidden">
                <AccordionTrigger className="w-full px-4 py-4 bg-muted/40 hover:bg-muted/60 transition-colors [&[data-state=open]]:bg-muted/60 rounded-t-lg data-[state=open]:rounded-b-none">
                  <span className="flex flex-col items-start text-left gap-0.5">
                    <span className="font-semibold text-lg">Notes / Additional Context</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {notes.trim() ? "Set" : "Not set"}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
            <SubPanel>
              <div className="grid gap-2">
                <Label>Additional notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything site-specific that should be reflected in the SWMP."
                  disabled={saveLoading}
                  rows={4}
                />
              </div>
            </SubPanel>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <SubPanel className="shadow-sm space-y-3 border-muted-foreground/15">
              <Button type="submit" variant="primary" size="default" disabled={saveLoading || !requiredOk} className="w-full">
                {saveLoading ? "Saving…" : "Save Inputs"}
              </Button>

              {saveError ? (
                <Notice type="error" title="Error" message={saveError} />
              ) : null}

              {saveMessage ? (
                <Notice type="success" title="Success" message={saveMessage} />
              ) : null}
            </SubPanel>
          </form>
        </SectionCard>

        <SectionCard
          title="Generate SWMP"
          description="Generate the final Site Waste Management Plan document."
        >
          <SubPanel className="shadow-sm border-muted-foreground/15">
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={handleGenerate}
              disabled={!requiredOk || saveLoading || isGenerating}
              className="w-full"
            >
              {isGenerating ? "Generating…" : "Generate SWMP"}
            </Button>
          </SubPanel>
        </SectionCard>

        <Dialog open={isGenerating} onOpenChange={() => {}}>
          <DialogContent showCloseButton={false} className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Generating SWMP</DialogTitle>
              <DialogDescription>
                Please wait, this can take up to ~30 seconds.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center py-4">
              <Loader2Icon className="size-8 animate-spin text-primary" />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}