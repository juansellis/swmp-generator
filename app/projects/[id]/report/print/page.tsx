"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { ReportExportData } from "@/app/api/projects/[id]/report-export/route";
import { ReportPrintDocument } from "../export/ReportPrintDocument";
import "../export/report-print.css";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function ReportPrintPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const projectId = params?.id ?? null;
  // Supports ?mode=full (default) and ?tab=overview|strategy|waste-streams|narrative|carbon|appendix for future section filtering
  const _mode = searchParams?.get("mode") ?? "full";
  const _tab = searchParams?.get("tab") ?? null;

  const [data, setData] = useState<ReportExportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const printTriggered = useRef(false);

  useEffect(() => {
    document.documentElement.classList.add("report-print-page", "report-export-page");
    return () => {
      document.documentElement.classList.remove("report-print-page", "report-export-page");
    };
  }, []);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      setError("Missing project ID");
      setStatusCode(400);
      return;
    }
    fetch(`/api/projects/${projectId}/report-export`, { credentials: "include" })
      .then((res) => {
        setStatusCode(res.status);
        if (!res.ok) {
          return res.json().then((b) => {
            const msg = (b as { error?: string }).error ?? "Failed to load";
            return Promise.reject(new Error(msg));
          });
        }
        return res.json();
      })
      .then((d) => {
        setData(d as ReportExportData);
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load report");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (loading || error || !data || printTriggered.current) return;
    printTriggered.current = true;
    const t = setTimeout(() => {
      window.print();
    }, 400);
    return () => clearTimeout(t);
  }, [loading, error, data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 gap-4">
        <p className="text-gray-500">Loading report…</p>
      </div>
    );
  }

  if (error || !data) {
    const displayMessage =
      statusCode === 401
        ? "Not signed in"
        : statusCode === 403
          ? "Not allowed to access this project"
          : statusCode === 404
            ? "Project not found"
            : error ?? "Report not available.";
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 gap-4">
        <p className="text-red-600">{displayMessage}</p>
        <Button variant="outline" asChild>
          <Link href={`/projects/${projectId}/swmp`}>Back to Report</Link>
        </Button>
      </div>
    );
  }

  const projectName = data.project?.name ?? "Project";

  return (
    <div className="min-h-screen bg-white text-gray-900 print:bg-white">
      {/* Toolbar: visible on screen, hidden in print */}
      <div className="print-view-toolbar print:hidden sticky top-0 z-20 border-b bg-white/95 backdrop-blur shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground truncate">
            {projectName} — Print view
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => window.print()}
              className="gap-2"
            >
              <Printer className="size-4" />
              Print / Save as PDF
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/projects/${projectId}/swmp`}>Back to Report</Link>
            </Button>
          </div>
        </div>
      </div>

      <ReportPrintDocument data={data} projectName={projectName} />
    </div>
  );
}
