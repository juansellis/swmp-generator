"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useProjectContext, PROJECT_SELECT_FIELDS } from "../project-context";

import { AppShell } from "@/components/app-shell";
import { SubPanel } from "@/components/form-section";
import { ProjectHeader } from "@/components/project-header";
import { InputsPageHeader } from "@/components/inputs/inputs-page-header";
import { ProjectSummaryStrip } from "@/components/inputs/project-summary-strip";
import { StreamRow } from "@/components/inputs/stream-row";
import { WasteStreamSelector } from "@/components/inputs/waste-stream-selector";
import { Notice } from "@/components/notice";
import { InputsSectionCard, type StepStatusBadge } from "@/components/inputs/section-card";
import { CollapsibleSectionCard } from "@/components/inputs/collapsible-section-card";
import { GuidanceBanner } from "@/components/inputs/guidance-banner";
import { FieldGroup } from "@/components/inputs/field-group";
import { BuilderHeader } from "@/components/inputs/builder-header";
import { TextareaFieldWrapper } from "@/components/inputs/textarea-field-wrapper";
import { SelectableOptionCard } from "@/components/inputs/selectable-option-card";
import { RoleCard } from "@/components/inputs/role-card";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AddressPicker, type AddressPickerValue } from "@/components/address-picker";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  XIcon,
  UploadIcon,
  LayoutDashboard,
  Users,
  Building2,
  Recycle,
  FileInput,
  ClipboardList,
  FileText,
  Receipt,
  Camera,
  CalendarDays,
  MessageSquare,
  Trash2,
  Signpost,
  ShieldAlert,
  Package,
  ClipboardCheck,
} from "lucide-react";


type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  site_address?: string | null;
  site_place_id?: string | null;
  site_lat?: number | null;
  site_lng?: number | null;
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
  primary_waste_contractor_partner_id?: string | null;
};

/** Coerce value to a valid UUID or null for DB (never send empty string). */
function toUuidOrNull(value: string | null | undefined): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(s) ? s : null;
}

/** Coerce to number or null for lat/lng (DB may return string). */
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** Whitelist of project columns allowed for update (project details save). */
const PROJECT_UPDATE_KEYS = [
  "site_address",
  "site_place_id",
  "site_lat",
  "site_lng",
  "address",
  "region",
  "project_type",
  "start_date",
  "client_name",
  "main_contractor",
  "swmp_owner",
  "primary_waste_contractor_partner_id",
] as const;

/** Columns to select after project update so UI state can be set from DB response (no revert). */
const PROJECT_SELECT_AFTER_UPDATE =
  "id, site_address, site_place_id, site_lat, site_lng, address, region, project_type, start_date, client_name, main_contractor, swmp_owner, primary_waste_contractor_partner_id";

/** Sorting level → default target diversion. Only applied when target is 0 or user clicks "Apply template defaults". */
const SORTING_LEVEL_TARGET: Record<(typeof SORTING_LEVELS)[number], number> = {
  Basic: 40,
  Moderate: 60,
  High: 80,
};

/** Fallback when /api/catalog/waste-streams is unavailable. Keep keys (names) identical to DB seed. */
const FALLBACK_WASTE_STREAM_LIBRARY = [
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
  "Asphalt / roading material",
  "Concrete (reinforced)",
  "Concrete (unreinforced)",
  "Masonry / bricks",
  "Roofing materials",
  "Green waste / vegetation",
  "Hazardous waste (general)",
  "Contaminated soil",
  "Cleanfill soil",
  "Packaging (mixed)",
  "PVC pipes / services",
  "HDPE pipes / services",
];

/** Project type → default waste stream names (filtered by available library in component). */
const PROJECT_TYPE_DEFAULT_STREAMS: Record<string, string[]> = {
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
  ],
  "Civil works / earthworks": [
    "Concrete / masonry",
    "Soil / spoil (cleanfill if verified)",
    "Soft plastics (wrap/strapping)",
    "Metals",
  ],
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
  ],
  "Demolition / strip-out (commercial)": [
    "Concrete / masonry",
    "Metals",
    "Timber (untreated)",
    "Timber (treated)",
    "Plasterboard / GIB",
    "Glass",
    "Mixed C&D",
  ],
  "Commercial Build": [
    "Mixed C&D",
    "Timber (untreated)",
    "Timber (treated)",
    "Plasterboard / GIB",
    "Metals",
    "Cardboard",
    "Soft plastics (wrap/strapping)",
    "Hard plastics",
    "Insulation",
    "Concrete / masonry",
    "Carpet / carpet tiles",
    "E-waste (cables/lighting/appliances)",
    "Glass",
  ],
};

/** Build default plan for a stream when applying project type template (quantity left empty). */
function buildDefaultPlanForStream(stream: string): WasteStreamPlanInput {
  const defaultUnit = getDefaultUnitForStreamLabel(stream);
  const defaultThickness = getDefaultThicknessForStreamLabel(stream);
  return {
    category: stream,
    sub_material: null,
    intended_outcomes: getDefaultIntendedOutcomesForStream(stream),
    destination_mode: "facility",
    partner_id: null,
    facility_id: null,
    destination_override: null,
    custom_destination_name: null,
    custom_destination_address: null,
    custom_destination_place_id: null,
    custom_destination_lat: null,
    custom_destination_lng: null,
    partner: null,
    partner_overridden: false,
    pathway: `Segregate ${stream} where practical and send to an approved recycler/processor.`,
    notes: null,
    estimated_qty: null,
    unit: defaultUnit,
    density_kg_m3: null,
    thickness_m: defaultThickness ?? null,
    generated_by: null,
    on_site_management: null,
    destination: null,
    distance_km: null,
    duration_min: null,
    waste_contractor_partner_id: null,
    handling_mode: "mixed",
  };
}

/** Alias for UI; plan shape is WasteStreamPlanInput from model. */
type WasteStreamPlan = WasteStreamPlanInput;

const MONITORING_METHOD_OPTIONS = [
  "Dockets",
  "Invoices/receipts",
  "Photos",
  "Monthly reporting",
  "Toolbox talks",
] as const;

