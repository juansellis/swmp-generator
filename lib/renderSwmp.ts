import type { Swmp } from "./swmpSchema";

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderSwmpHtml(swmp: Swmp): string {
  const wsRows = swmp.waste_streams
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
    .join("");

  const roles = swmp.roles_and_responsibilities
    .map(
      (rr) => `
      <div class="card">
        <div class="card-title">${esc(rr.role)} — ${esc(rr.name_or_party)}</div>
        <ul>
          ${rr.responsibilities.map((x) => `<li>${esc(x)}</li>`).join("")}
        </ul>
      </div>`
    )
    .join("");

  const checklist = swmp.monitoring_and_reporting.checklists
    .map(
      (c) => `
      <tr>
        <td>${esc(c.item)}</td>
        <td>${esc(c.frequency)}</td>
        <td>${esc(c.owner)}</td>
      </tr>`
    )
    .join("");

  const css = `
    <style>
      body { font-family: Arial, sans-serif; color: #111; line-height: 1.35; }
      h1, h2 { margin: 0 0 8px; }
      .meta { color: #444; margin-bottom: 18px; }
      .section { margin: 18px 0; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .box { border: 1px solid #ddd; border-radius: 10px; padding: 12px; background: #fafafa; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
      th { background: #f3f3f3; text-align: left; }
      .card { border: 1px solid #ddd; border-radius: 10px; padding: 10px; background: #fff; margin-bottom: 10px; }
      .card-title { font-weight: 700; margin-bottom: 6px; }
      ul { margin: 6px 0 0 18px; }
    </style>
  `;

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        ${css}
      </head>
      <body>
        <h1>${esc(swmp.title)}</h1>
        <div class="meta">
          <div><strong>Prepared for:</strong> ${esc(swmp.prepared_for)}</div>
          <div><strong>Prepared by:</strong> ${esc(swmp.prepared_by)}</div>
          <div><strong>Date prepared:</strong> ${esc(swmp.date_prepared)}</div>
        </div>

        <div class="section box">
          <h2>Project overview</h2>
          <div class="grid">
            <div><strong>Project:</strong> ${esc(swmp.project_overview.project_name)}</div>
            <div><strong>Type:</strong> ${esc(swmp.project_overview.project_type)}</div>
            <div><strong>Address:</strong> ${esc(swmp.project_overview.address)}</div>
            <div><strong>Region:</strong> ${esc(swmp.project_overview.region)}</div>
            <div style="grid-column: 1 / -1;"><strong>Programme:</strong> ${esc(swmp.project_overview.programme)}</div>
            <div style="grid-column: 1 / -1;">
              <strong>Site constraints:</strong>
              <ul>${swmp.project_overview.site_constraints.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
            </div>
          </div>
        </div>

        <div class="section box">
          <h2>Objectives</h2>
          <div><strong>Diversion target:</strong> ${swmp.objectives.diversion_target_percent}%</div>
          <ul>${swmp.objectives.primary_objectives.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        </div>

        <div class="section box">
          <h2>Roles & responsibilities</h2>
          ${roles}
        </div>

        <div class="section box">
          <h2>Waste streams and handling</h2>
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
            <tbody>${wsRows}</tbody>
          </table>
        </div>

        <div class="section box">
          <h2>On-site separation plan</h2>
          <div><strong>Recommended bin setup</strong></div>
          <ul>${swmp.onsite_separation_plan.bin_setup_recommendation.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>

          <div><strong>Signage and storage</strong></div>
          <ul>${swmp.onsite_separation_plan.signage_and_storage.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>

          <div><strong>Contamination controls</strong></div>
          <ul>${swmp.onsite_separation_plan.contamination_controls.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        </div>

        <div class="section box">
          <h2>Regulated & hazardous materials</h2>
          <div><strong>Flags:</strong> Asbestos=${swmp.regulated_and_hazardous.flags.asbestos ? "Yes" : "No"}, Lead paint=${swmp.regulated_and_hazardous.flags.lead_paint ? "Yes" : "No"}, Contaminated soil=${swmp.regulated_and_hazardous.flags.contaminated_soil ? "Yes" : "No"}</div>
          <ul>${swmp.regulated_and_hazardous.controls.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        </div>

        <div class="section box">
          <h2>Training & communication</h2>
          <div><strong>Induction points</strong></div>
          <ul>${swmp.training_and_comms.induction_points.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          <div><strong>Toolbox talk topics</strong></div>
          <ul>${swmp.training_and_comms.toolbox_talk_topics.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        </div>

        <div class="section box">
          <h2>Monitoring & reporting</h2>
          <div><strong>Cadence:</strong> ${esc(swmp.monitoring_and_reporting.reporting_cadence)}</div>

          <div style="margin-top: 10px;"><strong>Checklist</strong></div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Frequency</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>${checklist}</tbody>
          </table>

          <div style="margin-top: 10px;"><strong>Corrective actions</strong></div>
          <ul>${swmp.monitoring_and_reporting.corrective_actions.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>

          <div><strong>Evidence to keep</strong></div>
          <ul>${swmp.monitoring_and_reporting.evidence_to_keep.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        </div>

        <div class="section box">
          <h2>Assumptions</h2>
          <ul>${swmp.assumptions.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        </div>
      </body>
    </html>
  `;
}
