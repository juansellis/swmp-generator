"use client";

import React, { useCallback, useState } from "react";
import Image from "next/image";
import type { ReportExportData } from "@/app/api/projects/[id]/report-export/route";
import type { StreamPlanItem } from "@/lib/planning/wasteStrategyBuilder";
import { ExportChartsSection } from "./ExportChartsSection";

const PAGE_BREAK = "page-break";

type Props = {
  data: ReportExportData;
  projectName: string;
};

function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return "—";
  }
}

export function ReportPrintDocument({ data, projectName }: Props) {
  const {
    project,
    wasteStrategy,
    chartData,
    chartInputs,
    planningChecklist,
    forecastItems,
    branding,
    preparedAt,
    primaryWasteContractorName,
    streamExportDisplays,
    siteControls,
    monitoring,
    responsibilities,
    additional_responsibilities,
    notes,
  } = data;
  const reportTitle = project.report_title?.trim() || "Site Waste Management Plan (SWMP)";
  const siteAddress = project.site_address?.trim() || project.address?.trim() || "—";
  const streams = wasteStrategy?.streamPlans ?? [];
  const plansByCategory = new Map<string, { generated_by?: string | null; on_site_management?: string | null; pathway?: string | null }>();
  for (const p of chartInputs?.waste_stream_plans ?? []) {
    const cat = (p as { category?: string }).category;
    if (cat)
      plansByCategory.set(cat, {
        generated_by: (p as { generated_by?: string }).generated_by,
        on_site_management: (p as { on_site_management?: string }).on_site_management,
        pathway: (p as { pathway?: string }).pathway,
      });
  }
  const getPlanDetails = (streamName: string) =>
    plansByCategory.get(streamName) ?? {};
  const getStreamDisplay = (streamName: string) =>
    streamExportDisplays?.[streamName] ?? { destinationDisplay: "Not set", distanceDisplay: "" };

  const [chartsReady, setChartsReady] = useState(false);
  const handleChartsReady = useCallback(() => setChartsReady(true), []);

  return (
    <div className="report-print-document print-doc bg-white text-gray-900 print-container">
      {/* Playwright waits for this before capturing PDF */}
      <div data-export-ready={chartsReady ? "true" : "false"} aria-hidden className="hidden" />
      {/* Cover — Page 1: brand strip above, then title and details (no overlap) */}
      <section className="cover min-h-[calc(100vh-20mm)] print:min-h-0 flex flex-col print:flex-shrink-0">
        <div className="flex flex-col p-0">
          {/* Brand strip: reserved height, normal flow */}
          <div className="cover-brand-strip flex items-center justify-between gap-6 mb-6 min-h-[3rem]">
            {branding.org_logo_url ? (
              <Image
                src={branding.org_logo_url}
                alt="Organisation logo"
                width={144}
                height={48}
                className="h-12 w-auto max-w-[120px] object-contain"
                unoptimized
              />
            ) : (
              <span className="text-lg font-semibold text-gray-600">WasteX</span>
            )}
            {branding.client_logo_url && (
              <Image
                src={branding.client_logo_url}
                alt="Client logo"
                width={120}
                height={48}
                className="h-12 w-auto max-w-[120px] object-contain"
                unoptimized
              />
            )}
            {!branding.client_logo_url && <span aria-hidden />}
          </div>
          <div className="h-px bg-gray-200 mb-6" aria-hidden />
          <h1 className="report-h1 mt-0 text-2xl font-semibold leading-tight">{reportTitle}</h1>
          <p className="mt-1 text-sm text-gray-500">{project.name || "—"}</p>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
            <table className="w-full max-w-md">
              <tbody>
                <tr>
                  <td className="py-1 pr-4 font-medium text-gray-600 w-40">Project name</td>
                  <td className="py-1">{project.name || "—"}</td>
                </tr>
                <tr>
                  <td className="py-1 pr-4 font-medium text-gray-600">Site address</td>
                  <td className="py-1">{siteAddress}</td>
                </tr>
                <tr>
                  <td className="py-1 pr-4 font-medium text-gray-600">Region</td>
                  <td className="py-1">{project.region || "—"}</td>
                </tr>
                <tr>
                  <td className="py-1 pr-4 font-medium text-gray-600">Project type</td>
                  <td className="py-1">{project.project_type || "—"}</td>
                </tr>
                <tr>
                  <td className="py-1 pr-4 font-medium text-gray-600">Start date</td>
                  <td className="py-1">{formatDate(project.start_date)}</td>
                </tr>
                <tr>
                  <td className="py-1 pr-4 font-medium text-gray-600">End date</td>
                  <td className="py-1">{formatDate(project.end_date)}</td>
                </tr>
              </tbody>
            </table>
            <table className="w-full max-w-md">
              <tbody>
                <tr>
                  <td className="py-1 pr-4 font-medium text-gray-600 w-40">Client</td>
                  <td className="py-1">{project.client_name || branding.client_name || "—"}</td>
                </tr>
                <tr>
                  <td className="py-1 pr-4 font-medium text-gray-600">Main contractor</td>
                  <td className="py-1">{project.main_contractor || "—"}</td>
                </tr>
                <tr>
                  <td className="py-1 pr-4 font-medium text-gray-600">SWMP owner</td>
                  <td className="py-1">{project.swmp_owner || "—"}</td>
                </tr>
                <tr>
                  <td className="py-1 pr-4 font-medium text-gray-600">Primary waste contractor</td>
                  <td className="py-1">{primaryWasteContractorName ?? "Not set"}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-auto pt-8 text-sm text-gray-500">
            <p>Prepared: {formatDate(preparedAt)}</p>
            <p>Version: 1</p>
          </div>
        </div>
      </section>

      {/* Executive Summary / Overview */}
      <section className={`${PAGE_BREAK} section-spacing`}>
        <h2 className="report-h2">Overview</h2>
        {wasteStrategy?.summary && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 mb-6">
            {[
              { label: "Total tonnes", value: (wasteStrategy.summary.total_estimated_tonnes ?? 0).toFixed(1) },
              { label: "Diversion %", value: `${(wasteStrategy.summary.estimated_diversion_percent ?? 0).toFixed(0)}%` },
              { label: "Landfill %", value: `${(wasteStrategy.summary.estimated_landfill_percent ?? 0).toFixed(0)}%` },
              { label: "Streams", value: String(wasteStrategy.summary.streams_count ?? 0) },
              { label: "Facilities utilised", value: String(wasteStrategy.summary.facilities_utilised_count ?? 0) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded border border-gray-200 bg-gray-50/50 p-3">
                <p className="text-xs font-medium text-gray-500">{label}</p>
                <p className="text-base font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        )}
        {planningChecklist && (
          <div className="mb-6">
            <h3 className="report-h3">Planning checklist</h3>
            <p className="report-body">Readiness: {planningChecklist.readiness_score}%</p>
          </div>
        )}
        <ExportChartsSection chartData={chartData} onReady={handleChartsReady} />
      </section>

      {/* Carbon forecast (site operations) */}
      {(data.carbonVehicleEntries?.length > 0 || data.carbonResourceEntries?.length > 0) && (
        <section className={`${PAGE_BREAK} section-spacing page-break-avoid`}>
          <h2 className="report-h2">Carbon forecast (site operations)</h2>
          {data.carbonVehicleEntries && data.carbonVehicleEntries.length > 0 && (
            <div className="mb-6 page-break-avoid">
              <h3 className="report-h3">Machinery &amp; vehicles</h3>
              <div className="print-table-wrap overflow-visible rounded-md border border-gray-200">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-2 font-medium border-b border-gray-200">Item</th>
                      <th className="text-left p-2 font-medium border-b border-gray-200 w-24">Fuel type</th>
                      <th className="text-right p-2 font-medium border-b border-gray-200 w-20">Time (hrs)</th>
                      <th className="text-right p-2 font-medium border-b border-gray-200 w-20">Consumption/hr</th>
                      <th className="text-left p-2 font-medium border-b border-gray-200 w-16">Unit</th>
                      <th className="text-right p-2 font-medium border-b border-gray-200 w-20">kg CO₂e/unit</th>
                      <th className="text-right p-2 font-medium border-b border-gray-200 w-24">Emissions (kg CO₂e)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.carbonVehicleEntries.map((e) => {
                      const t = Number(e.time_active_hours) || 0;
                      const c = e.factor?.avg_consumption_per_hr ?? 0;
                      const k = e.factor?.conversion_factor_kgco2e_per_unit ?? 0;
                      const emissions = t * c * k;
                      const itemLabel = [e.factor?.name, e.factor?.weight_range ? `(${e.factor.weight_range})` : ""].filter(Boolean).join(" ");
                      return (
                        <tr key={e.id} className="border-b border-gray-100">
                          <td className="p-2 break-words">{itemLabel || "—"}</td>
                          <td className="p-2">{e.factor?.fuel_type ?? "—"}</td>
                          <td className="p-2 text-right tabular-nums">{t.toFixed(2)}</td>
                          <td className="p-2 text-right tabular-nums">{c}</td>
                          <td className="p-2">{e.factor?.consumption_unit ?? "—"}</td>
                          <td className="p-2 text-right tabular-nums">{k}</td>
                          <td className="p-2 text-right tabular-nums">{(Math.round(emissions * 100) / 100).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-medium border-t border-gray-200">
                      <td colSpan={6} className="p-2 text-right">Machinery subtotal</td>
                      <td className="p-2 text-right tabular-nums">
                        {(Math.round(
                          data.carbonVehicleEntries.reduce((sum, e) => {
                            const t = Number(e.time_active_hours) || 0;
                            const c = e.factor?.avg_consumption_per_hr ?? 0;
                            const k = e.factor?.conversion_factor_kgco2e_per_unit ?? 0;
                            return sum + t * c * k;
                          },
                          0
                        ) *
                          100) /
                          100).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
          {data.carbonResourceEntries && data.carbonResourceEntries.length > 0 && (
            <div className="mb-6 page-break-avoid">
              <h3 className="report-h3">Water, energy &amp; fuel</h3>
              <div className="print-table-wrap overflow-visible rounded-md border border-gray-200">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-2 font-medium border-b border-gray-200">Item</th>
                      <th className="text-left p-2 font-medium border-b border-gray-200 w-20">Category</th>
                      <th className="text-right p-2 font-medium border-b border-gray-200 w-20">Quantity used</th>
                      <th className="text-left p-2 font-medium border-b border-gray-200 w-16">Unit</th>
                      <th className="text-right p-2 font-medium border-b border-gray-200 w-20">kg CO₂e/unit</th>
                      <th className="text-right p-2 font-medium border-b border-gray-200 w-24">Emissions (kg CO₂e)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.carbonResourceEntries.map((e) => {
                      const q = Number(e.quantity_used) || 0;
                      const k = e.factor?.conversion_factor_kgco2e_per_unit ?? 0;
                      const emissions = q * k;
                      return (
                        <tr key={e.id} className="border-b border-gray-100">
                          <td className="p-2 break-words">{e.factor?.name ?? "—"}</td>
                          <td className="p-2">{e.factor?.category ?? "—"}</td>
                          <td className="p-2 text-right tabular-nums">{q.toFixed(2)}</td>
                          <td className="p-2">{e.factor?.unit ?? "—"}</td>
                          <td className="p-2 text-right tabular-nums">{k}</td>
                          <td className="p-2 text-right tabular-nums">{(Math.round(emissions * 100) / 100).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-medium border-t border-gray-200">
                      <td colSpan={5} className="p-2 text-right">Water/Energy/Fuel subtotal</td>
                      <td className="p-2 text-right tabular-nums">
                        {(Math.round(
                          data.carbonResourceEntries.reduce((sum, e) => {
                            const q = Number(e.quantity_used) || 0;
                            const k = e.factor?.conversion_factor_kgco2e_per_unit ?? 0;
                            return sum + q * k;
                          },
                          0
                        ) *
                          100) /
                          100).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
          <div className="rounded border border-gray-200 bg-gray-50/50 p-3 page-break-avoid">
            <p className="text-sm font-semibold tabular-nums">
              Total operational emissions:{" "}
              {(
                Math.round(
                  ((data.carbonVehicleEntries ?? []).reduce((s, e) => s + (Number(e.time_active_hours) || 0) * (e.factor?.avg_consumption_per_hr ?? 0) * (e.factor?.conversion_factor_kgco2e_per_unit ?? 0), 0) +
                    (data.carbonResourceEntries ?? []).reduce((s, e) => s + (Number(e.quantity_used) || 0) * (e.factor?.conversion_factor_kgco2e_per_unit ?? 0), 0)) *
                    100
                ) / 100
              ).toFixed(2)}{" "}
              kg CO₂e
            </p>
          </div>
        </section>
      )}

      {/* Strategy / Recommendations */}
      <section className={`${PAGE_BREAK} section-spacing`}>
        <h2 className="report-h2">Strategy &amp; recommendations</h2>
        {wasteStrategy?.narrative && (
          <div className="report-section space-y-4 mb-6">
            <div>
              <h3 className="report-h3">Summary</h3>
              <p className="section-body">{wasteStrategy.narrative.swmp_summary_paragraph}</p>
            </div>
            <div>
              <h3 className="report-h3">Methodology</h3>
              <p className="section-body">{wasteStrategy.narrative.methodology_paragraph}</p>
            </div>
          </div>
        )}
        {wasteStrategy?.recommendations && wasteStrategy.recommendations.length > 0 && (
          <div className="report-section">
            <h3 className="report-h3">Top recommendations</h3>
            <ul className="narrative-list list-disc list-inside">
              {wasteStrategy.recommendations.slice(0, 10).map((r, i) => (
                <li key={r.id ?? i}>{r.title}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Waste Streams table */}
      <section className={`${PAGE_BREAK} section-spacing`}>
        <h2 className="report-h2">Waste streams</h2>
        <div className="print-table-wrap overflow-visible rounded-md border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2 font-medium border-b border-gray-200 w-[18%]">Stream</th>
                <th className="text-right p-2 font-medium border-b border-gray-200 w-[10%]">Manual (t)</th>
                <th className="text-right p-2 font-medium border-b border-gray-200 w-[10%]">Forecast (t)</th>
                <th className="text-right p-2 font-medium border-b border-gray-200 w-[10%]">Total (t)</th>
                <th className="text-left p-2 font-medium border-b border-gray-200 w-[14%]">Handling</th>
                <th className="text-left p-2 font-medium border-b border-gray-200 w-[24%] cell-destination">Destination</th>
                <th className="text-right p-2 font-medium border-b border-gray-200 w-[8%]">Distance (km)</th>
              </tr>
            </thead>
            <tbody>
              {streams.map((s: StreamPlanItem) => (
                <tr key={s.stream_id} className="border-b border-gray-100">
                  <td className="p-2 font-medium">{s.stream_name}</td>
                  <td className="p-2 text-right tabular-nums">{s.manual_tonnes.toFixed(1)}</td>
                  <td className="p-2 text-right tabular-nums">{s.forecast_tonnes.toFixed(1)}</td>
                  <td className="p-2 text-right tabular-nums">{s.total_tonnes.toFixed(1)}</td>
                  <td className="p-2 capitalize">{s.handling_mode ?? "—"}</td>
                  <td className="p-2 cell-destination break-words">
                    {getStreamDisplay(s.stream_name).destinationDisplay}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {getStreamDisplay(s.stream_name).distanceDisplay || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Waste Stream Plans (detailed: how generated, on-site, pathway) — from inputs */}
      <section className={`${PAGE_BREAK} section-spacing`}>
        <h2 className="report-h2">Waste stream plans</h2>
        <div className="print-table-wrap overflow-visible rounded-md border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2 font-medium border-b border-gray-200 w-[14%]">Waste stream</th>
                <th className="text-left p-2 font-medium border-b border-gray-200 w-[18%]">How generated</th>
                <th className="text-left p-2 font-medium border-b border-gray-200 w-[18%]">On-site management</th>
                <th className="text-left p-2 font-medium border-b border-gray-200 w-[18%] cell-destination">Destination</th>
                <th className="text-right p-2 font-medium border-b border-gray-200 w-[8%]">Distance (km)</th>
                <th className="text-left p-2 font-medium border-b border-gray-200 w-[24%]">Planned pathway</th>
              </tr>
            </thead>
            <tbody>
              {streams.map((s: StreamPlanItem) => {
                const details = getPlanDetails(s.stream_name);
                return (
                  <tr key={s.stream_id} className="border-b border-gray-100">
                    <td className="p-2 font-medium">{s.stream_name}</td>
                    <td className="p-2 break-words">{details.generated_by?.trim() || "—"}</td>
                    <td className="p-2 break-words">{details.on_site_management?.trim() || "—"}</td>
                    <td className="p-2 cell-destination break-words">
                      {getStreamDisplay(s.stream_name).destinationDisplay}
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {getStreamDisplay(s.stream_name).distanceDisplay || "—"}
                    </td>
                    <td className="p-2 break-words">{details.pathway?.trim() || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Site controls */}
      {siteControls && (
        <section className={PAGE_BREAK}>
          <h2 className="report-h2">Site controls</h2>
          <div className="report-section">
            <h3 className="report-h3">Bin setup</h3>
            <p className="section-body">{siteControls.bin_setup}</p>
            <h3 className="report-h3">Signage &amp; storage</h3>
            <p className="section-body">{siteControls.signage_storage}</p>
            <h3 className="report-h3">Contamination controls</h3>
            <p className="section-body">{siteControls.contamination_controls}</p>
            <h3 className="report-h3">Hazardous controls</h3>
            <p className="section-body">{siteControls.hazardous_controls}</p>
          </div>
        </section>
      )}

      {/* Monitoring & reporting */}
      {monitoring && (
        <section className={PAGE_BREAK}>
          <h2 className="report-h2">Monitoring &amp; reporting</h2>
          <div className="report-section">
            <p className="section-body"><strong>Methods:</strong> {monitoring.methods?.join(", ") || "—"}</p>
            {monitoring.uses_software && monitoring.software_name && (
              <p className="section-body">Software: {monitoring.software_name}</p>
            )}
            <p className="section-body">{monitoring.dockets_description}</p>
          </div>
        </section>
      )}

      {/* Responsibilities */}
      {(responsibilities?.length > 0 || additional_responsibilities?.length > 0) && (
        <section className={PAGE_BREAK}>
          <h2 className="report-h2">Responsibilities</h2>
          <div className="report-section">
            {responsibilities?.map((r, i) => (
              <div key={i} className="responsibility-block">
                <p className="responsibility-role">{r.role} — {r.party}</p>
                <ul className="responsibility-list list-disc list-inside">
                  {r.responsibilities?.map((resp, j) => (
                    <li key={j}>{resp}</li>
                  ))}
                </ul>
              </div>
            ))}
            {additional_responsibilities?.map((r, i) => (
              <div key={`add-${i}`} className="responsibility-block">
                <p className="responsibility-role">{r.name} — {r.role}</p>
                {(r.email || r.phone) && (
                  <p className="responsibility-contact">{[r.email, r.phone].filter(Boolean).join(" · ")}</p>
                )}
                <p className="section-body">{r.responsibilities}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      {notes && (
        <section className={PAGE_BREAK}>
          <h2 className="report-h2">Notes</h2>
          <div className="report-section">
            <p className="section-body whitespace-pre-wrap">{notes}</p>
          </div>
        </section>
      )}

      {/* Appendix: forecast items */}
      <section className={PAGE_BREAK}>
        <h2 className="report-h2">Appendix — Forecast items by stream</h2>
        {forecastItems.length === 0 ? (
          <p className="section-body">No forecast items.</p>
        ) : (
          <div className="print-table-wrap overflow-visible rounded-md border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2 font-medium border-b border-gray-200 w-[35%]">Item</th>
                  <th className="text-right p-2 font-medium border-b border-gray-200 w-[12%]">Qty</th>
                  <th className="text-left p-2 font-medium border-b border-gray-200 w-[12%]">Unit</th>
                  <th className="text-right p-2 font-medium border-b border-gray-200 w-[12%]">Excess %</th>
                  <th className="text-left p-2 font-medium border-b border-gray-200 w-[15%]">Stream</th>
                  <th className="text-right p-2 font-medium border-b border-gray-200 w-[14%]">Waste (kg)</th>
                </tr>
              </thead>
              <tbody>
                {forecastItems.slice(0, 100).map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="p-2">{item.item_name || "—"}</td>
                    <td className="p-2 text-right tabular-nums">{item.quantity}</td>
                    <td className="p-2">{item.unit}</td>
                    <td className="p-2 text-right tabular-nums">{item.excess_percent}%</td>
                    <td className="p-2">{item.waste_stream_key || "—"}</td>
                    <td className="p-2 text-right tabular-nums">
                      {item.computed_waste_kg != null ? item.computed_waste_kg.toFixed(1) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {forecastItems.length > 100 && (
          <p className="print-muted mt-2">Showing first 100 of {forecastItems.length} items.</p>
        )}
      </section>

      {/* Page numbers and footer come from Playwright PDF headerTemplate/footerTemplate */}
    </div>
  );
}

