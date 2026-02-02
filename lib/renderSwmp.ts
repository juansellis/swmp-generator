import type { Swmp } from "./swmpSchema";
import { computeDiversion, type PlanForDiversion } from "./wasteStreamDefaults";
import { getPartnerById } from "./partners/getPartners";
import { getFacilityById } from "./facilities/getFacilities";

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

export function renderSwmpHtml(swmp: Swmp) {
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
  const streams = (swmp.waste_streams ?? []).map((r) => r.stream);
  const getPlan = (stream: string): PlanRow =>
    plansByCategory.get(stream) ?? { category: stream };

  const qtyUnit = (p: PlanRow) => {
    if (p.estimated_qty != null && p.estimated_qty >= 0) {
      const u = p.unit ?? "t";
      return `${p.estimated_qty} ${u === "m3" ? "m³" : u === "m2" ? "m²" : u}`;
    }
    return "—";
  };
  const outcomesStr = (p: PlanRow) =>
    (p.intended_outcomes ?? p.outcomes ?? []).join(", ") || "—";

  // Facility name + address, or destination_override (custom text when no facility / Other)
  const destinationDisplay = (p: PlanRow) => {
    const fac = getFacilityById(p.facility_id);
    if (fac) return [fac.name, fac.address].filter(Boolean).join(", ") || fac.name;
    const over = (p.destination_override ?? "").trim();
    if (over) return over;
    return (p.destination ?? "").trim() || "—";
  };
  const partnerDisplay = (p: PlanRow) => {
    const pr = getPartnerById(p.partner_id);
    if (pr) return pr.name;
    const over = (p.destination_override ?? "").trim();
    if (over) return over;
    return (p.partner ?? "").trim() || "—";
  };
  const facilityDisplay = (p: PlanRow) => {
    const fac = getFacilityById(p.facility_id);
    if (fac) return [fac.name, fac.address].filter(Boolean).join(", ") || fac.name;
    const over = (p.destination_override ?? "").trim();
    if (over) return over;
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

  const plansForDiversion: PlanForDiversion[] = (swmp.waste_stream_plans ?? []).map((p: PlanRow & { density_kg_m3?: number | null; thickness_m?: number | null }) => ({
    category: p.category,
    estimated_qty: p.estimated_qty ?? null,
    unit: p.unit ?? null,
    density_kg_m3: p.density_kg_m3 ?? null,
    thickness_m: p.thickness_m ?? null,
    intended_outcomes: p.intended_outcomes ?? p.outcomes ?? [],
  }));
  const diversionResult = computeDiversion(plansForDiversion);

  // A) Summary: Waste Streams Anticipated (qty, outcomes, Partner, Facility)
  const wasteStreamsAnticipatedTable = `
    <table class="report-table table-summary">
      <thead>
        <tr>
          <th class="col-w22">Waste stream</th>
          <th class="col-w14">Est. quantity &amp; unit</th>
          <th class="col-w22">Intended outcomes</th>
          <th class="col-w20">Partner</th>
          <th class="col-w22">Facility</th>
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
            <td class="cell-wrap">${esc(qtyUnit(p))}</td>
            <td class="cell-wrap">${esc(outcomesStr(p))}</td>
            <td class="cell-wrap">${esc(partnerDisplay(p))}</td>
            <td class="cell-wrap">${esc(facilityDisplay(p))}</td>
          </tr>`;
            }
          )
          .join("")}
      </tbody>
    </table>`;

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
            <td class="col-num">${p.distance_km != null && p.distance_km >= 0 ? esc(p.distance_km) : "—"}</td>
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
    table { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
    .report-table th { padding: 10px 12px; border: 1px solid #e5e7eb; text-align: left; font-weight: 700; white-space: nowrap; background: #f8fafc; }
    .report-table td { padding: 10px 12px; border: 1px solid #e5e7eb; vertical-align: top; word-break: break-word; }
    th, td { border: 1px solid #e5e7eb; vertical-align: top; text-align: left; overflow-wrap: break-word; word-break: break-word; }
    th { background: #f8fafc; font-weight: 700; padding: 10px 12px; white-space: nowrap; }
    td { padding: 10px 12px; }
    table.kv th { width: 34%; color: #111; background: #fcfcfc; }
    .table-summary { font-size: 12px; }
    .table-summary th, .table-summary td { padding: 10px 12px; }
    .table-detailed th, .table-detailed td { padding: 10px 12px; }
    .cell-wrap { overflow-wrap: break-word; word-break: break-word; }
    .col-num { text-align: right; white-space: nowrap; }
    .col-w26 { width: 26%; }
    .col-w22 { width: 22%; }
    .col-w20 { width: 20%; }
    .col-w16 { width: 16%; }
    .col-w14 { width: 14%; }
    .col-w28 { width: 28%; }
    .col-w30 { width: 30%; }
    .col-p16 { width: 16%; }
    .col-p19 { width: 19%; }
    .col-p10 { width: 10%; white-space: nowrap; }
    .col-p17 { width: 17%; }
    ul { margin: 8px 0 0; padding-left: 18px; }
    .footer { margin-top: 18px; font-size: 12px; color: #555; display:flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    @media print { body { background: #fff; } .page { padding: 12px 16px; max-width: 100%; } .card { box-shadow: none; } }
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

      <h2>Waste Streams Anticipated</h2>
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
          <div><strong>Bin setup</strong></div>
          ${list(swmp.on_site_controls.bin_setup)}
        </div>
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

      <div class="footer">
        <div>${esc(swmp.footer_text)}</div>
        <div>${esc(orgName)}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
