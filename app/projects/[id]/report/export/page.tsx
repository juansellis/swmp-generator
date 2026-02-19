"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { ReportExportData } from "@/app/api/projects/[id]/report-export/route";
import { ReportPrintDocument } from "./ReportPrintDocument";
import "./report-print.css";

export default function ReportExportPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const projectId = params?.id ?? null;
  const token = searchParams?.get("token") ?? null;

  const [data, setData] = useState<ReportExportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [statusCode, setStatusCode] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("report-export-page");
    return () => document.documentElement.classList.remove("report-export-page");
  }, []);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      setError("Missing project ID");
      setStatusCode(400);
      return;
    }
    const url = token
      ? `/api/projects/${projectId}/report-export?token=${encodeURIComponent(token)}`
      : `/api/projects/${projectId}/report-export`;
    fetch(url, { credentials: "include" })
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
  }, [projectId, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
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
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <p className="text-red-600">{displayMessage}</p>
      </div>
    );
  }

  const projectName = data.project?.name ?? "Project";

  return (
    <div className="min-h-screen bg-white text-gray-900 print:bg-white">
      <ReportPrintDocument data={data} projectName={projectName} />
    </div>
  );
}
