import type { Swmp } from "./swmpSchema";

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

type Brand = {
  org_name?: string;
  logo_url?: string | null;
  brand_primary?: string | null;
  brand_secondary?: string | null;
  footer_text?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website?: string | null;
};

export function renderSwmpHtml(
  swmp: any,
  brand?: {
    org_name?: string;
    logo_url?: string | null;
    brand_primary?: string | null;
    brand_secondary?: string | null;
    footer_text?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    website?: string | null;
  }
) {
  const primary = brand?.brand_primary ?? "#111111";
  const secondary = brand?.brand_secondary ?? "#666666";
  const logo = brand?.logo_url ?? "";
  const orgName = brand?.org_name ?? "";
  const footer = brand?.footer_text ?? "";

  const safe = (v: any) => (v === null || v === undefined ? "" : String(v));

  const wasteRows = Array.isArray(swmp?.waste_streams) ? swmp.waste_streams : [];

  const wasteTable = wasteRows
    .map(
      (r: any) => `
      <tr>
        <td>${safe(r.stream)}</td>
        <td>${safe(r.segregation_method)}</td>
        <td>${safe(r.container)}</td>
        <td>${safe(r.destination)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safe(swmp?.title ?? "SWMP")}</title>
  <style>
    :root {
      --primary: ${primary};
      --secondary: ${secondary};
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      background: #f6f7f9;
      color: #111;
    }
    .page {
      max-width: 900px;
      margin: 0 auto;
      padding: 28px 18px 40px;
    }
    .card {
      background: #fff;
      border: 1px solid #eee;
      border-radius: 14px;
      padding: 18px;
      box-shadow: 0 1px 10px rgba(0,0,0,0.03);
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 18px;
      border-radius: 14px;
      background: linear-gradient(135deg, rgba(0,0,0,0.03), rgba(0,0,0,0.00));
      border: 1px solid #eee;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand img {
      height: 44px;
      object-fit: contain;
    }
    .brand .name {
      font-weight: 700;
      letter-spacing: 0.2px;
    }
    h1 {
      margin: 0;
      font-size: 22px;
    }
    h2 {
      margin: 18px 0 10px;
      font-size: 16px;
      border-left: 3px solid var(--primary);
      padding-left: 10px;
    }
    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 12px;
      font-size: 13px;
      color: #222;
    }
    .meta div {
      padding: 10px;
      border: 1px solid #eee;
      border-radius: 10px;
      background: #fff;
    }
    .label {
      color: var(--secondary);
      font-size: 12px;
      margin-bottom: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 13px;
    }
    th, td {
      border: 1px solid #eee;
      text-align: left;
      padding: 10px;
      vertical-align: top;
    }
    th {
      background: #fafafa;
      color: #111;
    }
    .footer {
      margin-top: 18px;
      font-size: 12px;
      color: #555;
      display: flex;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .pill {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid #eee;
      background: #fff;
      font-size: 12px;
      color: #222;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="topbar">
      <div class="brand">
        ${logo ? `<img src="${logo}" alt="Logo" />` : ""}
        <div>
          <div class="name">${safe(orgName)}</div>
          <div style="color: var(--secondary); font-size: 12px;">NZ-first Site Waste Management Plan</div>
        </div>
      </div>
      <div class="pill">Prepared: ${safe(swmp?.date_prepared)}</div>
    </div>

    <div class="card" style="margin-top: 14px;">
      <h1>${safe(swmp?.title ?? "Site Waste Management Plan (SWMP)")}</h1>

      <div class="meta">
        <div>
          <div class="label">Project</div>
          <div><strong>${safe(swmp?.project_overview?.project_name)}</strong></div>
          <div style="margin-top: 6px; color:#555;">${safe(swmp?.project_overview?.address)}</div>
        </div>

        <div>
          <div class="label">Prepared by / for</div>
          <div><strong>${safe(swmp?.prepared_by)}</strong></div>
          <div style="margin-top: 6px; color:#555;">For: ${safe(swmp?.prepared_for)}</div>
        </div>
      </div>

      <h2>Objectives</h2>
      <div style="font-size: 13px;">
        <div><strong>Diversion target:</strong> ${safe(swmp?.objectives?.diversion_target_percent)}%</div>
        <ul>
          ${(swmp?.objectives?.primary_objectives ?? []).map((x: any) => `<li>${safe(x)}</li>`).join("")}
        </ul>
      </div>

      <h2>Waste Streams</h2>
      <table>
        <thead>
          <tr>
            <th>Stream</th>
            <th>Segregation</th>
            <th>Container</th>
            <th>Destination</th>
          </tr>
        </thead>
        <tbody>
          ${wasteTable || `<tr><td colspan="4">No waste streams provided.</td></tr>`}
        </tbody>
      </table>

      <h2>On-site Separation Plan</h2>
      <div style="font-size: 13px;">
        <div><strong>Bin setup:</strong></div>
        <ul>${(swmp?.onsite_separation_plan?.bin_setup_recommendation ?? []).map((x: any) => `<li>${safe(x)}</li>`).join("")}</ul>

        <div style="margin-top: 10px;"><strong>Signage & storage:</strong></div>
        <ul>${(swmp?.onsite_separation_plan?.signage_and_storage ?? []).map((x: any) => `<li>${safe(x)}</li>`).join("")}</ul>

        <div style="margin-top: 10px;"><strong>Contamination controls:</strong></div>
        <ul>${(swmp?.onsite_separation_plan?.contamination_controls ?? []).map((x: any) => `<li>${safe(x)}</li>`).join("")}</ul>
      </div>

      <div class="footer">
        <div>${footer ? safe(footer) : ""}</div>
        <div>
          ${brand?.contact_email ? `Email: ${safe(brand.contact_email)} ` : ""}
          ${brand?.contact_phone ? ` | Phone: ${safe(brand.contact_phone)} ` : ""}
          ${brand?.website ? ` | ${safe(brand.website)} ` : ""}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
