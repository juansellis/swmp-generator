import type { Swmp } from "./swmpSchema";
import { computeDiversion, planManualQtyToTonnes, type PlanForDiversion } from "./wasteStreamDefaults";
import { getPartnerById as getPartnerByIdPreset } from "./partners/getPartners";
import { getFacilityById as getFacilityByIdPreset } from "./facilities/getFacilities";

export type SwmpRenderLookups = {
  getPartnerById?: (id: string | null | undefined) => { name: string } | null;
  getFacilityById?: (id: string | null | undefined) => { name: string; address?: string | null } | null;
};

/** Forecast item for appendix: item name, purchased qty/unit, excess %, waste tonnes, stream key. */
export type ForecastItemForAppendix = {
  item_name: string;
  quantity: number;
  unit: string;
  excess_percent: number;
  computed_waste_kg: number | null;
  waste_stream_key: string | null;
};

export type SwmpRenderOptions = {
  forecastItems?: ForecastItemForAppendix[];
};

function esc(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function list(items: unknown[]) {
  const safe = Array.isArray(items) ? items : [];
  if (safe.length === 0) return `<div class="muted">—</div>`;
  return `<ul>${safe.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
}

function table(rows: { k: string; v: unknown }[]) {
  return `
  <table class="kv">
    <tbody>
      ${rows
        .map(
          (r) => `
        <tr>
          <th>${esc(r.k)}</th>
          <td>${esc(r.v)}</td>
        </tr>`
        )
        .join("")}
    </tbody>
  </table>`;
}

export function renderSwmpHtml(swmp: Swmp, lookups?: SwmpRenderLookups, options?: SwmpRenderOptions) {
  const getPartnerById = lookups?.getPartnerById ?? getPartnerByIdPreset;
  const getFacilityById = lookups?.getFacilityById ?? getFacilityByIdPreset;
  const forecastItems = options?.forecastItems ?? [];

  const primary = swmp.branding.brand_primary ?? "#111111";
  const secondary = swmp.branding.brand_secondary ?? "#666666";

  // Org logo: primary, left. Client logo: right, smaller when present.
  const orgLogo = swmp.branding.org_logo_url ?? null;
  const clientLogo = swmp.branding.client_logo_url ?? null;

  const orgLogoHtml = orgLogo
    ? `<img src="${esc(orgLogo)}" alt="Organisation logo" style="max-height: 44px; object-fit: contain;" />`
    : `<div style="font-size: 14px; color: #666;">Logo</div>`;
  const clientLogoHtml = clientLogo
    ? `<img src="${esc(clientLogo)}" alt="Client logo" style="max-height: 36px; object-fit: contain;" />`
    : "";

  const orgName = swmp.branding.org_name ?? "";
  const clientName = swmp.branding.client_name ?? "";

  type PlanRow = {
    category: string;
    intended_outcomes?: string[];
    outcomes?: string[];
    estimated_qty?: number | null;
    unit?: string | null;
    manual_qty_tonnes?: number | null;
    forecast_qty?: number | null;
    density_kg_m3?: number | null;
    thickness_m?: number | null;
    generated_by?: string | null;
    on_site_management?: string | null;
    destination?: string | null;
    destination_override?: string | null;
    partner_id?: string | null;
    facility_id?: string | null;
    distance_km?: number | null;
    partner?: string | null;
    pathway?: string;
  };
  const plansByCategory = new Map<string, PlanRow>();
  for (const p of (swmp.waste_stream_plans ?? []) as PlanRow[]) {
    if (p?.category) plansByCategory.set(p.category, p);
  }
  // Canonical stream names: accept waste_streams as string[] (inputs) or { stream: string }[] (SwmpSchema)
  const rawStreams = swmp.waste_streams ?? [];
  let streams: string[] = Array.isArray(rawStreams)
    ? rawStreams.map((r) => (typeof r === "string" ? r : (r && typeof r === "object" && "stream" in r ? (r as { stream: string }).stream : ""))).filter(Boolean)
    : [];
  if (streams.length === 0 && (swmp.waste_stream_plans ?? []).length > 0) {
    streams = (swmp.waste_stream_plans as PlanRow[]).map((p) => p?.category).filter(Boolean) as string[];
  }
  const getPlan = (stream: string): PlanRow =>
    plansByCategory.get(stream) ?? { category: stream };

  /** Manual quantity in tonnes for display. */
  const manualTonnesDisplay = (p: PlanRow, stream: string) => {
    const tonnes = p.manual_qty_tonnes ?? planManualQtyToTonnes(p, stream);
    if (tonnes != null && tonnes >= 0) return tonnes;
    return 0;
  };
  /** Forecast quantity in tonnes (from allocated forecast items). */
  const forecastTonnesDisplay = (p: PlanRow) => {
    const t = p.forecast_qty;
    if (t != null && !Number.isNaN(t) && t >= 0) return t;
    return 0;
  };
  /** Display quantity in tonnes only (legacy/reporting). */
  const qtyTonnes = (p: PlanRow, stream: string) => {
    const manual = manualTonnesDisplay(p, stream);
    const forecast = forecastTonnesDisplay(p);
    const total = manual + forecast;
    if (total > 0) return `${total.toFixed(3)} tonne`;
    return "—";
  };
  const fmtTonnes = (n: number) => (n > 0 ? n.toFixed(3) : "—");
  const outcomesStr = (p: PlanRow) =>
    (p.intended_outcomes ?? p.outcomes ?? [])[0] ?? "—";

  // Summary: partner name from lookup or legacy partner text
  const partnerDisplay = (p: PlanRow) => {
    const pr = getPartnerById(p.partner_id);
    if (pr?.name) return pr.name;
    return (p.partner ?? "").trim() || "—";
  };
  // Summary & detailed: facility name + address when facility selected, else destination_override (or legacy destination)
  const facilityDisplay = (p: PlanRow) => {
    const fac = getFacilityById(p.facility_id);
    if (fac) return [fac.name, fac.address].filter(Boolean).join(", ") || fac.name;
    const over = (p.destination_override ?? "").trim();
    if (over) return over;
    return (p.destination ?? "").trim() || "—";
  };
  // Detailed table destination: facility name + address or destination_override
  const destinationDisplay = (p: PlanRow) => facilityDisplay(p);
  // Distance as integer km for report
  const distanceKmDisplay = (p: PlanRow) => {
    const km = p.distance_km;
    if (km != null && typeof km === "number" && !Number.isNaN(km) && km >= 0) return String(Math.round(km));
    return "—";
  };
  const derivedPathway = (p: PlanRow) => {
    const stream = p.category || "this stream";
    const dest = destinationDisplay(p);
    const destForPath = dest !== "—" ? dest : "an approved processor";
    const out = outcomesStr(p);
    const forWhat = out && out !== "—" ? out.toLowerCase() : "appropriate recovery";
    return `Segregate ${stream} where practical and send to ${destForPath} for ${forWhat}.`;
  };
  const pathwayText = (p: PlanRow) => {
    const user = (p.pathway ?? "").trim();
    return user || derivedPathway(p);
  };

  const plansForDiversion: PlanForDiversion[] = (swmp.waste_stream_plans ?? []).map((p: PlanRow & { density_kg_m3?: number | null; thickness_m?: number | null; forecast_qty?: number | null }) => ({
    category: p.category,
    estimated_qty: p.estimated_qty ?? null,
    unit: p.unit ?? null,
    density_kg_m3: p.density_kg_m3 ?? null,
    thickness_m: p.thickness_m ?? null,
    intended_outcomes: (p.intended_outcomes ?? p.outcomes ?? [])[0] != null ? [(p.intended_outcomes ?? p.outcomes ?? [])[0]] : [],
    manual_qty_tonnes: p.manual_qty_tonnes ?? undefined,
    forecast_qty_tonnes: p.forecast_qty != null && p.forecast_qty >= 0 ? p.forecast_qty : undefined,
  }));
  const diversionResult = computeDiversion(plansForDiversion);

  // Totals for waste streams table
  let sumManual = 0;
  let sumForecast = 0;
  const streamRows = streams.map((stream) => {
    const p = getPlan(stream);
    const manual = manualTonnesDisplay(p, stream);
    const forecast = forecastTonnesDisplay(p);
    sumManual += manual;
    sumForecast += forecast;
    return { stream, p, manual, forecast, total: manual + forecast };
  });
  const grandTotal = sumManual + sumForecast;

  // A) Waste Streams (hero): Manual / Forecast / Total tonnes, outcomes, Partner, Facility
  const wasteStreamsAnticipatedTable = `
    <div class="table-waste-streams-wrapper">
    <table class="report-table table-waste-streams" role="grid">
      <thead>
        <tr>
          <th class="col-stream th-wrap">Waste stream</th>
          <th class="col-num th-wrap">Manual estimate (tonnes)</th>
          <th class="col-num th-wrap">Forecast estimate (tonnes)</th>
          <th class="col-num th-wrap">Total expected (tonnes)</th>
          <th class="col-outcomes th-wrap">Intended outcomes</th>
          <th class="col-partner th-wrap">Partner</th>
          <th class="col-facility th-wrap">Facility</th>
        </tr>
      </thead>
      <tbody>
        ${streamRows
          .map(
            ({ stream, p, manual, forecast, total }) => {
              const partnerText = partnerDisplay(p);
              const facilityText = facilityDisplay(p);
              return `
          <tr>
            <td class="cell-wrap">${esc(stream)}</td>
            <td class="col-num tabular-nums">${esc(fmtTonnes(manual))}</td>
            <td class="col-num tabular-nums">${esc(fmtTonnes(forecast))}</td>
            <td class="col-num tabular-nums">${esc(fmtTonnes(total))}</td>
            <td class="cell-wrap">${esc(outcomesStr(p))}</td>
            <td class="cell-wrap col-partner"><span class="cell-clamp-inner" title="${esc(partnerText)}">${esc(partnerText)}</span></td>
            <td class="cell-wrap col-facility"><span class="cell-clamp-inner" title="${esc(facilityText)}">${esc(facilityText) || "—"}</span></td>
          </tr>`;
            }
          )
          .join("")}
        <tr class="totals-row">
          <td class="cell-wrap"><strong>Total</strong></td>
          <td class="col-num tabular-nums"><strong>${esc(fmtTonnes(sumManual))}</strong></td>
          <td class="col-num tabular-nums"><strong>${esc(fmtTonnes(sumForecast))}</strong></td>
          <td class="col-num tabular-nums"><strong>${esc(fmtTonnes(grandTotal))}</strong></td>
          <td class="cell-wrap" colspan="3"></td>
        </tr>
      </tbody>
    </table>
    </div>
    <p class="muted forecast-note" style="margin-top: 10px; font-size: 12px;">
      Forecast estimates are derived from purchased quantities and waste factors entered in the Forecast tab.
    </p>`;

  // Forecast Items Summary appendix (grouped by stream)
  const allocatedForecastItems = forecastItems.filter(
    (i) => (i.waste_stream_key ?? "").trim() !== "" && i.computed_waste_kg != null && i.computed_waste_kg >= 0
  );
  const byStream = new Map<string, typeof allocatedForecastItems>();
  for (const item of allocatedForecastItems) {
    const key = (item.waste_stream_key ?? "Unallocated").trim();
    if (!byStream.has(key)) byStream.set(key, []);
    byStream.get(key)!.push(item);
  }
  const streamOrder = streams.length ? streams : Array.from(byStream.keys()).sort();
  const forecastItemsAppendix =
    byStream.size > 0
      ? `
    <h2>Appendix: Forecast Items Summary</h2>
    <p class="muted" style="margin-bottom: 12px; font-size: 12px;">Items allocated to waste streams; forecast waste in tonnes from purchased quantity and excess %.</p>
    ${streamOrder
      .filter((s) => byStream.has(s))
      .map(
        (stream) => {
          const items = byStream.get(stream)!;
          return `
    <div class="forecast-stream-block" style="margin-bottom: 18px;">
      <h3 class="appendix-stream-title" style="font-size: 14px; margin: 0 0 8px; color: var(--secondary);">${esc(stream)}</h3>
      <table class="report-table table-forecast-items">
        <thead>
          <tr>
            <th class="cell-wrap">Item</th>
            <th class="col-num">Purchased qty</th>
            <th class="col-num">Excess %</th>
            <th class="col-num">Forecast waste (tonnes)</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (i) => `
            <tr>
              <td class="cell-wrap">${esc(i.item_name || "—")}</td>
              <td class="col-num">${esc(Number.isFinite(i.quantity) ? `${i.quantity} ${i.unit || ""}`.trim() : "—")}</td>
              <td class="col-num">${esc(Number.isFinite(i.excess_percent) ? `${i.excess_percent}%` : "—")}</td>
              <td class="col-num">${esc(i.computed_waste_kg != null ? (i.computed_waste_kg / 1000).toFixed(3) : "—")}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
        }
      )
      .join("")}`
      : "";

  // B) Detailed: Waste Stream Plans (how generated, on-site, destination, distance, pathway)
  const plansDetailedTable = `
    <table class="report-table table-detailed">
      <thead>
        <tr>
          <th class="col-p16">Waste stream</th>
          <th class="col-p19">How generated</th>
          <th class="col-p19">On-site management</th>
          <th class="col-p19">Destination</th>
          <th class="col-p10">Distance (km)</th>
          <th class="col-p17">Planned pathway</th>
        </tr>
      </thead>
      <tbody>
        ${streams
          .map(
            (stream) => {
              const p = getPlan(stream);
              return `
          <tr>
            <td class="cell-wrap">${esc(stream)}</td>
            <td class="cell-wrap">${esc(p.generated_by ?? "—")}</td>
            <td class="cell-wrap">${esc(p.on_site_management ?? "—")}</td>
            <td class="cell-wrap">${esc(destinationDisplay(p))}</td>
            <td class="col-num">${esc(distanceKmDisplay(p))}</td>
            <td class="cell-wrap">${esc(pathwayText(p))}</td>
          </tr>`;
            }
          )
          .join("")}
      </tbody>
    </table>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(swmp.report_title)}</title>
  <style>
    :root { --primary: ${primary}; --secondary: ${secondary}; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #111; background: #f6f7f9; }
    .page { max-width: 980px; margin: 0 auto; padding: 24px 18px 40px; }
    .card { background: #fff; border: 1px solid #eaeaea; border-radius: 14px; padding: 18px; box-shadow: 0 1px 10px rgba(0,0,0,0.03); }
    .header { display:flex; justify-content: space-between; gap: 14px; align-items: center; padding: 16px; border-radius: 14px; background: #fff; border: 1px solid #eaeaea; flex-wrap: wrap; }
    .logos { display:flex; gap: 14px; align-items: center; flex-wrap: wrap; }
    .logos img { object-fit: contain; }
    .logos .org-logo { max-height: 44px; max-width: 200px; }
    .logos .client-logo { max-height: 36px; max-width: 120px; }
    h1 { margin: 0; font-size: 22px; }
    h2 { margin: 18px 0 10px; font-size: 15px; border-left: 3px solid var(--primary); padding-left: 10px; color: var(--primary); }
    .muted { color: #555; font-size: 12px; }
    .pill { display:inline-block; padding: 6px 10px; border-radius: 999px; border: 1px solid #eee; background: #fafafa; font-size: 12px; color: #222; }
    .grid2 { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .report-table th { padding: 12px; border: 1px solid #e5e7eb; font-weight: 700; background: #f8fafc; vertical-align: top; }
    .report-table td { padding: 12px; border: 1px solid #e5e7eb; vertical-align: top; overflow-wrap: break-word; word-break: break-word; }
    /* All table headers: wrap onto 2–3 lines so they stay in their columns */
    .report-table thead th { white-space: normal !important; word-break: break-word; overflow-wrap: break-word; min-width: 0; line-height: 1.25; }
    th, td { border: 1px solid #e5e7eb; vertical-align: top; overflow-wrap: break-word; word-break: break-word; }
    th { background: #f8fafc; font-weight: 700; padding: 12px; }
    td { padding: 12px; }
    table.kv th { width: 34%; color: #111; background: #fcfcfc; }
    .table-summary { font-size: 12px; }
    .table-summary th, .table-summary td { padding: 10px 12px; }
    .table-detailed th, .table-detailed td { padding: 12px; }
    .cell-wrap { overflow-wrap: break-word; word-break: break-word; }
    .col-num { text-align: right; font-variant-numeric: tabular-nums; }
    .tabular-nums { font-variant-numeric: tabular-nums; }
    .col-w26 { width: 26%; }
    .col-w22 { width: 22%; }
    .col-w20 { width: 20%; }
    .col-w16 { width: 16%; }
    .col-w14 { width: 14%; }
    .col-w28 { width: 28%; }
    .col-w30 { width: 30%; }
    .col-p16 { width: 16%; }
    .col-p19 { width: 19%; }
    .col-p10 { width: 10%; }
    .col-p17 { width: 17%; }
    /* Waste Stream Plans (detailed) table: headers wrap so "Distance (km)" etc stay in column */
    .table-detailed thead th { white-space: normal !important; word-break: break-word; overflow-wrap: break-word; min-width: 0; line-height: 1.25; }
    .table-detailed { table-layout: fixed; }
    /* Waste Streams table: fixed layout, no header overlap, export-ready */
    .table-waste-streams-wrapper { overflow-x: auto; margin-top: 8px; min-width: 0; }
    .table-waste-streams { table-layout: fixed; width: 100%; min-width: 640px; margin: 0; }
    .table-waste-streams thead th { white-space: normal !important; word-break: break-word; overflow-wrap: break-word; min-width: 0; line-height: 1.25; }
    .table-waste-streams .th-wrap { text-align: left; }
    .table-waste-streams .col-num.th-wrap { text-align: right; }
    .table-waste-streams th, .table-waste-streams td { padding: 12px; }
    .table-waste-streams .col-stream { width: 18%; }
    .table-waste-streams .col-num { width: 12%; }
    .table-waste-streams .col-outcomes { width: 16%; }
    .table-waste-streams td.col-partner, .table-waste-streams th.col-partner { width: 15%; min-width: 0; }
    .table-waste-streams td.col-facility, .table-waste-streams th.col-facility { width: 15%; min-width: 0; }
    .table-waste-streams tbody tr:not(.totals-row):nth-child(odd) { background: #f4f4f5; }
    .table-waste-streams .cell-clamp-inner { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; max-width: 100%; }
    .totals-row { background: #f1f5f9; border-top: 2px solid #e2e8f0; }
    .totals-row td { font-weight: 600; }
    .table-forecast-items th, .table-forecast-items td { padding: 10px 12px; font-size: 12px; }
    ul { margin: 8px 0 0; padding-left: 18px; }
    .footer { margin-top: 18px; font-size: 12px; color: #555; display:flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    /* Export / Print mode */
    @media print {
      body { background: #fff !important; color: #111 !important; }
      .page { padding: 12px 16px; max-width: 100%; }
      .card { box-shadow: none !important; border-color: #e5e7eb; }
      .table-waste-streams-wrapper { overflow: visible; }
      .table-waste-streams { min-width: 0; }
      .table-waste-streams tbody tr:not(.totals-row):nth-child(odd) { background: #f8fafc; }
      .totals-row { background: #f1f5f9 !important; }
      thead { display: table-header-group; }
      .card, table, tr { break-inside: avoid; }
      .report-table th, .report-table td { padding: 10px 12px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logos">
        <div class="org-logo">${orgLogoHtml}</div>
        <div>
          <div style="font-weight:700;">${esc(swmp.report_title)}</div>
          <div class="muted">${esc(orgName)}${orgName && clientName ? " • " : ""}${esc(clientName)}</div>
        </div>
        ${clientLogoHtml ? `<div class="client-logo">${clientLogoHtml}</div>` : ""}
      </div>
      <div class="pill">Prepared: ${esc(swmp.date_prepared)}</div>
    </div>

    <div class="card" style="margin-top: 14px;">
      <h1>${esc(swmp.project.project_name)}</h1>
      <div class="muted" style="margin-top: 6px;">${esc(swmp.project.site_address)} • ${esc(swmp.project.region)} • ${esc(swmp.project.project_type)}</div>

      <div class="grid2" style="margin-top: 12px;">
        <div>
          <h2>Project details</h2>
          ${table([
            { k: "Site address", v: swmp.project.site_address },
            { k: "Region", v: swmp.project.region },
            { k: "Project type", v: swmp.project.project_type },
            { k: "Start date", v: swmp.project.start_date ?? "—" },
            { k: "End date", v: swmp.project.end_date ?? "—" },
            { k: "Client", v: clientName || "—" },
            { k: "Main contractor", v: swmp.project.main_contractor },
            { k: "SWMP owner", v: swmp.project.swmp_owner },
            { k: "Primary waste contractor", v: (swmp.project as { primary_waste_contractor_name?: string })?.primary_waste_contractor_name ?? "—" },
          ])}
        </div>
        <div>
          <h2>Objectives</h2>
          <div style="font-size: 13px;">
            <div><strong>Diversion target:</strong> ${esc(swmp.objectives.diversion_target_percent)}%</div>
            ${list(swmp.objectives.primary_objectives)}
          </div>
        </div>
      </div>

      <h2>Responsibilities</h2>
      <table class="report-table">
        <thead><tr><th class="cell-wrap">Role</th><th class="cell-wrap">Party</th><th class="cell-wrap">Responsibilities</th></tr></thead>
        <tbody>
          ${swmp.responsibilities
            .map(
              (r) => `
            <tr>
              <td class="cell-wrap">${esc(r.role)}</td>
              <td class="cell-wrap">${esc(r.party)}</td>
              <td class="cell-wrap">${(r.responsibilities ?? []).map((x) => esc(x)).join("<br/>")}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>

      <h2 style="margin-top: 24px;">Waste Streams</h2>
      <p class="muted" style="margin-bottom: 8px;">Manual and forecast quantities by stream. Total expected = manual estimate + forecast estimate.</p>
      ${wasteStreamsAnticipatedTable}

      <h2>Waste Stream Plans</h2>
      ${plansDetailedTable}

      <h2>Diversion summary</h2>
      <div class="cell-wrap" style="font-size: 13px;">
        <p style="margin-bottom: 10px;">
          <strong>Diversion (Reuse+Recycle) %:</strong> ${diversionResult.totalTonnes > 0 ? diversionResult.diversionReuseRecyclePct.toFixed(1) : "—"}% &nbsp;|&nbsp;
          <strong>Landfill avoidance (incl. Cleanfill) %:</strong> ${diversionResult.totalTonnes > 0 ? diversionResult.landfillAvoidancePct.toFixed(1) : "—"}% &nbsp;|&nbsp;
          <strong>Total estimated tonnes:</strong> ${diversionResult.totalTonnes > 0 ? diversionResult.totalTonnes.toFixed(2) : "—"}
        </p>
        <p class="muted" style="font-size: 12px;">
          Diversion is the share of estimated waste (by tonnes) sent to Reuse or Recycle. Landfill avoidance also counts material sent to Cleanfill. Totals are derived from stream quantities and densities where provided.
        </p>
      </div>

      <h2>On-site controls</h2>
      <div class="grid2">
        <div>
          <div><strong>Signage & storage</strong></div>
          ${list(swmp.on_site_controls.signage_and_storage)}
        </div>
        <div>
          <div><strong>Contamination controls</strong></div>
          ${list(swmp.on_site_controls.contamination_controls)}
        </div>
        <div>
          <div><strong>Hazardous controls</strong></div>
          ${list(swmp.on_site_controls.hazardous_controls)}
        </div>
      </div>

      <h2>Monitoring &amp; reporting</h2>
      ${table([
        { k: "Evidence methods", v: (swmp.monitoring.methods ?? []).join(", ") || "—" },
        { k: "Uses software", v: swmp.monitoring.uses_software ? "Yes" : "No" },
        { k: "Software name", v: (swmp.monitoring.software_name ?? "").trim() || "—" },
        { k: "Reporting cadence", v: swmp.records_and_evidence.reporting_cadence },
      ])}
      ${swmp.monitoring.dockets_description ? `<div class="evidence-wording" style="margin-top:10px; font-size:13px;"><strong>Evidence wording</strong><p>${esc(swmp.monitoring.dockets_description)}</p></div>` : ""}

      <h2>Assumptions</h2>
      ${list(swmp.assumptions)}
      ${(swmp.records_and_evidence.notes ?? "").trim() ? `<h2>Notes / additional context</h2><div class="cell-wrap" style="font-size:13px;">${String(swmp.records_and_evidence.notes ?? "")
        .split(/\r?\n/)
        .map((line) => esc(line))
        .join("<br/>")}</div>` : ""}
      ${forecastItemsAppendix}

      <div class="footer">
        <div>${esc(swmp.footer_text)}</div>
        <div>${esc(orgName)}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