const DEFAULT_RESPONSIBILITIES: ResponsibilityInput[] = [
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
import {
  defaultSwmpInputs,
  normalizeSwmpInputs,
  validateSwmpInputs,
  SWMP_INPUTS_JSON_COLUMN,
} from "@/lib/swmp/schema";
import {
  getDefaultUnitForStream,
  getDefaultIntendedOutcomesForStream,
  PLAN_UNIT_OPTIONS,
  INTENDED_OUTCOME_OPTIONS,
  SORTING_LEVELS,
  DEFAULT_DOCKETS_DESCRIPTION,
  DEFAULT_SITE_CONTROLS,
  type WasteStreamPlanInput,
  type ResponsibilityInput,
  type AdditionalResponsibilityInput,
  type SiteControlsInput,
  type PlanUnit,
} from "@/lib/swmp/model";
import { computeWasteStreamCompletion, hasDestinationSet, hasDisposalSet } from "@/lib/swmp/streamCompletion";
import {
  getDefaultUnitForStreamLabel,
  getDefaultThicknessForStreamLabel,
  getDensityForStreamLabel,
  computeDiversion,
  planManualQtyToTonnes,
} from "@/lib/wasteStreamDefaults";
import type { Partner } from "@/lib/partners/types";
import type { Facility } from "@/lib/facilities/types";
import { fetchProjectStatusData } from "@/lib/projectStatus";
import type { ProjectStatusData } from "@/lib/projectStatus";
import { getTemplatePack, applyTemplateDefaults } from "@/lib/swmpTemplates";
import {
  computeBuilderProgress,
  countCompleteSteps,
  STEP_SECTION_IDS,
  type BuilderProgressInput,
  type BuilderStepId,
} from "@/lib/swmpBuilder";
import { BuilderProgressRail } from "@/components/inputs/builder-progress-rail";
import { SmartHint } from "@/components/smart-hint";
import { InfoTip } from "@/components/inputs/info-tip";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_STATUS: ProjectStatusData = {
  inputs_complete: false,
  forecasting_started: false,
  outputs_generated: false,
};

const SECTION_ORDER = [
  "project-overview",
  "primary-waste-contractor",
  "site-and-facilities",
  "waste-streams",
  "resource-inputs",
  "monitoring-site-controls",
  "compliance-notes",
] as const;

export default function ProjectInputsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const projectId = params?.id;
  const projectContext = useProjectContext();

  const [project, setProject] = useState<ProjectRow | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [pageError, setPageError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] = useState<ProjectStatusData>(DEFAULT_STATUS);
  

  // Input state
  const [clientLogoUrl, setClientLogoUrl] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [reportFooter, setReportFooter] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [siteAddressValidated, setSiteAddressValidated] = useState<AddressPickerValue | null>(null);
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
  const [primaryWasteContractorPartnerId, setPrimaryWasteContractorPartnerId] = useState<string | null>(null);

  const [monitoringMethods, setMonitoringMethods] = useState<string[]>(["Dockets"]);
  const [usesSoftware, setUsesSoftware] = useState(false);
  const [softwareName, setSoftwareName] = useState("");
  const [docketsDescription, setDocketsDescription] = useState(DEFAULT_DOCKETS_DESCRIPTION);
  const [siteControls, setSiteControls] = useState<SiteControlsInput>({ ...DEFAULT_SITE_CONTROLS });

  const [projectSaveMsg, setProjectSaveMsg] = useState<string | null>(null);
  const [projectSaveErr, setProjectSaveErr] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Waste streams: canonical list from DB (fallback to constant if API unavailable)
  const [wasteStreamLibrary, setWasteStreamLibrary] = useState<string[]>(FALLBACK_WASTE_STREAM_LIBRARY);
  const wasteStreamSet = useMemo(() => new Set(wasteStreamLibrary), [wasteStreamLibrary]);
  const getWasteStreamsForProjectType = useCallback(
    (projectType: string): string[] => {
      const mapped = PROJECT_TYPE_DEFAULT_STREAMS[projectType];
      if (mapped?.length) return mapped.filter((s) => wasteStreamSet.has(s));
      return ["Mixed C&D"].filter((s) => wasteStreamSet.has(s)).length ? ["Mixed C&D"] : wasteStreamLibrary.slice(0, 1);
    },
    [wasteStreamSet, wasteStreamLibrary]
  );

  // Catalog: DB-driven partners and facilities (replaces preset getPartners / getFacilitiesForStream)
  const [catalogPartners, setCatalogPartners] = useState<Partner[]>([]);
  const [catalogPartnersLoading, setCatalogPartnersLoading] = useState(true);
  const [facilitiesByPartner, setFacilitiesByPartner] = useState<Record<string, Facility[]>>({});
  const [facilitiesLoadingByPartner, setFacilitiesLoadingByPartner] = useState<Record<string, boolean>>({});

  // Fetch canonical waste streams from DB (used for stream list and project-type defaults)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/catalog/waste-streams", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.resolve(null)))
      .then((body: { waste_streams?: { name: string }[] } | null) => {
        if (cancelled || !body?.waste_streams?.length) return;
        setWasteStreamLibrary(body.waste_streams.map((w) => w.name));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const effectiveProjectType = projectType === "Other" ? projectTypeOther.trim() : projectType.trim();
  const requiredOk =
    siteAddress.trim().length > 0 &&
    !!siteAddressValidated?.place_id &&
    siteAddressValidated.lat != null &&
    siteAddressValidated.lng != null &&
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

  // Fetch catalog partners (DB-driven dropdown)
  useEffect(() => {
    let cancelled = false;
    if (process.env.NODE_ENV === "development") {
      console.time("[perf] streams/partners fetch");
    }
    setCatalogPartnersLoading(true);
    fetch("/api/catalog/partners", { credentials: "include" })
      .then((r) => r.json())
      .then((body: { partners?: Partner[] }) => {
        if (!cancelled && Array.isArray(body?.partners)) {
          setCatalogPartners(body.partners as Partner[]);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCatalogPartnersLoading(false);
        if (process.env.NODE_ENV === "development") {
          console.timeEnd("[perf] streams/partners fetch");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch facilities for a partner (and cache by partner_id). Do not filter by region so dropdown always has options.
  function loadFacilitiesForPartner(partnerId: string) {
    const key = String(partnerId).trim();
    if (!key) return;
    if (facilitiesLoadingByPartner[key]) return;
    setFacilitiesLoadingByPartner((prev) => ({ ...prev, [key]: true }));
    const params = new URLSearchParams({ partner_id: key });
    fetch(`/api/catalog/facilities?${params}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) {
          return r.json().then((body: { error?: string }) => {
            console.warn("[inputs] facilities response not ok", r.status, body?.error);
            return { facilities: [] as Facility[] };
          });
        }
        return r.json();
      })
      .then((body: { facilities?: Facility[]; error?: string }) => {
        const list = Array.isArray(body?.facilities) ? body.facilities : [];
        setFacilitiesByPartner((prev) => ({ ...prev, [key]: list as Facility[] }));
      })
      .catch((err) => {
        console.warn("[inputs] facilities fetch failed:", err);
        setFacilitiesByPartner((prev) => ({ ...prev, [key]: [] }));
      })
      .finally(() => {
        setFacilitiesLoadingByPartner((prev) => ({ ...prev, [key]: false }));
      });
  }

  // Effective partner per stream: stream.partner_id ?? project.primary_waste_contractor_partner_id ?? null
  const getEffectivePartnerId = useCallback(
    (plan: WasteStreamPlan | undefined, primaryId: string | null): string | null => {
      if (plan?.partner_id != null && String(plan.partner_id).trim() !== "") return String(plan.partner_id).trim();
      return primaryId ?? null;
    },
    []
  );

  // When a plan has partner_id or inherits primary, ensure we have facilities loaded for that partner
  const partnerIdsInPlans = useMemo(
    () =>
      Array.from(
        new Set(
          streamPlans
            .map((p) => getEffectivePartnerId(p, primaryWasteContractorPartnerId))
            .filter((id): id is string => id != null && id !== "")
        )
      ),
    [streamPlans, primaryWasteContractorPartnerId, getEffectivePartnerId]
  );
  useEffect(() => {
    partnerIdsInPlans.forEach((pid) => {
      const key = String(pid).trim();
      if (!key) return;
      if (!(key in facilitiesByPartner) && !facilitiesLoadingByPartner[key]) {
        loadFacilitiesForPartner(key);
      }
    });
    // Intentionally omit loadFacilitiesForPartner from deps to avoid stale closure; it only calls setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerIdsInPlans.join(","), facilitiesByPartner, facilitiesLoadingByPartner]);

  // Keep detailed stream plans in sync with the selected streams.
  // - One plan per selected stream (category === stream)
  // - Remove plans for unselected streams
  // - New plans get project-type template defaults for pathway, how generated, on-site management
  useEffect(() => {
    const template = getTemplatePack(effectiveProjectType);
    setStreamPlans((prev) => {
      const prevByCategory = new Map(prev.map((p) => [p.category, p] as const));

      const next = selectedWasteStreams.map((stream) => {
        const existing = prevByCategory.get(stream);
        if (existing) return existing;

        const defaults =
          template.wasteStreamDefaults?.[stream] ?? template.wasteStreamDefaults?.["*"];
        const defaultPathway = `Segregate ${stream} where practical and send to an approved recycler/processor.`;
        return {
          category: stream,
          sub_material: null,
          intended_outcomes: ["Recycle"],
          destination_mode: "facility" as const,
          partner_id: null,
          facility_id: null,
          destination_override: null,
          custom_destination_name: null,
          custom_destination_address: null,
          custom_destination_place_id: null,
          custom_destination_lat: null,
          custom_destination_lng: null,
          partner: null,
          partner_overridden: false,
          pathway: defaults?.planned_pathway ?? defaultPathway,
          notes: null,
          estimated_qty: null,
          unit: getDefaultUnitForStreamLabel(stream),
          density_kg_m3: null,
          thickness_m: getDefaultThicknessForStreamLabel(stream) ?? null,
          generated_by: defaults?.generation ?? null,
          on_site_management: defaults?.onsite_management ?? null,
          destination: null,
          distance_km: null,
          duration_min: null,
          waste_contractor_partner_id: null,
          handling_mode: "mixed" as const,
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
  }, [selectedWasteStreams, effectiveProjectType]);

  // Default selection for new/empty projects: ensure Mixed C&D is selected on first load.
  const didInitDefaultStreamsRef = useRef(false);
  const lastHydratedProjectIdRef = useRef<string | null>(null);
  /** When true, user has edited project-detail fields (e.g. Primary Waste Contractor); do not overwrite from project/context until save or projectId change. */
  const projectDetailsDirtyRef = useRef(false);
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

  // Effective primary contractor display name (from selected partner).
  const effectivePrimaryContractorName =
    primaryWasteContractorPartnerId != null
      ? catalogPartners.find((p) => p.id === primaryWasteContractorPartnerId)?.name ?? ""
      : wasteContractor.trim() || "";

  // Auto-populate custom destination from primary waste contractor name when partner is Other and not overridden.
  useEffect(() => {
    const contractor = effectivePrimaryContractorName || null;

    setStreamPlans((prev) => {
      let changed = false;
      const next = prev.map((p) => {
        const overridden = !!p.partner_overridden;
        if (overridden) return p;
        if (p.partner_id != null && p.partner_id !== "") return p;

        if ((p.destination_override ?? p.partner ?? null) === contractor) return p;
        changed = true;
        return { ...p, destination_override: contractor, partner: contractor };
      });
      return changed ? next : prev;
    });
  }, [effectivePrimaryContractorName]);

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

  const [responsibilities, setResponsibilities] = useState<ResponsibilityInput[]>(DEFAULT_RESPONSIBILITIES);
  const [additionalResponsibilities, setAdditionalResponsibilities] = useState<AdditionalResponsibilityInput[]>([]);

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  /** After "Apply recommended content", show which template was applied (for confirmation banner). */
  const [appliedTemplateLabel, setAppliedTemplateLabel] = useState<string | null>(null);
  /** Preserve scroll position across autosave so changing facility/destination doesn’t jump to top. */
  const scrollPositionBeforeSaveRef = useRef<number | null>(null);
  /** After "Add role", focus the new (top) additional role's name field. */
  const focusNewAdditionalRoleRef = useRef(false);

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
      let project: ProjectRow | null = null;

      // 1️⃣ Use project from layout context when available (e.g. after switching from Forecast tab) to avoid refetch
      if (projectContext?.project?.id === projectId) {
        project = projectContext.project as ProjectRow;
        setProject(project);
        // Do NOT setLoading(true) here: we already have the project (e.g. after autosave updated context).
        // Showing the loading skeleton would remount the form and jump scroll to top.
        const shouldHydrateProjectDetails =
          lastHydratedProjectIdRef.current !== projectId || !projectDetailsDirtyRef.current;
        if (shouldHydrateProjectDetails) {
          projectDetailsDirtyRef.current = false;
          setClientLogoUrl(project.client_logo_url ?? "");
          setReportTitle(project.report_title ?? "");
          setReportFooter(project.report_footer_override ?? "");
          setProjectClientName(project.client_name ?? "");
          const addr = (project.site_address ?? project.address ?? "") as string;
          setSiteAddress(addr);
          const pid = project.site_place_id ?? null;
          const lat = numOrNull(project.site_lat);
          const lng = numOrNull(project.site_lng);
          setSiteAddressValidated(
            pid && lat != null && lng != null
              ? { formatted_address: addr, place_id: String(pid), lat, lng }
              : null
          );
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
          setPrimaryWasteContractorPartnerId(toUuidOrNull((project as ProjectRow).primary_waste_contractor_partner_id) ?? null);
        }
      } else {
        setLoading(true);
        setPageError(null);

        const { data: projectData, error: projectErr } = await supabase
          .from("projects")
          .select(PROJECT_SELECT_FIELDS)
          .eq("id", projectId)
          .single();

        if (!mounted) return;

        if (projectErr || !projectData) {
          setPageError(projectErr?.message ?? "Project not found");
          setLoading(false);
          return;
        }

        project = projectData as ProjectRow;
        setProject(project);
        const shouldHydrateProjectDetails =
          lastHydratedProjectIdRef.current !== projectId || !projectDetailsDirtyRef.current;
        if (shouldHydrateProjectDetails) {
          projectDetailsDirtyRef.current = false;
          setClientLogoUrl(project.client_logo_url ?? "");
          setReportTitle(project.report_title ?? "");
          setReportFooter(project.report_footer_override ?? "");
          setProjectClientName(project.client_name ?? "");
          const addr = (project.site_address ?? project.address ?? "") as string;
          setSiteAddress(addr);
          const pid = project.site_place_id ?? null;
          const lat = numOrNull(project.site_lat);
          const lng = numOrNull(project.site_lng);
          setSiteAddressValidated(
            pid && lat != null && lng != null
              ? { formatted_address: addr, place_id: String(pid), lat, lng }
              : null
          );
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
          setPrimaryWasteContractorPartnerId(toUuidOrNull((project as ProjectRow).primary_waste_contractor_partner_id) ?? null);
        }
      }

      if (!mounted) return;
      if (!project) return;

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
        if (lastHydratedProjectIdRef.current === projectId) {
          setLoading(false);
          return;
        }
        lastHydratedProjectIdRef.current = projectId ?? null;
        const jsonCol = savedInputs[SWMP_INPUTS_JSON_COLUMN as keyof typeof savedInputs];
        const raw =
          jsonCol != null && typeof jsonCol === "object"
            ? { ...jsonCol, project_id: projectId }
            : { project_id: projectId };
        const normalized = normalizeSwmpInputs(raw);
        setSortingLevel(normalized.sorting_level);
        setTargetDiversion(normalized.target_diversion);
        setSelectedConstraints(normalized.constraints);
        setSelectedWasteStreams(normalized.waste_streams);
        setStreamPlans(normalized.waste_stream_plans);
        setHazAsbestos(normalized.hazards.asbestos);
        setHazLeadPaint(normalized.hazards.lead_paint);
        setHazContaminatedSoil(normalized.hazards.contaminated_soil);
        setWasteContractor(normalized.logistics.waste_contractor ?? "");
        setBinPreference(normalized.logistics.bin_preference);
        setReportingCadence(normalized.logistics.reporting_cadence);
        setMonitoringMethods(normalized.monitoring.methods);
        setUsesSoftware(normalized.monitoring.uses_software);
        setSoftwareName(normalized.monitoring.software_name ?? "");
        setDocketsDescription(normalized.monitoring.dockets_description);
        setSiteControls(normalized.site_controls);
        setNotes(normalized.notes ?? "");
        setResponsibilities(
          normalized.responsibilities.map((r, i) => ({
            ...r,
            party:
              i === 0 ? (project?.swmp_owner ?? r.party) : i === 1 ? (project?.main_contractor ?? r.party) : r.party,
          }))
        );
        setAdditionalResponsibilities(normalized.additional_responsibilities);
      } else if (project) {
        if (lastHydratedProjectIdRef.current === projectId) {
          setLoading(false);
          return;
        }
        lastHydratedProjectIdRef.current = projectId ?? null;
        const defaults = defaultSwmpInputs(projectId ?? undefined);
        const streams = getWasteStreamsForProjectType(project.project_type ?? "") || defaults.waste_streams;
        const basePlan = defaults.waste_stream_plans[0];
        const waste_stream_plans = streams.map((category) => ({ ...basePlan, category }));
        const currentInputs = {
          ...defaults,
          waste_streams: streams,
          waste_stream_plans,
          responsibilities: defaults.responsibilities.map((d, i) => ({
            ...d,
            party: i === 0 ? (project.swmp_owner ?? d.party) : i === 1 ? (project.main_contractor ?? d.party) : d.party,
          })),
        };
        const template = getTemplatePack(project.project_type ?? "");
        const merged = applyTemplateDefaults({ template, currentInputs });
        const mergedResp = merged.responsibilities.map((r, i) => ({
          ...r,
          party: i === 0 ? (project.swmp_owner ?? r.party) : i === 1 ? (project.main_contractor ?? r.party) : r.party,
        }));
        setSortingLevel(merged.sorting_level);
        setTargetDiversion(merged.target_diversion);
        setSelectedConstraints(merged.constraints);
        setSelectedWasteStreams(merged.waste_streams);
        setStreamPlans(merged.waste_stream_plans);
        setHazAsbestos(merged.hazards.asbestos);
        setHazLeadPaint(merged.hazards.lead_paint);
        setHazContaminatedSoil(merged.hazards.contaminated_soil);
        setWasteContractor(merged.logistics.waste_contractor ?? "");
        setBinPreference(merged.logistics.bin_preference);
        setReportingCadence(merged.logistics.reporting_cadence);
        setMonitoringMethods(merged.monitoring.methods);
        setUsesSoftware(merged.monitoring.uses_software);
        setSoftwareName(merged.monitoring.software_name ?? "");
        setDocketsDescription(merged.monitoring.dockets_description);
        setSiteControls(merged.site_controls);
        setNotes(merged.notes ?? "");
        setAdditionalResponsibilities(merged.additional_responsibilities);
        setResponsibilities(mergedResp);
        if (template) setAppliedTemplateLabel(template.displayLabel);
      }
  
      setLoading(false);

    })();
  
    return () => {
      mounted = false;
    };
  }, [projectId, projectContext?.project]);

  // Project status (inputs/forecasting/outputs) for header and overview
  useEffect(() => {
    if (!projectId || loading) return;
    let cancelled = false;
    fetchProjectStatusData(supabase, projectId).then((data) => {
      if (!cancelled) setProjectStatus(data);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, loading]);

  // Unallocated forecast items count (for diversion summary note)
  const [unallocatedForecastCount, setUnallocatedForecastCount] = useState<number>(0);
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    fetch(`/api/projects/${projectId}/forecast-items`, { credentials: "include" })
      .then((r) => r.json())
      .then((body: { items?: { waste_stream_key?: string | null }[] }) => {
        if (cancelled) return;
        const items = Array.isArray(body?.items) ? body.items : [];
        const count = items.filter((i) => !(i.waste_stream_key ?? "").trim()).length;
        setUnallocatedForecastCount(count);
      })
      .catch(() => { if (!cancelled) setUnallocatedForecastCount(0); });
    return () => { cancelled = true; };
  }, [projectId]);

  const updatePlan = useCallback((stream: string, patch: Partial<WasteStreamPlan>) => {
    setStreamPlans((prev) => prev.map((p) => (p.category === stream ? { ...p, ...patch } : p)));
  }, []);

  /** Apply template defaults for current project type. Only fills empty fields; never overwrites existing content. */
  const applyRecommendedContent = useCallback(
    (projectTypeOverride?: string) => {
      const effectiveType = (projectTypeOverride ?? effectiveProjectType ?? "").trim();
      const template = getTemplatePack(effectiveType);

      const defaults = defaultSwmpInputs(projectId ?? undefined);
      const currentInputs = {
        ...defaults,
        sorting_level: sortingLevel,
        target_diversion: Math.min(100, Math.max(0, Math.round(Number(targetDiversion)) || 0)),
        constraints: selectedConstraints,
        waste_streams: selectedWasteStreams,
        waste_stream_plans: streamPlans.map((p) => ({
          ...p,
          manual_qty_tonnes: planManualQtyToTonnes(p, p.category) ?? null,
        })),
        responsibilities: responsibilities.map((r) => ({
          role: r.role.trim() || "Role",
          party: r.party.trim() || "—",
          responsibilities: r.responsibilities?.filter(Boolean) ?? [],
        })),
        additional_responsibilities: additionalResponsibilities,
        logistics: {
          waste_contractor: null,
          bin_preference: binPreference,
          reporting_cadence: reportingCadence,
        },
        monitoring: {
          methods: monitoringMethods,
          uses_software: usesSoftware,
          software_name: softwareName || null,
          dockets_description: docketsDescription,
        },
        site_controls: siteControls,
        notes: notes.trim() || null,
      };
      const merged = applyTemplateDefaults({ template, currentInputs });

      setStreamPlans(merged.waste_stream_plans);
      setMonitoringMethods(merged.monitoring.methods);
      setUsesSoftware(merged.monitoring.uses_software);
      setSoftwareName(merged.monitoring.software_name ?? "");
      setDocketsDescription(merged.monitoring.dockets_description);
      setSiteControls(merged.site_controls);
      setResponsibilities(merged.responsibilities);
      setNotes(merged.notes ?? "");
      setAppliedTemplateLabel(template.displayLabel);
      toast.success("Suggested SWMP content applied based on project type");
    },
    [
      projectId,
      effectiveProjectType,
      sortingLevel,
      targetDiversion,
      selectedConstraints,
      selectedWasteStreams,
      streamPlans,
      responsibilities,
      additionalResponsibilities,
      binPreference,
      reportingCadence,
      monitoringMethods,
      usesSoftware,
      softwareName,
      docketsDescription,
      siteControls,
      notes,
    ]
  );

  // Guided builder progress (completion engine for Plan Builder)
  const builderProgressInput: BuilderProgressInput = useMemo(
    () => {
      const allStreamsHaveDestination =
        selectedWasteStreams.length > 0 &&
        selectedWasteStreams.every((stream) => {
          const plan = streamPlans.find((p) => p.category === stream);
          return hasDestinationSet(plan);
        });
      const allStreamsHaveDisposal =
        selectedWasteStreams.length > 0 &&
        selectedWasteStreams.every((stream) => {
          const plan = streamPlans.find((p) => p.category === stream);
          return hasDisposalSet(plan);
        });
      const hasPlannedTonnes = streamPlans.some(
        (p) => (p.manual_qty_tonnes ?? 0) + (p.forecast_qty ?? 0) > 0
      );
      return {
        projectName: project?.name ?? (projectContext?.project as { name?: string } | null)?.name ?? null,
        siteAddress: siteAddress?.trim() || null,
        siteAddressValidated: !!(siteAddressValidated?.place_id),
        region: region?.trim() || null,
        projectType: effectiveProjectType || null,
        startDate: startDate?.trim() || null,
        wasteStreamsCount: selectedWasteStreams.length,
        hasPlannedTonnes,
        allStreamsHaveDestination,
        allStreamsHaveDisposal,
        hasFacilityOrDestination: streamPlans.some((p) => hasDestinationSet(p)),
        primaryWasteContractorPartnerId: primaryWasteContractorPartnerId ?? null,
        constraints: selectedConstraints,
        siteControls,
        monitoring: {
          methods: monitoringMethods,
          dockets_description: docketsDescription,
          reportingCadence: reportingCadence ?? null,
          uses_software: usesSoftware,
        },
        hasNotesOrResponsibilities:
          (notes ?? "").trim() !== "" ||
          responsibilities.some(
            (r) =>
              (r.role ?? "").trim() !== "" ||
              (r.party ?? "").trim() !== "" ||
              (r.responsibilities?.length ?? 0) > 0
          ),
      };
    },
    [
      project?.name,
      projectContext?.project,
      siteAddress,
      siteAddressValidated?.place_id,
      region,
      effectiveProjectType,
      startDate,
      selectedWasteStreams,
      streamPlans,
      primaryWasteContractorPartnerId,
      selectedConstraints,
      siteControls,
      monitoringMethods,
      docketsDescription,
      reportingCadence,
      usesSoftware,
      notes,
      responsibilities,
    ]
  );
  const builderProgress = useMemo(
    () => computeBuilderProgress(builderProgressInput),
    [builderProgressInput]
  );
  const builderCompleteCount = countCompleteSteps(builderProgress);

  const [expandedSectionId, setExpandedSectionId] = useState<string>(SECTION_ORDER[0]);
  useEffect(() => {
    const next = builderProgress.find((p) => p.status === "recommendedNext");
    if (next) setExpandedSectionId(STEP_SECTION_IDS[next.stepId]);
  }, [builderProgress]);

  const getStepStatusBadge = useCallback(
    (sectionId: string): StepStatusBadge | undefined => {
      const stepId = (Object.entries(STEP_SECTION_IDS) as [BuilderStepId, string][]).find(
        ([, id]) => id === sectionId
      )?.[0];
      if (!stepId) return undefined;
      const step = builderProgress.find((p) => p.stepId === stepId);
      if (!step) return undefined;
      return step.status === "complete"
        ? "complete"
        : step.status === "recommendedNext"
          ? "attention"
          : "not_started";
    },
    [builderProgress]
  );

  const wasteStreamsGuidance = useMemo(() => {
    const count = builderProgressInput.wasteStreamsCount ?? 0;
    const hasTonnes = builderProgressInput.hasPlannedTonnes === true;
    const hasDest = builderProgressInput.allStreamsHaveDestination === true;
    const hasDisposal = builderProgressInput.allStreamsHaveDisposal === true;
    if (count === 0) return { nextStepLabel: "Add at least one waste stream", ctaLabel: "Add waste stream" };
    if (!hasTonnes) return { nextStepLabel: "Enter planned tonnes for at least one stream", ctaLabel: "Set tonnes" };
    if (!hasDisposal) return { nextStepLabel: "Set disposal method for each stream", ctaLabel: "Set disposal" };
    if (!hasDest) return { nextStepLabel: "Set destination/facility for each stream", ctaLabel: "Set destination" };
    return { nextStepLabel: "", ctaLabel: "" };
  }, [builderProgressInput]);

  const scrollToNextSection = useCallback((currentSectionId: string) => {
    const sectionOrder = [
      "project-overview",
      "primary-waste-contractor",
      "site-and-facilities",
      "waste-streams",
      "resource-inputs",
      "monitoring-site-controls",
      "compliance-notes",
    ];
    const idx = sectionOrder.indexOf(currentSectionId);
    const nextId = idx >= 0 && idx < sectionOrder.length - 1 ? sectionOrder[idx + 1] : null;
    if (nextId) {
      const el = document.getElementById(nextId);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 96;
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      }
    }
  }, []);

  // Optional: when destination is facility, facility_id is null, and exactly one facility for the effective partner accepts this stream, auto-select it (no overwrite of user-set facility).
  useEffect(() => {
    setStreamPlans((prev) => {
      let changed = false;
      const next = prev.map((plan) => {
        if (plan.destination_mode !== "facility" || (plan.facility_id != null && String(plan.facility_id).trim() !== ""))
          return plan;
        const ep = getEffectivePartnerId(plan, primaryWasteContractorPartnerId);
        if (!ep) return plan;
        const list = facilitiesByPartner[ep] ?? [];
        const accepts = (f: { accepted_streams?: string[] }) =>
          Array.isArray(f?.accepted_streams) && f.accepted_streams.includes(plan.category);
        const candidates = list.filter(accepts);
        if (candidates.length !== 1) return plan;
        changed = true;
        return { ...plan, facility_id: candidates[0].id };
      });
      return changed ? next : prev;
    });
  }, [streamPlans, facilitiesByPartner, primaryWasteContractorPartnerId, getEffectivePartnerId]);

  // Auto-save when destination or plan text (pathway, how generated, on-site management) changes.
  const destinationSignatureRef = useRef<string>("");
  const initialMountRef = useRef(true);
  useEffect(() => {
    const sig = JSON.stringify(
      streamPlans.map((p) => ({
        c: p.category,
        mode: p.destination_mode,
        fid: p.facility_id ?? "",
        addr: p.custom_destination_address ?? "",
        pid: p.custom_destination_place_id ?? "",
        pathway: p.pathway ?? "",
        generated_by: p.generated_by ?? "",
        on_site_management: p.on_site_management ?? "",
      }))
    );
    if (initialMountRef.current) {
      destinationSignatureRef.current = sig;
      initialMountRef.current = false;
      return;
    }
    if (sig === destinationSignatureRef.current) return;
    destinationSignatureRef.current = sig;
    const t = window.setTimeout(() => {
      handleSaveInputs({ preventDefault: () => {} } as React.FormEvent);
    }, 1500);
    return () => window.clearTimeout(t);
  }, [streamPlans]);

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

  // Readiness checks (non-blocking warnings) before generating
  const generationWarnings = useMemo(() => {
    const list: string[] = [];
    if (!siteAddress.trim()) list.push("Project: site address is missing.");
    if (!region.trim()) list.push("Project: region is missing.");
    if (!effectiveProjectType) list.push("Project: project type is missing.");
    if (!startDate.trim()) list.push("Project: start date is missing.");
    if (!clientName.trim()) list.push("Project: client name is missing.");
    if (!mainContractor.trim()) list.push("Project: main contractor is missing.");
    if (!swmpOwner.trim()) list.push("Project: SWMP owner is missing.");
    const planByCategory = new Map(streamPlans.map((p) => [p.category, p]));
    for (const stream of selectedWasteStreams) {
      const plan = planByCategory.get(stream);
      const outcomesSet = (plan?.intended_outcomes?.length ?? 0) > 0;
      const destinationSet =
        (plan?.destination_mode === "facility" && plan?.facility_id != null && plan.facility_id !== "") ||
        (plan?.destination_mode === "custom" &&
          ((plan?.custom_destination_address ?? "").trim() !== "" || (plan?.custom_destination_place_id ?? "").trim() !== "")) ||
        (plan?.facility_id != null && plan.facility_id !== "") ||
        ((plan?.destination_override ?? "").trim().length > 0) ||
        ((plan?.destination ?? "").trim().length > 0);
      const distanceProvided = plan?.distance_km != null && plan.distance_km >= 0;
      if (!outcomesSet) list.push(`“${stream}”: Select a disposal method.`);
      if (!destinationSet) list.push(`“${stream}”: destination not set (select facility or enter custom).`);
      if (!distanceProvided) list.push(`“${stream}”: distance (km) not provided (0 is OK).`);
    }
    return list;
  }, [
    siteAddress,
    region,
    effectiveProjectType,
    startDate,
    clientName,
    mainContractor,
    swmpOwner,
    selectedWasteStreams,
    streamPlans,
  ]);

  const diversionSummary = useMemo(
    () =>
      computeDiversion(
        selectedWasteStreams.map((stream) => {
          const plan = streamPlans.find((p) => p.category === stream);
          const manualTonnes = plan != null ? (plan.manual_qty_tonnes ?? planManualQtyToTonnes(plan, stream)) : null;
          const forecastTonnes =
            plan?.forecast_qty != null && Number.isFinite(plan.forecast_qty) && plan.forecast_qty >= 0
              ? Number(plan.forecast_qty)
              : null;
          return {
            category: stream,
            estimated_qty: plan?.estimated_qty ?? null,
            unit: plan?.unit ?? null,
            density_kg_m3: plan?.density_kg_m3 ?? null,
            thickness_m: plan?.thickness_m ?? null,
            intended_outcomes: plan?.intended_outcomes ?? ["Recycle"],
            manual_qty_tonnes: manualTonnes ?? undefined,
            forecast_qty_tonnes: forecastTonnes ?? undefined,
          };
        })
      ),
    [selectedWasteStreams, streamPlans]
  );

  async function handleGenerate() {
    setSaveError(null);
    setSaveMessage(null);

    if (!projectId) {
      setSaveError("Missing project id.");
      toast.error("Missing project");
      return;
    }

    if (!requiredOk) {
      setSaveError(
        "Please complete Project details (required) before saving inputs or generating the SWMP."
      );
      toast.error("Complete required fields first");
      return;
    }

    setIsGenerating(true);
    try {
      const saved = await handleSaveInputs({ preventDefault: () => {} } as React.FormEvent);
      if (!saved) {
        toast.error("Save inputs first, then generate report");
        return;
      }
      const res = await fetch("/api/generate-swmp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSaveError(data?.error ?? "Failed to generate SWMP");
        toast.error(data?.error ?? "Report generation failed");
        return;
      }

      toast.success("Report generated");
      router.push(`/projects/${projectId}/swmp`);
    } catch (e: any) {
      setSaveError(e?.message ?? "Failed to generate SWMP");
      toast.error(e?.message ?? "Report generation failed");
    } finally {
      setIsGenerating(false);
    }
  }


  /** Returns true if save completed successfully, false otherwise. Caller can await to ensure DB is updated before e.g. Generate SWMP. */
  async function handleSaveInputs(e: React.FormEvent): Promise<boolean> {
    e.preventDefault();
    setSaveError(null);
    setSaveMessage(null);

    if (!projectId) {
      setSaveError("Missing project id.");
      return false;
    }

    if (!requiredOk) {
      setSaveError(
        "Please complete Project details (required) before saving inputs or generating the SWMP."
      );
      return false;
    }

    if (selectedWasteStreams.length === 0) {
      setSaveError("Select at least one waste stream.");
      return false;
    }

    scrollPositionBeforeSaveRef.current = window.scrollY;
    setSaveLoading(true);

    try {
      const fromState = {
        sorting_level: sortingLevel,
        target_diversion: Math.min(100, Math.max(0, Math.round(Number(targetDiversion)) || 0)),
        constraints: selectedConstraints,
        waste_streams: selectedWasteStreams,
        hazards,
        waste_stream_plans: streamPlans.map((p) => {
          const manualTonnes =
            p.manual_qty_tonnes != null && Number.isFinite(p.manual_qty_tonnes) && p.manual_qty_tonnes >= 0
              ? p.manual_qty_tonnes
              : (planManualQtyToTonnes(p, p.category) ?? null);
          return {
            ...p,
            manual_qty_tonnes: manualTonnes,
            intended_outcomes: (p.intended_outcomes?.length ? [p.intended_outcomes[0]] : ["Recycle"]) as string[],
          };
        }),
        responsibilities: responsibilities.map((r) => {
          const list = r.responsibilities.filter(Boolean);
          return {
            role: r.role.trim() || "Role",
            party: r.party.trim() || "—",
            responsibilities: list.length ? list : ["—"],
          };
        }),
        additional_responsibilities: additionalResponsibilities
          .filter((a) => a.name.trim() || a.role.trim() || a.responsibilities.trim())
          .map((a) => ({
            name: a.name.trim(),
            role: a.role.trim(),
            email: a.email?.trim() || undefined,
            phone: a.phone?.trim() || undefined,
            responsibilities: a.responsibilities.trim(),
          })),
        logistics: {
          waste_contractor: null,
          bin_preference: binPreference,
          reporting_cadence: reportingCadence,
        },
        monitoring: {
          methods: monitoringMethods,
          uses_software: usesSoftware,
          software_name: softwareName || null,
          dockets_description: docketsDescription,
        },
        site_controls: siteControls,
        notes: notes.trim() || null,
      };
      const normalized = normalizeSwmpInputs({ ...fromState, project_id: projectId });

      const { error } = await supabase.from("swmp_inputs").insert({
        project_id: projectId,
        [SWMP_INPUTS_JSON_COLUMN]: normalized,
      });

      if (error) {
        setSaveError(error.message || "Failed to save inputs.");
        toast.error("Save failed");
        return false;
      }

      // Persist Primary Waste Contractor on project row (source of truth is projects.primary_waste_contractor_partner_id)
      const primaryPartnerId = toUuidOrNull(primaryWasteContractorPartnerId ?? null);
      const { error: projectUpdateError } = await supabase
        .from("projects")
        .update({ primary_waste_contractor_partner_id: primaryPartnerId })
        .eq("id", projectId);

      if (projectUpdateError) {
        setSaveError(projectUpdateError.message || "Inputs saved but Primary Waste Contractor could not be updated.");
        toast.error("Primary contractor could not be updated");
        return false;
      }

      if (project && projectContext?.project?.id === projectId) {
        const updatedProject = { ...project, primary_waste_contractor_partner_id: primaryPartnerId } as ProjectRow;
        setProject(updatedProject);
        projectContext.setProject(updatedProject);
      }

      // Recompute distance for each stream plan that has a destination (facility or custom).
      const plansWithDestination = streamPlans.filter((p) => {
        if (p.destination_mode === "custom") {
          return (
            (p.custom_destination_address != null && String(p.custom_destination_address).trim() !== "") ||
            (p.custom_destination_place_id != null && String(p.custom_destination_place_id).trim() !== "")
          );
        }
        return p.facility_id != null && String(p.facility_id).trim() !== "";
      });
      const recomputeResults = await Promise.allSettled(
        plansWithDestination.map((plan) =>
          fetch(`/api/projects/${projectId}/streams/${encodeURIComponent(plan.category)}/distance/recompute`, {
            method: "POST",
            credentials: "include",
          }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("Recompute failed"))))
        )
      );
      const byCategory = new Map(
        plansWithDestination.map((p, i) => {
          const result = recomputeResults[i];
          const data = result.status === "fulfilled" ? result.value : null;
          return [p.category, data] as const;
        })
      );
      setStreamPlans((prev) =>
        prev.map((p) => {
          const data = byCategory.get(p.category);
          if (!data) return p;
          return {
            ...p,
            distance_km: data.distance_km ?? p.distance_km,
            duration_min: data.duration_min ?? p.duration_min,
          };
        })
      );

      const nextStatus = await fetchProjectStatusData(supabase, projectId);
      setProjectStatus(nextStatus);
      setLastSavedAt(new Date());
      setSaveMessage("Inputs saved.");
      toast.success("Saved");
      if (pathname) router.replace(pathname, { scroll: false });
      return true;
    } finally {
      setSaveLoading(false);
    }
  }

  const saveState: "idle" | "saving" | "saved" | "error" = saveLoading
    ? "saving"
    : saveError
      ? "error"
      : saveMessage
        ? "saved"
        : "idle";

  // Restore scroll position after autosave completes so the page doesn’t jump to top (e.g. when changing facility).
  const prevSaveLoadingRef = useRef(saveLoading);
  useEffect(() => {
    if (prevSaveLoadingRef.current === true && saveLoading === false) {
      const y = scrollPositionBeforeSaveRef.current;
      scrollPositionBeforeSaveRef.current = null;
      if (y !== null && Number.isFinite(y)) {
        const restore = () => window.scrollTo(0, y);
        requestAnimationFrame(() => {
          requestAnimationFrame(restore);
        });
        const t1 = window.setTimeout(restore, 50);
        const t2 = window.setTimeout(restore, 150);
        return () => {
          window.clearTimeout(t1);
          window.clearTimeout(t2);
        };
      }
    }
    prevSaveLoadingRef.current = saveLoading;
  }, [saveLoading]);

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-6xl mx-auto px-4 space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-8 w-48" />
          </div>
          <Skeleton className="h-14 w-full rounded-xl" />
          <div className="flex gap-6">
            <aside className="hidden lg:block w-52 space-y-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-9 w-full rounded-md" />
              ))}
            </aside>
            <main className="flex-1 space-y-6 min-w-0">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-40 w-full rounded-xl" />
              ))}
            </main>
          </div>
        </div>
      </AppShell>
    );
  }

  if (pageError) {
    return (
      <AppShell>
        <div className="space-y-6">
          <ProjectHeader />
          <div className="max-w-6xl mx-auto px-4">
            <InputsPageHeader title="Inputs" saveState="idle" />
          </div>
          <Notice type="error" title="Error" message={pageError} className="max-w-6xl mx-auto px-4" />
        </div>
      </AppShell>
    );
  }

  const projectName = project?.name ?? projectContext?.project?.name ?? "Project";
  const facilitySummary =
    primaryWasteContractorPartnerId && catalogPartners.length > 0
      ? catalogPartners.find((p) => p.id === primaryWasteContractorPartnerId)?.name ?? null
      : null;

  return (
    <AppShell>
      <div className="space-y-6">
        <ProjectHeader />
        <div className="max-w-6xl mx-auto px-4">
          <InputsPageHeader
            breadcrumb={[
              { label: "Projects", href: "/projects" },
              { label: projectName, href: projectId ? `/projects/${projectId}` : undefined },
              { label: "Inputs" },
            ]}
            title="Inputs"
            saveState={saveState}
            lastSavedAt={lastSavedAt}
          />
          <ProjectSummaryStrip
            region={region || null}
            projectType={effectiveProjectType || null}
            mainContractor={mainContractor || null}
            facilitySummary={facilitySummary}
            totalEstimatedWasteTonnes={diversionSummary.totalTonnes > 0 ? diversionSummary.totalTonnes : null}
            className="mt-4"
          />
        </div>

        <div className="flex gap-6">
          <aside className="hidden lg:block w-52 shrink-0">
            <BuilderProgressRail
              progress={builderProgress}
              activeSectionId={expandedSectionId}
              onStepClick={(sectionId) => setExpandedSectionId(sectionId)}
            />
          </aside>
          <main className="min-w-0 flex-1">
            <div className="max-w-6xl mx-auto">
              {appliedTemplateLabel && (
                <div
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-950/40 mb-4"
                  role="status"
                  aria-live="polite"
                >
                  <span className="font-medium text-emerald-800 dark:text-emerald-200">
                    Applied defaults for: {appliedTemplateLabel}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100"
                    onClick={() => setExpandedSectionId("waste-streams")}
                  >
                    View changes
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 text-emerald-600 dark:text-emerald-400"
                    onClick={() => setAppliedTemplateLabel(null)}
                    aria-label="Dismiss"
                  >
                    Dismiss
                  </Button>
                </div>
              )}
              <form onSubmit={handleSaveInputs} className="space-y-3">
                <Accordion
                  type="single"
                  value={expandedSectionId}
                  onValueChange={(v) => v && setExpandedSectionId(v)}
                  collapsible={false}
                  className="space-y-3"
                >
                  {/* Step 1 — Project details */}
                  <CollapsibleSectionCard
                    id="project-overview"
                    icon={<LayoutDashboard className="size-5" />}
                    title="Project details"
                    description="Site, region, project type, dates, and key contacts."
                    whyMatters="Required for compliant SWMP and reporting."
                    accent="emerald"
                    variant="grouped"
                    stepStatusBadge={getStepStatusBadge("project-overview")}
                    checklist={[
                      "Project type and region selected",
                      "Site address validated (choose from suggestions)",
                      "Start date and client/contractor/SWMP owner filled",
                    ]}
                    guidance={
                      <GuidanceBanner
                        complete={getStepStatusBadge("project-overview") === "complete"}
                        nextStepLabel="Fill required fields (address, region, type, dates, contacts)"
                        helperText="Validated site address and key contacts are required for SWMP compliance."
                        ctaLabel="Continue to next step"
                        onCta={() => setExpandedSectionId("primary-waste-contractor")}
                      />
                    }
                    footer={
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            handleSaveInputs({ preventDefault: () => {} } as React.FormEvent);
                            setExpandedSectionId("primary-waste-contractor");
                          }}
                          disabled={saveLoading || !requiredOk}
                        >
                          Save & continue
                        </Button>
                        <span className="text-xs text-muted-foreground">You can come back and edit later.</span>
                      </>
                    }
                    completion={{
                      completed: [
                        siteAddress.trim(),
                        region.trim(),
                        effectiveProjectType,
                        startDate.trim(),
                        clientName.trim(),
                        mainContractor.trim(),
                        swmpOwner.trim(),
                      ].filter(Boolean).length,
                      total: 7,
                    }}
                  >
                    {!requiredOk && (
                      <SmartHint
                        message="Complete the required fields below to enable Save Inputs and Generate SWMP."
                        variant="warning"
                        className="mb-4"
                      />
                    )}
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

                    <FieldGroup gridClassName="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      <div className="space-y-2 md:col-span-2 xl:col-span-1">
                        <Label>Site address *</Label>
                        <AddressPicker
                          value={siteAddress}
                          onChange={(v) => {
                            setSiteAddressValidated(v);
                            setSiteAddress(v?.formatted_address ?? "");
                          }}
                          onInput={(v) => {
                            setSiteAddress(v);
                            if (!v.trim()) setSiteAddressValidated(null);
                          }}
                          placeholder="Search address…"
                          disabled={!!saveLoading}
                        />
                        <p className="text-xs text-muted-foreground">Choose from suggestions to validate.</p>
                      </div>
                      <div className="space-y-2 flex flex-wrap gap-4 md:gap-6 items-end">
                        <div className="space-y-2 min-w-[140px] flex-1">
                          <Label>Region *</Label>
                          <Input
                            value={region}
                            onChange={(e) => setRegion(e.target.value)}
                            placeholder="e.g. Auckland / Waikato"
                          />
                        </div>
                        <div className="space-y-2 min-w-[160px] flex-1">
                          <Label>Project type *</Label>
                          <Select
                            value={PROJECT_TYPE_OPTIONS.includes(projectType) ? projectType : "Other"}
                            onValueChange={(v) => {
                              setProjectType(v ?? "");
                              if (v !== "Other") setProjectTypeOther("");
                              if (v && v !== "Other") applyRecommendedContent(v);
                            }}
                            disabled={saveLoading}
                          >
                            <SelectTrigger className="w-full bg-background">
                              <SelectValue placeholder="Select type" />
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
                        <div className="space-y-2 min-w-[120px]">
                          <Label>Start date *</Label>
                          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-2 flex flex-wrap gap-4 md:gap-6 items-end md:col-span-3">
                        <div className="space-y-2 min-w-[160px] flex-1">
                          <Label>Client name *</Label>
                          <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
                        </div>
                        <div className="space-y-2 min-w-[160px] flex-1">
                          <Label>Main contractor *</Label>
                          <Input
                            value={mainContractor}
                            onChange={(e) => setMainContractor(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2 min-w-[160px] flex-1">
                          <Label>SWMP owner *</Label>
                          <Input
                            value={swmpOwner}
                            onChange={(e) => setSwmpOwner(e.target.value)}
                            placeholder="Person responsible for the SWMP"
                          />
                        </div>
                      </div>
                    </FieldGroup>

                <Accordion type="single" collapsible defaultValue="" className="w-full max-w-full overflow-hidden mt-6">
          <AccordionItem value="report" className="border border-border/50 rounded-lg px-0 mb-2 overflow-hidden">
            <AccordionTrigger className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-muted/40 px-4 py-3 hover:bg-muted/60 transition-colors [&>svg]:shrink-0">
              <span className="flex flex-col items-start text-left gap-0.5">
                <span className="text-sm font-semibold">Report Customisation</span>
                <span className="text-sm text-muted-foreground">
                  Report: {[reportTitle?.trim() && "title set", clientLogoUrl && "logo set"].filter(Boolean).join(" / ") || "not configured"}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="mt-2 px-1 space-y-6">
                {saveProjectError ? (
                  <Notice type="error" title="Error" message={saveProjectError} />
                ) : null}
                {saveProjectMsg ? (
                  <Notice type="success" title="Success" message={saveProjectMsg} />
                ) : null}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Client name</Label>
                      <Input
                        value={projectClientName}
                        onChange={(e) => setProjectClientName(e.target.value)}
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Report title (optional)</Label>
                      <Input
                        value={reportTitle}
                        onChange={(e) => setReportTitle(e.target.value)}
                        placeholder="Leave blank to use default SWMP title"
                        className="bg-background"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Client logo (optional)</Label>
                    <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
                        {clientLogoUrl ? (
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="shrink-0 h-20 w-20 rounded-lg border bg-white flex items-center justify-center overflow-hidden">
                              <img
                                src={clientLogoUrl}
                                alt="Client logo"
                                className="h-full w-full object-contain"
                              />
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="text-sm font-medium">Current client logo</p>
                              <p className="text-xs text-muted-foreground truncate">{clientLogoUrl}</p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground -ml-2"
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
                                Remove
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="border border-dashed border-border/40 rounded-lg p-6 text-center bg-background/60">
                            <UploadIcon className="size-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground mb-3">No client logo uploaded yet</p>
                            <div className="flex flex-wrap items-center justify-center gap-2">
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
                                className="max-w-[200px]"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
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
                                <UploadIcon className="size-4 mr-1" />
                                Choose file
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">PNG, JPEG, SVG. Max ~2MB.</p>
                          </div>
                        )}
                        {uploadingClientLogo && (
                          <div className="space-y-2 mt-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Uploading…</span>
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
                      </div>
                    </div>
                  </div>
                  <Accordion type="single" collapsible defaultValue="" className="w-full">
                    <AccordionItem value="advanced" className="border-0">
                      <AccordionTrigger className="py-2 text-sm font-medium text-muted-foreground hover:text-foreground [&>svg]:shrink-0">
                        Advanced
                      </AccordionTrigger>
                      <AccordionContent className="pb-0">
                        <TextareaFieldWrapper
                          label="Footer / disclaimer override (optional)"
                          value={reportFooter}
                          onChange={(e) => setReportFooter(e.target.value)}
                          rows={3}
                          maxWidth="max-w-3xl"
                        />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="default"
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
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

                <div className="mt-6">
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
                      const missing: string[] = [];
                      if (!siteAddress.trim()) missing.push("Site address");
                      if (!siteAddressValidated?.place_id || siteAddressValidated.lat == null || siteAddressValidated.lng == null) {
                        missing.push("Site address (choose from map suggestions)");
                      }
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
                      const placeId = siteAddressValidated!.place_id!.trim();
                      const validateRes = await fetch("/api/validate-address", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ place_id: placeId }),
                      });
                      if (!validateRes.ok) {
                        const errBody = await validateRes.json().catch(() => ({}));
                        setProjectSaveErr(
                          (errBody as { error?: string }).error ?? "Address validation failed. Please reselect the address."
                        );
                        return;
                      }
                      const validated = (await validateRes.json()) as {
                        formatted_address: string;
                        place_id: string;
                        lat: number;
                        lng: number;
                      };
                      const latNum = typeof validated.lat === "number" && !Number.isNaN(validated.lat) ? validated.lat : null;
                      const lngNum = typeof validated.lng === "number" && !Number.isNaN(validated.lng) ? validated.lng : null;
                      // UUID or null only (never ""); toUuidOrNull enforces this for primary_waste_contractor_partner_id
                      const primaryPartnerId = toUuidOrNull(primaryWasteContractorPartnerId ?? null);
                      const updatePayload: Record<string, unknown> = {
                        site_address: validated.formatted_address ?? "",
                        site_place_id: validated.place_id?.trim() || null,
                        site_lat: latNum,
                        site_lng: lngNum,
                        address: validated.formatted_address ?? "",
                        region: region.trim() || null,
                        project_type: ptSave || null,
                        start_date: startDate || null,
                        client_name: clientName.trim() || null,
                        main_contractor: mainContractor.trim() || null,
                        swmp_owner: swmpOwner.trim() || null,
                        primary_waste_contractor_partner_id: primaryPartnerId,
                      };
                      const sanitized = PROJECT_UPDATE_KEYS.reduce<Record<string, unknown>>((acc, key) => {
                        if (key in updatePayload) acc[key] = updatePayload[key];
                        return acc;
                      }, {});

                      if (process.env.NODE_ENV === "development") {
                        console.log("[project save] Saving primary contractor", {
                          projectId,
                          newId: primaryPartnerId,
                        });
                      }

                      const { data: updatedRow, error } = await supabase
                        .from("projects")
                        .update(sanitized)
                        .eq("id", projectId)
                        .select(PROJECT_SELECT_AFTER_UPDATE)
                        .single();

                      if (error) {
                        if (process.env.NODE_ENV === "development") {
                          console.error("[project save] Supabase error", error);
                        }
                        const errMsg = process.env.NODE_ENV === "development" && (error.hint || error.details)
                          ? `${error.message} (${[error.hint, error.details].filter(Boolean).join("; ")})`
                          : error.message;
                        setProjectSaveErr(errMsg);
                        return;
                      }

                      if (!updatedRow) {
                        setProjectSaveErr("Save succeeded but no data returned.");
                        return;
                      }

                      if (process.env.NODE_ENV === "development") {
                        console.log("[project save] Saved row returned", (updatedRow as Record<string, unknown>).primary_waste_contractor_partner_id);
                      }

                      // Authoritative: verify DB actually has the value (detect RLS/trigger blocking update)
                      const { data: verify } = await supabase
                        .from("projects")
                        .select("primary_waste_contractor_partner_id")
                        .eq("id", projectId)
                        .single();
                      if (process.env.NODE_ENV === "development") {
                        console.log("[project save] Verify DB value", verify?.primary_waste_contractor_partner_id);
                        const expected = primaryPartnerId ?? null;
                        const actual = verify?.primary_waste_contractor_partner_id ?? null;
                        if (String(actual ?? "") !== String(expected ?? "")) {
                          console.error("[project save] MISMATCH: DB value after update differs from what we sent. Update may be blocked (RLS/trigger).", {
                            expected,
                            actual,
                          });
                        }
                      }

                      const row = updatedRow as Record<string, unknown>;
                      const addr = (row.site_address ?? row.address ?? "") as string;
                      const pid = (row.site_place_id != null && String(row.site_place_id).trim() !== "")
                        ? String(row.site_place_id).trim()
                        : null;
                      const lat = numOrNull(row.site_lat);
                      const lng = numOrNull(row.site_lng);
                      setSiteAddress(addr);
                      setSiteAddressValidated(
                        pid != null && lat != null && lng != null
                          ? { formatted_address: addr, place_id: pid, lat, lng }
                          : null
                      );
                      setRegion((row.region ?? "") as string);
                      const pt = (row.project_type ?? "") as string;
                      if (pt && !PROJECT_TYPE_OPTIONS.includes(pt)) {
                        setProjectType("Other");
                        setProjectTypeOther(pt);
                      } else {
                        setProjectType(pt);
                        setProjectTypeOther("");
                      }
                      setStartDate((row.start_date ?? "") as string);
                      setClientName((row.client_name ?? "") as string);
                      setMainContractor((row.main_contractor ?? "") as string);
                      setSwmpOwner((row.swmp_owner ?? "") as string);
                      setPrimaryWasteContractorPartnerId(toUuidOrNull(row.primary_waste_contractor_partner_id as string) ?? null);
                      projectDetailsDirtyRef.current = false;
                      setProject(updatedRow as ProjectRow);
                      if (projectContext?.project?.id === projectId) {
                        projectContext.setProject(updatedRow as ProjectRow);
                      }
                      setProjectSaveMsg("Saved project details.");
                    }}
                  >
                    Save project details
                  </Button>
                </div>
              </CollapsibleSectionCard>

                  {/* Facilities & logistics */}
                  <CollapsibleSectionCard
                    id="primary-waste-contractor"
                    icon={<Users className="size-5" />}
                    title="Facilities & logistics"
                    description="Primary waste contractor. Set destinations per stream in Waste Streams."
                    whyMatters="Enables facility recommendations and diversion tracking."
                    accent="blue"
                    variant="grouped"
                    stepStatusBadge={getStepStatusBadge("primary-waste-contractor")}
                    checklist={[
                      "Primary waste contractor (partner) selected",
                      "Each waste stream has a facility or custom destination (in Waste Streams)",
                    ]}
                    guidance={
                      <GuidanceBanner
                        complete={getStepStatusBadge("primary-waste-contractor") === "complete"}
                        nextStepLabel="Choose a facility per stream or run the optimiser"
                        helperText="Destinations are set per stream in Waste Streams; they enable diversion tracking."
                        ctaLabel="Go to Waste Streams"
                        onCta={() => setExpandedSectionId("waste-streams")}
                      />
                    }
                  >
                {selectedWasteStreams.length > 0 && (
                  <p className="text-sm text-muted-foreground mb-4">
                    Per-stream contractor overrides are set in Waste Streams below.
                  </p>
                )}
                <FieldGroup gridClassName="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Primary Waste Contractor</Label>
                    <Select
                      value={primaryWasteContractorPartnerId != null && primaryWasteContractorPartnerId !== "" ? String(primaryWasteContractorPartnerId) : "none"}
                      onValueChange={(v) => {
                        const id = v === "none" || v === "" ? null : v;
                        projectDetailsDirtyRef.current = true;
                        setPrimaryWasteContractorPartnerId(id);
                      }}
                      disabled={saveLoading || catalogPartnersLoading}
                    >
                      <SelectTrigger className="w-full bg-background">
                        <SelectValue placeholder={catalogPartnersLoading ? "Loading…" : "Select contractor (partner)"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Not selected —</SelectItem>
                        {catalogPartners.map((pr) => (
                          <SelectItem key={pr.id} value={String(pr.id)}>
                            {pr.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {primaryWasteContractorPartnerId && (
                      <p className="text-xs text-muted-foreground">
                        Contractor: {catalogPartners.find((p) => p.id === primaryWasteContractorPartnerId)?.name ?? "—"}
                      </p>
                    )}
                  </div>
                </FieldGroup>
              </CollapsibleSectionCard>

                  {/* Site constraints */}
                  <CollapsibleSectionCard
                    id="site-and-facilities"
                    icon={<Building2 className="size-5" />}
                    title="Site constraints"
                    description="Constraints that may affect waste handling. Facilities are selected per stream in Waste Streams."
                    accent="amber"
                    variant="grouped"
                    stepStatusBadge={getStepStatusBadge("site-and-facilities")}
                  >
                <FieldGroup
                  label="Site constraints"
                  gridClassName="grid grid-cols-1 sm:grid-cols-2 gap-6"
                >
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
                </FieldGroup>
              </CollapsibleSectionCard>

                  {/* Waste streams — primary focus */}
                  <CollapsibleSectionCard
                    id="waste-streams"
                    icon={<Recycle className="size-5" />}
                    title={
                      <span className="inline-flex items-center gap-1.5">
                        Waste streams
                        <InfoTip
                          label="Waste streams help"
                          content="A waste stream is a type of material (e.g. Mixed C&D, timber, plasterboard). Tonnes you enter drive diversion % and the SWMP report."
                          variant="tooltip"
                        />
                      </span>
                    }
                    description="Select streams, set quantities, disposal method, and destination per stream."
                    whyMatters="Core data for diversion calculations and the generated SWMP."
                    accent="green"
                    variant="primary"
                    stepStatusBadge={getStepStatusBadge("waste-streams")}
                    checklist={[
                      "At least one waste stream selected",
                      "Planned tonnes entered for at least one stream",
                      "Disposal method and destination set per stream",
                    ]}
                    guidance={
                      <GuidanceBanner
                        complete={getStepStatusBadge("waste-streams") === "complete"}
                        nextStepLabel={wasteStreamsGuidance.nextStepLabel || undefined}
                        helperText="Streams and quantities drive diversion calculations and the generated SWMP."
                        ctaLabel={wasteStreamsGuidance.ctaLabel || "Go to waste streams"}
                        onCta={() => {
                          if (selectedWasteStreams.length > 0) {
                            const el = document.getElementById("waste-stream-planning");
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                          }
                        }}
                      />
                    }
                    footer={
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            handleSaveInputs({ preventDefault: () => {} } as React.FormEvent);
                            setExpandedSectionId("resource-inputs");
                          }}
                          disabled={saveLoading}
                        >
                          Save & continue
                        </Button>
                        <span className="text-xs text-muted-foreground">You can come back and edit later.</span>
                      </>
                    }
                    completion={{
                      completed: (() => {
                        if (selectedWasteStreams.length === 0) return 0;
                        return selectedWasteStreams.filter((stream) => {
                          const plan = streamPlans.find((p) => p.category === stream);
                          return computeWasteStreamCompletion(plan, { requireTonnes: true });
                        }).length;
                      })(),
                      total: Math.max(selectedWasteStreams.length, 1),
                    }}
                  >
            <div className="space-y-6">
            {selectedWasteStreams.length === 0 && (
              <SmartHint
                message="Select at least one waste stream below to configure plans and enable Save."
                variant="info"
                className="mb-4"
              />
            )}
            <WasteStreamSelector
              search={wasteStreamSearch}
              onSearchChange={setWasteStreamSearch}
              library={wasteStreamLibrary}
              selected={selectedWasteStreams}
              onAddStream={(stream) =>
                setSelectedWasteStreams((prev) => (prev.includes(stream) ? prev : [...prev, stream]))
              }
              onRemoveStream={(stream) =>
                setSelectedWasteStreams((prev) => prev.filter((x) => x !== stream))
              }
              onApplyTemplate={() => {
                const templateStreams =
                  getWasteStreamsForProjectType(effectiveProjectType ?? "");
                setSelectedWasteStreams(templateStreams);
                setStreamPlans(
                  templateStreams.map((stream) => buildDefaultPlanForStream(stream))
                );
              }}
              onAddCommonSet={() => {
                setSelectedWasteStreams((prev) => {
                  const set = new Set(prev);
                  for (const s of COMMON_STREAM_SET) set.add(s);
                  return Array.from(set);
                });
              }}
              onContinueToPlanning={() => {
                const el = document.getElementById("waste-stream-planning");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              hasTemplate={!!(
                effectiveProjectType && PROJECT_TYPE_DEFAULT_STREAMS[effectiveProjectType] != null
              )}
              disabled={saveLoading}
            />

            <div className="mt-6 rounded-lg border bg-muted/30 p-4 space-y-3">
              <Label className="font-semibold block">Diversion summary</Label>
              <p className="text-sm text-muted-foreground">
                Based on manual quantities and allocated forecast tonnes. Add quantities and units in waste stream plans, or allocate forecast items to streams.
              </p>
              <div className="grid gap-2 sm:grid-cols-3 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">Diversion (Reuse+Recycle) %</span>
                  <p className="text-base font-semibold">{diversionSummary.totalTonnes > 0 ? diversionSummary.diversionReuseRecyclePct.toFixed(1) : "—"}%</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Landfill avoidance (incl. Cleanfill) %</span>
                  <p className="text-base font-semibold">{diversionSummary.totalTonnes > 0 ? diversionSummary.landfillAvoidancePct.toFixed(1) : "—"}%</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Total estimated tonnes</span>
                  <p className="text-base font-semibold">{diversionSummary.totalTonnes > 0 ? diversionSummary.totalTonnes.toFixed(2) : "—"}</p>
                </div>
              </div>
              {unallocatedForecastCount > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {unallocatedForecastCount} forecast item{unallocatedForecastCount === 1 ? "" : "s"} unallocated — not included in diversion summary.
                </p>
              )}
              {(diversionSummary.missingThicknessStreams.length > 0 || diversionSummary.missingQuantityStreams.length > 0) && (
                <p className="text-xs text-muted-foreground">
                  {diversionSummary.missingThicknessStreams.length > 0 && (
                    <>Streams with m² but no thickness: {diversionSummary.missingThicknessStreams.join(", ")}. </>
                  )}
                  {diversionSummary.missingQuantityStreams.length > 0 && (
                    <>Streams without quantity: {diversionSummary.missingQuantityStreams.join(", ")}.</>
                  )}
                </p>
              )}
            </div>

            <div className="mt-6 space-y-4">
              {saveLoading && (
                <span className="text-xs text-muted-foreground" aria-live="polite">Saving…</span>
              )}

              <div id="waste-stream-planning" className="scroll-mt-6">
                <h3 className="text-sm font-semibold text-foreground mb-3 mt-6">
                  Plan selected streams
                </h3>
              </div>
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
                      const single = src.intended_outcomes?.length > 0 ? [src.intended_outcomes[0]] : ["Recycle"];
                      setStreamPlans((prev) =>
                        prev.map((p) => ({
                          ...p,
                          intended_outcomes: single,
                          hadMultipleOutcomes: false,
                        }))
                      );
                    }}
                  >
                    Copy disposal method to all
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
                          destination_mode: src.destination_mode ?? "facility",
                          partner_id: src.partner_id ?? null,
                          facility_id: src.facility_id ?? null,
                          destination_override: src.destination_override ?? null,
                          custom_destination_name: src.custom_destination_name ?? null,
                          custom_destination_address: src.custom_destination_address ?? null,
                          custom_destination_place_id: src.custom_destination_place_id ?? null,
                          custom_destination_lat: src.custom_destination_lat ?? null,
                          custom_destination_lng: src.custom_destination_lng ?? null,
                          partner: src.partner ?? null,
                          partner_overridden: true,
                        }))
                      );
                    }}
                  >
                    Copy partner to all
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!primaryWasteContractorPartnerId || saveLoading}
                    onClick={async () => {
                      if (!primaryWasteContractorPartnerId) return;
                      const primaryId = primaryWasteContractorPartnerId;
                      setStreamPlanMsg("Applying primary contractor to streams missing a partner…");
                      setStreamPlanErr(null);
                      const nextPlans = streamPlans.map((p) => {
                        if (p.partner_id != null && String(p.partner_id).trim() !== "") return p;
                        return { ...p, partner_id: primaryId };
                      });
                      setStreamPlans(nextPlans);
                      const fromState = {
                        sorting_level: sortingLevel,
                        target_diversion: Math.min(100, Math.max(0, Math.round(Number(targetDiversion)) || 0)),
                        constraints: selectedConstraints,
                        waste_streams: selectedWasteStreams,
                        hazards,
                        waste_stream_plans: nextPlans.map((p) => {
                          const manualTonnes =
                            p.manual_qty_tonnes != null && Number.isFinite(p.manual_qty_tonnes) && p.manual_qty_tonnes >= 0
                              ? p.manual_qty_tonnes
                              : (planManualQtyToTonnes(p, p.category) ?? null);
                          return { ...p, manual_qty_tonnes: manualTonnes };
                        }),
                        responsibilities: responsibilities.map((r) => {
                          const list = r.responsibilities.filter(Boolean);
                          return {
                            role: r.role.trim() || "Role",
                            party: r.party.trim() || "—",
                            responsibilities: list.length ? list : ["—"],
                          };
                        }),
                        additional_responsibilities: additionalResponsibilities
                          .filter((a) => a.name.trim() || a.role.trim() || a.responsibilities.trim())
                          .map((a) => ({
                            name: a.name.trim(),
                            role: a.role.trim(),
                            email: a.email?.trim() || undefined,
                            phone: a.phone?.trim() || undefined,
                            responsibilities: a.responsibilities.trim(),
                          })),
                        logistics: {
                          waste_contractor: null,
                          bin_preference: binPreference,
                          reporting_cadence: reportingCadence,
                        },
                        monitoring: {
                          methods: monitoringMethods,
                          uses_software: usesSoftware,
                          software_name: softwareName || null,
                          dockets_description: docketsDescription,
                        },
                        site_controls: siteControls,
                        notes: notes.trim() || null,
                      };
                      try {
                        const normalized = normalizeSwmpInputs({ ...fromState, project_id: projectId });
                        const { error } = await supabase.from("swmp_inputs").insert({
                          project_id: projectId,
                          [SWMP_INPUTS_JSON_COLUMN]: normalized,
                        });
                        if (error) {
                          setStreamPlanErr(error.message || "Failed to save.");
                          setStreamPlanMsg(null);
                          return;
                        }
                        setStreamPlanMsg("Primary contractor applied to all streams missing a partner.");
                        setStreamPlanErr(null);
                      } catch (e) {
                        setStreamPlanErr(e instanceof Error ? e.message : "Failed to save.");
                        setStreamPlanMsg(null);
                      }
                    }}
                  >
                    Apply Primary Contractor to all streams missing a partner
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
                <>
                <div className="rounded-md border border-border/50 overflow-hidden mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left font-medium px-4 py-3">Stream</th>
                        <th className="text-left font-medium px-4 py-3 w-28">Planned tonnes</th>
                        <th className="text-left font-medium px-4 py-3 min-w-[140px]">
                          <span className="inline-flex items-center gap-1.5">
                            Disposal method
                            <InfoTip
                              label="Disposal method help"
                              content="How each stream is disposed (e.g. Recycle, Landfill). Affects diversion % and reporting."
                              variant="tooltip"
                            />
                          </span>
                        </th>
                        <th className="text-left font-medium px-4 py-3 min-w-[160px]">
                          <span className="inline-flex items-center gap-1.5">
                            Destination / facility
                            <InfoTip
                              label="Destination help"
                              content="Where the waste goes. Used for distance, optimiser, and the report. Set per stream."
                              variant="tooltip"
                            />
                          </span>
                        </th>
                        <th className="text-left font-medium px-4 py-3 w-28">Status</th>
                        <th className="w-20 px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedWasteStreams.map((stream) => {
                        const plan = streamPlans.find((p) => p.category === stream);
                        const effectivePartnerId = getEffectivePartnerId(plan ?? undefined, primaryWasteContractorPartnerId);
                        const facilityList = effectivePartnerId ? (facilitiesByPartner[effectivePartnerId] ?? []) : [];
                        const partner = effectivePartnerId ? catalogPartners.find((p) => p.id === effectivePartnerId) : null;
                        const facility = plan?.facility_id ? facilityList.find((f) => f.id === plan.facility_id) : null;
                        const manualTonnesRaw = plan?.manual_qty_tonnes ?? (plan ? planManualQtyToTonnes(plan, stream) : null);
                        const manualTonnesNum = manualTonnesRaw != null && Number.isFinite(manualTonnesRaw) ? Number(manualTonnesRaw) : null;
                        const streamComplete = computeWasteStreamCompletion(plan);
                        const expanded = expandedStreamPlans[stream] ?? false;
                        return (
                          <tr
                            key={stream}
                            className="border-b border-border hover:bg-muted/30"
                          >
                            <td className="px-4 py-2 font-medium align-middle">{stream}</td>
                            <td className="px-4 py-2 align-middle">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={manualTonnesNum != null && manualTonnesNum >= 0 ? manualTonnesNum : ""}
                                placeholder="0"
                                className="h-8 w-24 tabular-nums"
                                disabled={saveLoading}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const num = v === "" ? null : (Number(v) >= 0 ? Number(v) : null);
                                  setStreamPlans((prev) =>
                                    prev.map((p) =>
                                      p.category === stream ? { ...p, manual_qty_tonnes: num ?? undefined } : p
                                    )
                                  );
                                }}
                              />
                            </td>
                            <td className="px-4 py-2 align-middle">
                              <div className="flex flex-wrap items-center gap-2">
                                <Select
                                  value={(plan?.intended_outcomes?.length ? plan.intended_outcomes[0] : "Recycle") ?? "Recycle"}
                                  onValueChange={(v) => {
                                    setStreamPlans((prev) =>
                                      prev.map((p) =>
                                        p.category === stream
                                          ? { ...p, intended_outcomes: [v], hadMultipleOutcomes: false }
                                          : p
                                      )
                                    );
                                  }}
                                  disabled={saveLoading}
                                >
                                  <SelectTrigger className="h-8 w-full min-w-[120px] bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {INTENDED_OUTCOME_OPTIONS.map((opt) => (
                                      <SelectItem key={opt} value={opt}>
                                        {opt}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {plan?.hadMultipleOutcomes && (
                                  <Badge variant="secondary" className="text-[10px] font-normal bg-amber-500/15 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 shrink-0">
                                    Multiple methods detected; please confirm
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2 align-middle">
                              {effectivePartnerId ? (
                                <Select
                                  value={
                                    plan?.destination_mode === "custom"
                                      ? "custom"
                                      : plan?.facility_id != null && String(plan.facility_id).trim() !== ""
                                        ? String(plan.facility_id)
                                        : "__none__"
                                  }
                                  onValueChange={(v) => {
                                    if (v === "custom") {
                                      setStreamPlans((prev) =>
                                        prev.map((p) =>
                                          p.category === stream
                                            ? {
                                                ...p,
                                                destination_mode: "custom",
                                                facility_id: null,
                                              }
                                            : p
                                        )
                                      );
                                    } else if (v === "__none__") {
                                      setStreamPlans((prev) =>
                                        prev.map((p) =>
                                          p.category === stream
                                            ? { ...p, destination_mode: "facility", facility_id: null }
                                            : p
                                        )
                                      );
                                    } else {
                                      setStreamPlans((prev) =>
                                        prev.map((p) =>
                                          p.category === stream
                                            ? {
                                                ...p,
                                                destination_mode: "facility",
                                                facility_id: v || null,
                                              }
                                            : p
                                        )
                                      );
                                    }
                                  }}
                                  disabled={saveLoading}
                                >
                                  <SelectTrigger className="h-8 w-full max-w-[200px] bg-background">
                                    <SelectValue placeholder="Select…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">— Select —</SelectItem>
                                    {facilityList.map((f) => (
                                      <SelectItem key={f.id} value={String(f.id)}>
                                        {(f as { name?: string }).name ?? f.id}
                                      </SelectItem>
                                    ))}
                                    <SelectItem value="custom">Custom destination</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-muted-foreground text-xs">Set primary contractor or Edit</span>
                              )}
                            </td>
                            <td className="px-4 py-2 align-middle">
                              {streamComplete ? (
                                <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">Complete</span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400 text-xs font-medium">Needs attention</span>
                              )}
                            </td>
                            <td className="px-4 py-2 align-middle">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setExpandedStreamPlans((prev) => {
                                    const willOpen = !(prev[stream] ?? false);
                                    if (willOpen) return { [stream]: true };
                                    return { ...prev, [stream]: false };
                                  })
                                }
                              >
                                {expanded ? "Collapse" : "Edit"}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
                        intended_outcomes: ["Recycle"],
                        destination_mode: "facility",
                        partner_id: null,
                        facility_id: null,
                        destination_override: null,
                        custom_destination_name: null,
                        custom_destination_address: null,
                        custom_destination_place_id: null,
                        custom_destination_lat: null,
                        custom_destination_lng: null,
                        partner: null,
                        partner_overridden: false,
                        pathway: `Segregate ${stream} where practical and send to an approved recycler/processor.`,
                        notes: null,
                        estimated_qty: null,
                        unit: getDefaultUnitForStreamLabel(stream),
                        density_kg_m3: null,
                        thickness_m: getDefaultThicknessForStreamLabel(stream) ?? null,
                        generated_by: null,
                        on_site_management: null,
                        destination: null,
                        distance_km: null,
                        duration_min: null,
                        waste_contractor_partner_id: null,
                        manual_qty_tonnes: null,
                        forecast_qty: null,
                        forecast_unit: "tonne",
                        handling_mode: "mixed",
                      } as WasteStreamPlan);

                    const expanded = expandedStreamPlans[stream] ?? false;
                    const effectivePartnerId = getEffectivePartnerId(safePlan, primaryWasteContractorPartnerId);
                    const isInheritedPartner = (safePlan.partner_id == null || String(safePlan.partner_id).trim() === "") && effectivePartnerId != null;
                    const resolvedPartner = effectivePartnerId ? catalogPartners.find((p) => p.id === effectivePartnerId) ?? null : null;
                    const rawFacility = effectivePartnerId && facilitiesByPartner[effectivePartnerId]?.find((f) => f.id === safePlan.facility_id);
                    const resolvedFacility = rawFacility && typeof rawFacility === "object" && "name" in rawFacility ? rawFacility : null;
                    const summaryOutcomes =
                      (safePlan.intended_outcomes?.length ? safePlan.intended_outcomes[0] : "Recycle") ?? "Recycle";
                    const summaryManualTonnes = safePlan.manual_qty_tonnes ?? planManualQtyToTonnes(safePlan, stream) ?? 0;
                    const summaryForecastTonnes = safePlan.forecast_qty != null && safePlan.forecast_qty >= 0 ? Number(safePlan.forecast_qty) : 0;
                    const summaryTotalTonnes = summaryManualTonnes + summaryForecastTonnes;
                    const summaryQtyUnit = summaryTotalTonnes > 0 ? `${summaryTotalTonnes.toFixed(3)} tonne` : "";
                    const facilityName = resolvedFacility != null ? String((resolvedFacility as { name?: string }).name ?? "") : "";
                    const titlePartnerName =
                      resolvedPartner?.name ?? (primaryWasteContractorPartnerId ? catalogPartners.find((p) => p.id === primaryWasteContractorPartnerId)?.name ?? "" : "") ?? "—";
                    const summaryDestination =
                      safePlan.destination_mode === "custom"
                        ? (safePlan.custom_destination_name ?? safePlan.custom_destination_address ?? "").trim() || (safePlan.destination_override ?? (safePlan.destination ?? "").trim()) || "—"
                        : facilityName !== ""
                          ? (resolvedPartner?.name ? `${resolvedPartner.name} – ${facilityName}` : facilityName)
                          : "";
                    const summaryDestinationTruncated =
                      summaryDestination.length > 50 ? `${summaryDestination.slice(0, 47)}…` : summaryDestination;

                    const streamComplete = computeWasteStreamCompletion(safePlan);
                    return (
                      <StreamRow
                        key={stream}
                        title={stream}
                        icon={<Recycle className="size-4" />}
                        badges={
                          <Badge variant="secondary" className="text-xs font-normal">
                            {summaryOutcomes}
                          </Badge>
                        }
                        totalTonnes={summaryQtyUnit || "—"}
                        facilitySummary={summaryDestinationTruncated || "—"}
                        statusSummary={
                          streamComplete ? (
                            <span className="text-emerald-600 dark:text-emerald-400 text-xs">Complete</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 text-xs">Needs attention</span>
                          )
                        }
                        expanded={expanded}
                        onToggle={() =>
                          setExpandedStreamPlans((prev) => {
                            const willOpen = !(prev[stream] ?? false);
                            if (willOpen) return { [stream]: true };
                            return { ...prev, [stream]: false };
                          })
                        }
                        onRemove={() =>
                          setSelectedWasteStreams((prev) => prev.filter((x) => x !== stream))
                        }
                      >
                        <div className="space-y-4">
                            <div className="grid gap-2">
                              <Label className="text-sm">Handling</Label>
                              <p className="text-xs text-muted-foreground">
                                Mixed = co-mingled / Separated = source-separated onsite
                              </p>
                              <div className="flex rounded-lg border bg-muted/30 p-0.5 w-fit">
                                {(["mixed", "separated"] as const).map((mode) => {
                                  const isActive = (safePlan.handling_mode ?? "mixed") === mode;
                                  return (
                                    <button
                                      key={mode}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updatePlan(stream, { handling_mode: mode });
                                        setTimeout(() => {
                                          handleSaveInputs({ preventDefault: () => {} } as React.FormEvent);
                                        }, 100);
                                      }}
                                      className={cn(
                                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                                        isActive
                                          ? "bg-background text-foreground shadow-sm"
                                          : "text-muted-foreground hover:text-foreground"
                                      )}
                                    >
                                      {mode === "mixed" ? "Mixed" : "Separated"}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="grid gap-2">
                              <Label>Disposal method (choose one)</Label>
                                {safePlan.hadMultipleOutcomes && (
                                  <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-2 py-1.5">
                                    Multiple methods detected; please select one.
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  Select the single intended outcome for this waste stream.
                                </p>
                                <Select
                                  value={
                                    safePlan.intended_outcomes?.length > 0
                                      ? safePlan.intended_outcomes[0]
                                      : "Recycle"
                                  }
                                  onValueChange={(v) => {
                                    setStreamPlans((prev) =>
                                      prev.map((p) =>
                                        p.category === stream
                                          ? { ...p, intended_outcomes: [v], hadMultipleOutcomes: false }
                                          : p
                                      )
                                    );
                                  }}
                                  disabled={saveLoading}
                                >
                                  <SelectTrigger className="w-full bg-background">
                                    <SelectValue placeholder="Select disposal method" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {INTENDED_OUTCOME_OPTIONS.map((opt) => (
                                      <SelectItem key={opt} value={opt}>
                                        {opt}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                              <Label>Destination</Label>
                              <Select
                                value={safePlan.destination_mode === "custom" ? "custom" : "facility"}
                                onValueChange={(v) => {
                                  const mode = v === "custom" ? "custom" : "facility";
                                  if (mode === "facility") {
                                    const partnerKey = String(effectivePartnerId ?? "").trim();
                                    const facilityList = partnerKey ? (facilitiesByPartner[partnerKey] ?? []) : [];
                                    const validFacilityId =
                                      safePlan.facility_id && facilityList.some((f) => f.id === safePlan.facility_id)
                                        ? safePlan.facility_id
                                        : null;
                                    updatePlan(stream, {
                                      destination_mode: "facility",
                                      facility_id: validFacilityId,
                                      custom_destination_name: null,
                                      custom_destination_address: null,
                                      custom_destination_place_id: null,
                                      custom_destination_lat: null,
                                      custom_destination_lng: null,
                                      destination_override: null,
                                    });
                                    if (effectivePartnerId) loadFacilitiesForPartner(effectivePartnerId);
                                  } else {
                                    updatePlan(stream, {
                                      destination_mode: "custom",
                                      facility_id: null,
                                      partner_id: null,
                                      destination_override: null,
                                    });
                                  }
                                }}
                                disabled={saveLoading}
                              >
                                <SelectTrigger className="w-full bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="facility">Facility (default)</SelectItem>
                                  <SelectItem value="custom">Custom destination</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {safePlan.destination_mode !== "custom" && (
                              <>
                                <div className="grid gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Label>
                                      {isInheritedPartner
                                        ? "Partner (default from Primary Waste Contractor)"
                                        : "Partner (company)"}
                                    </Label>
                                    {isInheritedPartner && (
                                      <Badge variant="secondary" className="text-xs font-normal">
                                        Default
                                      </Badge>
                                    )}
                                  </div>
                                  <Select
                                    value={effectivePartnerId != null && effectivePartnerId !== "" ? String(effectivePartnerId) : "other"}
                                    onValueChange={(v) => {
                                      const partnerId = v === "other" || v === "" ? null : v;
                                      updatePlan(stream, {
                                        partner_id: partnerId,
                                        facility_id: null,
                                        partner: null,
                                        partner_overridden: true,
                                        waste_contractor_partner_id: partnerId,
                                      });
                                      if (partnerId) {
                                        loadFacilitiesForPartner(partnerId);
                                      }
                                    }}
                                    disabled={saveLoading || catalogPartnersLoading}
                                  >
                                    <SelectTrigger className="w-full bg-background">
                                      <SelectValue placeholder={catalogPartnersLoading ? "Loading…" : "Select partner"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="other">Other</SelectItem>
                                      {catalogPartners.map((pr) => (
                                        <SelectItem key={pr.id} value={String(pr.id)}>
                                          {pr.name}
                                        </SelectItem>
                                      ))}
                                      {!catalogPartnersLoading && catalogPartners.length === 0 && (
                                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                          No partners in catalog. Add partners in Admin.
                                        </div>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                                {effectivePartnerId != null && effectivePartnerId !== "" ? (() => {
                                  const partnerKey = String(effectivePartnerId).trim();
                                  const facilityList = facilitiesByPartner[partnerKey] ?? [];
                                  const isLoading = !!facilitiesLoadingByPartner[partnerKey];
                                  return (
                                    <div className="grid gap-2">
                                      <Label>Facility (site)</Label>
                                      <Select
                                        value={safePlan.facility_id ?? "none"}
                                        onValueChange={(v) => {
                                          const facilityId = v === "none" || v === "" ? null : v;
                                          updatePlan(stream, { facility_id: facilityId });
                                        }}
                                        disabled={saveLoading || isLoading}
                                      >
                                        <SelectTrigger className="w-full bg-background">
                                          <SelectValue
                                            placeholder={
                                              isLoading ? "Loading…" : "Select facility"
                                            }
                                          />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">— Not selected —</SelectItem>
                                          {facilityList.map((f) => (
                                            <SelectItem key={f.id} value={String(f.id)}>
                                              {f.name}
                                            </SelectItem>
                                          ))}
                                          {!isLoading && facilityList.length === 0 && (
                                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                              No facilities found for this partner. Add facilities in Admin.
                                            </div>
                                          )}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  );
                                })() : (
                                  <p className="text-sm text-muted-foreground">
                                    Select a Primary Waste Contractor (Project Setup) or choose a Partner for this stream.
                                  </p>
                                )}
                              </>
                            )}

                            {safePlan.destination_mode === "custom" && (
                              <>
                                <div className="grid gap-2">
                                  <Label>Custom destination name (required)</Label>
                                  <Input
                                    value={safePlan.custom_destination_name ?? ""}
                                    onChange={(e) =>
                                      updatePlan(stream, {
                                        custom_destination_name: e.target.value.trim() || null,
                                      })
                                    }
                                    placeholder="e.g. Approved recycler / landfill"
                                    disabled={saveLoading}
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Custom destination address (required)</Label>
                                  <AddressAutocomplete
                                    value={safePlan.custom_destination_address ?? ""}
                                    onInput={(value) =>
                                      updatePlan(stream, {
                                        custom_destination_address: value.trim() || null,
                                        custom_destination_place_id: null,
                                        custom_destination_lat: null,
                                        custom_destination_lng: null,
                                      })
                                    }
                                    onChange={(value) => {
                                      if (value) {
                                        updatePlan(stream, {
                                          custom_destination_address: value.formatted_address,
                                          custom_destination_place_id: value.place_id,
                                          custom_destination_lat: value.lat,
                                          custom_destination_lng: value.lng,
                                        });
                                      } else {
                                        updatePlan(stream, {
                                          custom_destination_address: null,
                                          custom_destination_place_id: null,
                                          custom_destination_lat: null,
                                          custom_destination_lng: null,
                                        });
                                      }
                                    }}
                                    placeholder="Search address…"
                                    disabled={saveLoading}
                                  />
                                </div>
                              </>
                            )}

                            <div className="space-y-4">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Planning details</p>
                              <div className="grid gap-4">
                                <div className="grid gap-2">
                                  <Label className="text-sm">Planned pathway</Label>
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
                                    className="resize-none"
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label className="text-sm">How is this waste generated?</Label>
                                  <Textarea
                                    value={safePlan.generated_by ?? ""}
                                    onChange={(e) => updatePlan(stream, { generated_by: e.target.value })}
                                    rows={2}
                                    placeholder="e.g. Demolition, offcuts, packaging"
                                    disabled={saveLoading}
                                    className="resize-none"
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label className="text-sm">On-site management</Label>
                                  <Textarea
                                    value={safePlan.on_site_management ?? ""}
                                    onChange={(e) => updatePlan(stream, { on_site_management: e.target.value })}
                                    rows={2}
                                    placeholder="e.g. Segregation, covered storage"
                                    disabled={saveLoading}
                                    className="resize-none"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="grid gap-2">
                                <Label>Manual quantity (optional)</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
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
                                <p className="text-xs text-muted-foreground">
                                  Converted and reported in tonnes.
                                </p>
                                {(() => {
                                  const manualTonnes = safePlan.manual_qty_tonnes ?? planManualQtyToTonnes(safePlan, stream);
                                  return manualTonnes != null && manualTonnes >= 0 ? (
                                    <p className="text-xs text-muted-foreground tabular-nums">
                                      = {manualTonnes.toFixed(3)} tonne
                                    </p>
                                  ) : null;
                                })()}
                              </div>
                              <div className="grid gap-2">
                                <Label>Unit</Label>
                                <Select
                                  value={
                                    safePlan.unit != null
                                      ? safePlan.unit
                                      : `default:${getDefaultUnitForStreamLabel(stream)}`
                                  }
                                  onValueChange={(v) => {
                                    setStreamPlans((prev) =>
                                      prev.map((p) =>
                                        p.category === stream
                                          ? {
                                              ...p,
                                              unit: v.startsWith("default:")
                                                ? null
                                                : v === "none"
                                                  ? null
                                                  : (v as PlanUnit),
                                            }
                                          : p
                                      )
                                    );
                                  }}
                                  disabled={saveLoading}
                                >
                                  <SelectTrigger className="w-full bg-background">
                                    <SelectValue
                                      placeholder={`Default: ${getDefaultUnitForStreamLabel(stream)}`}
                                    />
                                  </SelectTrigger>
                                  <SelectContent className="z-50 bg-popover border border-border">
                                    <SelectItem value={`default:${getDefaultUnitForStreamLabel(stream)}`}>
                                      Default ({getDefaultUnitForStreamLabel(stream) === "m3" ? "m³" : getDefaultUnitForStreamLabel(stream) === "m2" ? "m²" : getDefaultUnitForStreamLabel(stream)})
                                    </SelectItem>
                                    {PLAN_UNIT_OPTIONS.filter(
                                      (u) => u !== getDefaultUnitForStreamLabel(stream)
                                    ).map((u) => (
                                      <SelectItem key={u} value={u}>
                                        {u === "m3" ? "m³" : u === "m2" ? "m²" : u}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">Quantity summary (tonnes)</p>
                              <div className="grid gap-1 text-sm">
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Manual</span>
                                  <span className="tabular-nums">
                                    {(() => {
                                      const manualTonnes = safePlan.manual_qty_tonnes ?? planManualQtyToTonnes(safePlan, stream);
                                      return manualTonnes != null && manualTonnes >= 0
                                        ? `${manualTonnes.toFixed(3)} tonne`
                                        : "—";
                                    })()}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Forecast</span>
                                  <span className="tabular-nums">
                                    {safePlan.forecast_qty != null && safePlan.forecast_qty >= 0
                                      ? `${Number(safePlan.forecast_qty).toFixed(3)} tonne`
                                      : "—"}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4 font-medium border-t border-border pt-2 mt-1">
                                  <span>Total</span>
                                  <span className="tabular-nums">
                                    {(() => {
                                      const manualTonnes = safePlan.manual_qty_tonnes ?? planManualQtyToTonnes(safePlan, stream) ?? 0;
                                      const forecastTonnes = safePlan.forecast_qty != null && safePlan.forecast_qty >= 0 ? Number(safePlan.forecast_qty) : 0;
                                      const total = manualTonnes + forecastTonnes;
                                      return total > 0 ? `${total.toFixed(3)} tonne` : "—";
                                    })()}
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                All reporting in tonnes. Forecast is calculated from Forecast tab items.
                              </p>
                              {projectId && (
                                <Link
                                  href={`/projects/${projectId}/forecast?stream=${encodeURIComponent(stream)}`}
                                  className="text-xs text-primary hover:underline"
                                >
                                  View contributing forecast items
                                </Link>
                              )}
                            </div>

                            <div className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-3">
                              <p className="text-xs font-medium text-muted-foreground">More options</p>
                              <div className="grid gap-2">
                                <Label className="font-normal">Density (kg/m³)</Label>
                                <p className="text-xs text-muted-foreground">Used to convert quantity to tonnes for diversion. Default from stream type.</p>
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={
                                    safePlan.density_kg_m3 != null && safePlan.density_kg_m3 >= 0
                                      ? safePlan.density_kg_m3
                                      : ""
                                  }
                                  placeholder={String(getDensityForStreamLabel(stream))}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setStreamPlans((prev) =>
                                      prev.map((p) =>
                                        p.category === stream
                                          ? {
                                              ...p,
                                              density_kg_m3: v === "" ? null : (Number(v) >= 0 ? Number(v) : null),
                                            }
                                          : p
                                      )
                                    );
                                  }}
                                  disabled={saveLoading}
                                />
                              </div>
                              {(safePlan.unit ?? getDefaultUnitForStreamLabel(stream)) === "m2" && (
                                <div className="grid gap-2">
                                  <Label className="font-normal">Thickness (m)</Label>
                                  <p className="text-xs text-muted-foreground">Required for area (m²) to tonnes conversion.</p>
                                  <Input
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={
                                      safePlan.thickness_m != null && safePlan.thickness_m >= 0
                                        ? safePlan.thickness_m
                                        : ""
                                    }
                                    placeholder={String(getDefaultThicknessForStreamLabel(stream) ?? "e.g. 0.01")}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setStreamPlans((prev) =>
                                        prev.map((p) =>
                                          p.category === stream
                                            ? {
                                                ...p,
                                                thickness_m: v === "" ? null : (Number(v) >= 0 ? Number(v) : null),
                                              }
                                            : p
                                        )
                                      );
                                    }}
                                    disabled={saveLoading}
                                  />
                                </div>
                              )}
                            </div>

                            <div className="grid gap-2">
                              <Label>Distance to destination (km)</Label>
                              <p className="text-sm tabular-nums text-muted-foreground">
                                {safePlan.distance_km != null && safePlan.distance_km >= 0 ? (
                                  <>
                                    {safePlan.distance_km} km
                                    {safePlan.duration_min != null && safePlan.duration_min >= 0
                                      ? ` (${Math.round(safePlan.duration_min)} min)`
                                      : ""}
                                  </>
                                ) : (
                                  "—"
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Computed from project site to destination. Save after changing facility or custom destination to update.
                              </p>
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
                      </StreamRow>
                    );
                  })}
                </div>
                </>
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
            </div>
              </CollapsibleSectionCard>

                  {/* Resource inputs */}
                  <CollapsibleSectionCard
                    id="resource-inputs"
                    icon={<FileInput className="size-5" />}
                    title="Resource inputs"
                    description="Sorting level and target diversion. Optional for compliance."
                    whyMatters="Improves reporting and template defaults."
                    accent="zinc"
                    variant="grouped"
                    stepStatusBadge={getStepStatusBadge("resource-inputs")}
                    checklist={["Sorting level set", "Target diversion %"]}
                  >
                <FieldGroup gridClassName="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  <div className="space-y-2">
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
                  <div className="space-y-2">
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
                </FieldGroup>
              </CollapsibleSectionCard>

                  {/* Monitoring & site controls */}
                  <CollapsibleSectionCard
                    id="monitoring-site-controls"
                    icon={<ClipboardList className="size-5" />}
                    title="Monitoring & site controls"
                    description="Cadence, evidence types, and site controls for the SWMP."
                    whyMatters="Required for compliant monitoring and reporting."
                    accent="blue"
                    variant="grouped"
                    stepStatusBadge={getStepStatusBadge("monitoring-site-controls")}
                    checklist={[
                      "Reporting cadence selected",
                      "At least one evidence type or software toggled",
                      "Site controls described (signage, contamination, hazardous)",
                    ]}
                    guidance={
                      <GuidanceBanner
                        complete={getStepStatusBadge("monitoring-site-controls") === "complete"}
                        nextStepLabel="Select how you will evidence waste tracking"
                        helperText="Cadence and evidence types are required for compliant monitoring and reporting."
                        ctaLabel="Set monitoring"
                        onCta={() => setExpandedSectionId("monitoring-site-controls")}
                      />
                    }
                    footer={
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            handleSaveInputs({ preventDefault: () => {} } as React.FormEvent);
                            setExpandedSectionId("compliance-notes");
                          }}
                          disabled={saveLoading}
                        >
                          Save & continue
                        </Button>
                        <span className="text-xs text-muted-foreground">You can come back and edit later.</span>
                      </>
                    }
                  >
                <Accordion type="single" collapsible defaultValue="" className="w-full max-w-full overflow-hidden">
              <AccordionItem value="monitoring" className="border border-border/50 rounded-lg px-0 mb-2 overflow-hidden">
                <AccordionTrigger className="w-full px-4 py-4 bg-muted/40 hover:bg-muted/60 transition-colors [&[data-state=open]]:bg-muted/60 rounded-t-lg data-[state=open]:rounded-b-none [&>svg]:shrink-0">
                  <span className="flex flex-col items-start text-left gap-0.5">
                    <span className="font-semibold text-lg">Monitoring & Reporting</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {monitoringMethods.length ? `${monitoringMethods.join(", ")}` : "Not configured"}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                    <div className="space-y-6">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="inline-flex items-center gap-1.5">
                        <Label className="text-sm font-medium">Monitoring & reporting cadence</Label>
                        <InfoTip
                          label="Reporting cadence help"
                          content="How often you’ll report waste data. Sets expectations for dockets and tracking."
                          variant="tooltip"
                        />
                      </span>
                      <Select
                        value={reportingCadence}
                        onValueChange={(v) => setReportingCadence(v as any)}
                        disabled={saveLoading}
                      >
                        <SelectTrigger className="w-[140px] h-9 border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Weekly">Weekly</SelectItem>
                          <SelectItem value="Fortnightly">Fortnightly</SelectItem>
                          <SelectItem value="Monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-3">Choose how you will evidence waste movements and performance.</p>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {MONITORING_METHOD_OPTIONS.map((m) => (
                        <SelectableOptionCard
                          key={m}
                          checked={monitoringMethods.includes(m)}
                          onCheckedChange={() =>
                            toggleInList(m, monitoringMethods, setMonitoringMethods)
                          }
                          label={m}
                          accentColor="blue"
                          disabled={saveLoading}
                          icon={
                            m === "Dockets" ? <FileText className="size-4" /> :
                            m === "Invoices/receipts" ? <Receipt className="size-4" /> :
                            m === "Photos" ? <Camera className="size-4" /> :
                            m === "Monthly reporting" ? <CalendarDays className="size-4" /> :
                            m === "Toolbox talks" ? <MessageSquare className="size-4" /> : null
                          }
                        />
                      ))}
                    </div>
                    </div>
                    <Separator className="border-border/50" />
                    <div className="flex flex-wrap items-center justify-between gap-4 py-2">
                      <Label className="text-sm font-medium">We use software to track waste</Label>
                      <Switch
                        checked={usesSoftware}
                        onCheckedChange={() => setUsesSoftware((v) => !v)}
                        disabled={saveLoading}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>
                    {usesSoftware && (
                      <Input
                        value={softwareName}
                        onChange={(e) => setSoftwareName(e.target.value)}
                        placeholder="Software name (e.g. WasteX / Excel)"
                        disabled={saveLoading}
                        className="max-w-xs bg-muted/30 rounded-lg border-border/50"
                      />
                    )}
                    <TextareaFieldWrapper
                      label="Dockets / receipts description"
                      value={docketsDescription}
                      onChange={(e) => setDocketsDescription(e.target.value)}
                      rows={3}
                      disabled={saveLoading}
                      maxWidth="max-w-3xl"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="site-controls" className="border border-border/50 rounded-lg px-0 mb-2 overflow-hidden">
                <AccordionTrigger className="w-full px-4 py-4 bg-muted/40 hover:bg-muted/60 transition-colors [&[data-state=open]]:bg-muted/60 rounded-t-lg data-[state=open]:rounded-b-none [&>svg]:shrink-0">
                  <span className="flex flex-col items-start text-left gap-0.5">
                    <span className="font-semibold text-lg">Site controls</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      Signage, contamination &amp; hazardous controls
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-6">
                    <p className="text-sm text-muted-foreground">Describe how signage and contamination/hazard controls will be managed on site. These appear in the generated SWMP.</p>
                    <Accordion type="single" collapsible className="w-full space-y-2">
                      <AccordionItem value="signage_storage" className="rounded-lg border border-border/50 overflow-hidden bg-card">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline [&>svg]:shrink-0">
                          <span className="flex items-center gap-3">
                            <Signpost className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="text-left">
                              <span className="font-medium block">Signage & storage</span>
                              <span className="text-xs text-muted-foreground font-normal">Signage at bin locations and secure storage.</span>
                            </span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 pt-0">
                          <Textarea
                            value={siteControls.signage_storage}
                            onChange={(e) => setSiteControls((prev) => ({ ...prev, signage_storage: e.target.value }))}
                            rows={2}
                            disabled={saveLoading}
                            placeholder={DEFAULT_SITE_CONTROLS.signage_storage}
                            className="bg-muted/30 rounded-lg focus:ring-2 focus:ring-primary/20 border-border max-w-3xl"
                          />
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="contamination_controls" className="rounded-lg border border-border/50 overflow-hidden bg-card">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline [&>svg]:shrink-0">
                          <span className="flex items-center gap-3">
                            <Trash2 className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="text-left">
                              <span className="font-medium block">Contamination controls</span>
                              <span className="text-xs text-muted-foreground font-normal">Checks and re-sorting to prevent cross-contamination.</span>
                            </span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 pt-0">
                          <Textarea
                            value={siteControls.contamination_controls}
                            onChange={(e) => setSiteControls((prev) => ({ ...prev, contamination_controls: e.target.value }))}
                            rows={2}
                            disabled={saveLoading}
                            placeholder={DEFAULT_SITE_CONTROLS.contamination_controls}
                            className="bg-muted/30 rounded-lg focus:ring-2 focus:ring-primary/20 border-border max-w-3xl"
                          />
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="hazardous_controls" className="rounded-lg border border-border/50 overflow-hidden bg-card">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline [&>svg]:shrink-0">
                          <span className="flex items-center gap-3">
                            <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="text-left">
                              <span className="font-medium block">Hazardous controls</span>
                              <span className="text-xs text-muted-foreground font-normal">Separation, containment, and removal of hazardous materials.</span>
                            </span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 pt-0">
                          <Textarea
                            value={siteControls.hazardous_controls}
                            onChange={(e) => setSiteControls((prev) => ({ ...prev, hazardous_controls: e.target.value }))}
                            rows={2}
                            disabled={saveLoading}
                            placeholder={DEFAULT_SITE_CONTROLS.hazardous_controls}
                            className="bg-muted/30 rounded-lg focus:ring-2 focus:ring-primary/20 border-border max-w-3xl"
                          />
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </AccordionContent>
              </AccordionItem>
                </Accordion>
              </CollapsibleSectionCard>

                  {/* Review & generate */}
                  <CollapsibleSectionCard
                    id="compliance-notes"
                    icon={<FileText className="size-5" />}
                    title="Review & generate"
                    description="Responsibilities, notes, save inputs, and generate the SWMP document."
                    whyMatters="Final step to produce a compliant Site Waste Management Plan."
                    accent="amber"
                    variant="grouped"
                    stepStatusBadge={getStepStatusBadge("compliance-notes")}
                    checklist={[
                      "Responsibilities and notes (optional)",
                      "Save Inputs",
                      "Generate SWMP when ready",
                    ]}
                  >
                <Accordion type="single" collapsible defaultValue="" className="w-full max-w-full overflow-hidden">
              <AccordionItem value="responsibilities" className="border border-border/50 rounded-lg px-0 mb-2 overflow-hidden">
                <AccordionTrigger className="w-full px-4 py-4 bg-muted/40 hover:bg-muted/60 transition-colors [&[data-state=open]]:bg-muted/60 rounded-t-lg data-[state=open]:rounded-b-none [&>svg]:shrink-0">
                  <span className="flex flex-col items-start text-left gap-0.5">
                    <span className="font-semibold text-lg inline-flex items-center gap-1.5">
                      Responsibilities
                      <InfoTip
                        label="Responsibilities help"
                        content="Roles and parties listed here appear in the final SWMP document. Add or edit as needed."
                        variant="tooltip"
                      />
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {3 + additionalResponsibilities.length} people
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <p className="text-sm text-muted-foreground">Edit roles, parties, and responsibility text. These appear in the generated SWMP.</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAdditionalResponsibilities((prev) => [{ name: "", role: "", responsibilities: "" }, ...prev]);
                          focusNewAdditionalRoleRef.current = true;
                        }}
                        disabled={saveLoading}
                      >
                        + Add role
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {responsibilities.map((r, idx) => (
                        <RoleCard
                          key={idx}
                          value={`role-${idx}`}
                          role={r.role}
                          party={r.party}
                          responsibilities={r.responsibilities}
                          onRoleChange={(v) =>
                            setResponsibilities((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, role: v } : p))
                            )
                          }
                          onPartyChange={(v) =>
                            setResponsibilities((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, party: v } : p))
                            )
                          }
                          onResponsibilitiesChange={(lines) =>
                            setResponsibilities((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, responsibilities: lines } : p))
                            )
                          }
                          disabled={saveLoading}
                          defaultOpen={idx === 0}
                          icon={
                            idx === 0 ? <ClipboardCheck className="size-4 text-emerald-600 dark:text-emerald-400" /> :
                            idx === 1 ? <Building2 className="size-4 text-emerald-600 dark:text-emerald-400" /> :
                            <Users className="size-4 text-emerald-600 dark:text-emerald-400" />
                          }
                        />
                      ))}
                    </div>
                    {additionalResponsibilities.length > 0 ? (
                      <div className="space-y-3 pt-2 border-t border-border/50">
                        <p className="text-sm font-medium text-muted-foreground">Additional people</p>
                        {additionalResponsibilities.map((a, idx) => (
                          <div key={idx} className="rounded-lg border border-border/50 overflow-hidden bg-card">
                            <Accordion type="single" collapsible defaultValue={idx === 0 ? "additional" : ""} className="w-full">
                              <AccordionItem value="additional" className="border-0">
                                <AccordionTrigger className="px-4 py-3 hover:no-underline [&>svg]:shrink-0">
                                  <span className="flex items-center justify-between w-full pr-2">
                                    <span className="text-sm font-medium truncate">{a.role || "New role"}</span>
                                    <span className="flex items-center gap-2 shrink-0">
                                      <Badge variant="secondary" className="font-normal">{a.name || "—"}</Badge>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAdditionalResponsibilities((prev) => prev.filter((_, i) => i !== idx));
                                        }}
                                        disabled={saveLoading}
                                        aria-label="Remove role"
                                      >
                                        <XIcon className="size-4" />
                                      </Button>
                                    </span>
                                  </span>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4 pt-0">
                                  <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium">Name</Label>
                                      <Input
                                        ref={(el) => {
                                          if (idx === 0 && el && focusNewAdditionalRoleRef.current) {
                                            focusNewAdditionalRoleRef.current = false;
                                            requestAnimationFrame(() => el.focus());
                                          }
                                        }}
                                        value={a.name}
                                        onChange={(e) =>
                                          setAdditionalResponsibilities((prev) =>
                                            prev.map((p, i) => (i === idx ? { ...p, name: e.target.value } : p))
                                          )
                                        }
                                        placeholder="Full name"
                                        disabled={saveLoading}
                                        className="bg-background"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-sm font-medium">Role</Label>
                                      <Input
                                        value={a.role}
                                        onChange={(e) =>
                                          setAdditionalResponsibilities((prev) =>
                                            prev.map((p, i) => (i === idx ? { ...p, role: e.target.value } : p))
                                          )
                                        }
                                        placeholder="e.g. Site foreman"
                                        disabled={saveLoading}
                                        className="bg-background"
                                      />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                      <Label className="text-sm font-medium">Email (optional)</Label>
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
                                        className="bg-background"
                                      />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                      <Label className="text-sm font-medium">Phone (optional)</Label>
                                      <Input
                                        value={a.phone ?? ""}
                                        onChange={(e) =>
                                          setAdditionalResponsibilities((prev) =>
                                            prev.map((p, i) => (i === idx ? { ...p, phone: e.target.value || undefined } : p))
                                          )
                                        }
                                        disabled={saveLoading}
                                        className="bg-background"
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2 mt-4">
                                    <Label className="text-sm font-medium">Responsibilities</Label>
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
                                      className="bg-muted/30 rounded-lg focus:ring-2 focus:ring-primary/20 border-border"
                                    />
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="notes" className="border border-border/50 rounded-lg px-0 mb-2 overflow-hidden">
                <AccordionTrigger className="w-full px-4 py-4 bg-muted/40 hover:bg-muted/60 transition-colors [&[data-state=open]]:bg-muted/60 rounded-t-lg data-[state=open]:rounded-b-none [&>svg]:shrink-0">
                  <span className="flex flex-col items-start text-left gap-0.5">
                    <span className="font-semibold text-lg">Notes / Additional Context</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {notes.trim() ? "Set" : "Not set"}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-6 max-w-2xl">
                    <p className="text-sm text-muted-foreground">Use this space for project-specific conditions or council requirements.</p>
                    <TextareaFieldWrapper
                      label="Additional notes (optional)"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Anything site-specific that should be reflected in the SWMP."
                      disabled={saveLoading}
                      rows={4}
                      maxWidth="full"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

                <div className="space-y-4 mt-6">
                  <Button type="submit" variant="primary" size="default" disabled={saveLoading || !requiredOk} className="w-full">
                    {saveLoading ? "Saving…" : "Save Inputs"}
                  </Button>
                  {saveError ? (
                    <Notice type="error" title="Error" message={saveError} />
                  ) : null}
                  {saveMessage ? (
                    <Notice type="success" title="Success" message={saveMessage} />
                  ) : null}
                </div>

                <div className="mt-8 pt-6 border-t border-border">
                  <h3 className="text-base font-semibold mb-2">Generate SWMP</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate the final Site Waste Management Plan document.
                  </p>
                  {generationWarnings.length > 0 && (
                    <Notice
                      type="info"
                      title="Readiness checks"
                      message={`The following items are missing or incomplete. You can still generate; the report will use placeholders where needed.\n\n${generationWarnings.map((w) => `• ${w}`).join("\n")}`}
                      className="mb-4 [&_[data-slot=alert-description]]:whitespace-pre-line"
                    />
                  )}
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
                </div>
              </CollapsibleSectionCard>
                </Accordion>
              </form>

              {/* Sticky bottom-right: Continue to planning */}
              {projectId && (
                <div className="fixed bottom-6 right-6 z-20 print:hidden">
                  <Button
                    type="button"
                    size="lg"
                    className="rounded-full shadow-lg gap-2"
                    onClick={() => router.push(`/projects/${projectId}/swmp`)}
                    disabled={!requiredOk || saveLoading || isGenerating}
                  >
                    <ClipboardCheck className="size-5" />
                    Continue to planning
                  </Button>
                </div>
              )}
            </div>
          </main>
        </div>

        <Dialog open={isGenerating} onOpenChange={() => {}}>
          <DialogContent showCloseButton={false} className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Generating SWMP</DialogTitle>
              <DialogDescription>
                Please wait, this can take up to ~30 seconds.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <div className="h-12 w-12 animate-pulse rounded-full bg-muted" aria-hidden />
              <p className="text-sm text-muted-foreground">Generating…</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}