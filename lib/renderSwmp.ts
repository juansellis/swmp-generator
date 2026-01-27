import type { Swmp } from "./swmpSchema";

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

  const wasteStreamsTable = `
    <table>
      <thead>
        <tr>
          <th>Stream</th>
          <th>Segregation</th>
          <th>Container</th>
          <th>Destination</th>
          <th>Handling notes</th>
        </tr>
      </thead>
      <tbody>
        ${swmp.waste_streams
          .map(
            (r) => `
          <tr>
            <td>${esc(r.stream)}</td>
            <td>${esc(r.segregation_method)}</td>
            <td>${esc(r.container)}</td>
            <td>${esc(r.destination)}</td>
            <td>${esc(r.handling_notes)}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;

  const plansTable = `
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th>Sub-material</th>
          <th>Outcomes</th>
          <th>Partner</th>
          <th>Planned pathway</th>
        </tr>
      </thead>
      <tbody>
        ${(swmp.waste_stream_plans ?? [])
          .map(
            (p) => `
          <tr>
            <td>${esc(p.category)}</td>
            <td>${esc(p.sub_material ?? "")}</td>
            <td>${esc((p.outcomes ?? []).join(", "))}</td>
            <td>${esc(p.partner ?? "")}</td>
            <td>${esc(p.pathway)}</td>
          </tr>`
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
    th, td { border: 1px solid #eee; padding: 10px; vertical-align: top; text-align: left; }
    th { background: #fafafa; }
    table.kv th { width: 34%; color: #111; background: #fcfcfc; }
    ul { margin: 8px 0 0; padding-left: 18px; }
    .footer { margin-top: 18px; font-size: 12px; color: #555; display:flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    @media print { body { background: #fff; } .page { padding: 0; } .card { box-shadow: none; } }
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
            { k: "Start date", v: swmp.project.start_date ?? "—" },
            { k: "End date", v: swmp.project.end_date ?? "—" },
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
      <table>
        <thead><tr><th>Role</th><th>Party</th><th>Responsibilities</th></tr></thead>
        <tbody>
          ${swmp.responsibilities
            .map(
              (r) => `
            <tr>
              <td>${esc(r.role)}</td>
              <td>${esc(r.party)}</td>
              <td>${(r.responsibilities ?? []).map((x) => esc(x)).join("<br/>")}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>

      <h2>Waste streams</h2>
      ${wasteStreamsTable}

      <h2>Waste stream plans</h2>
      ${plansTable}

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

      <h2>Monitoring</h2>
      ${table([
        { k: "Reporting cadence", v: swmp.records_and_evidence.reporting_cadence },
        { k: "Evidence methods", v: (swmp.monitoring.methods ?? []).join(", ") },
        { k: "Uses software", v: swmp.monitoring.uses_software ? "Yes" : "No" },
        { k: "Software name", v: swmp.monitoring.software_name ?? "—" },
      ])}
      ${swmp.monitoring.dockets_description ? `<div style="margin-top:10px; font-size:13px;">${esc(swmp.monitoring.dockets_description)}</div>` : ""}

      <h2>Records & evidence</h2>
      <div class="grid2">
        <div>
          <div><strong>Records to keep</strong></div>
          ${list(swmp.records_and_evidence.record_retention)}
        </div>
        <div>
          <div><strong>Evidence methods</strong></div>
          ${list(swmp.records_and_evidence.evidence_methods)}
        </div>
      </div>

      <h2>Assumptions</h2>
      ${list(swmp.assumptions)}

      <div class="footer">
        <div>${esc(swmp.footer_text)}</div>
        <div>${esc(orgName)}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
