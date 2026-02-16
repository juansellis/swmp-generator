"use client";

import useSWR from "swr";
import { SWR_DEFAULT_OPTIONS } from "@/lib/swr/config";

export type WasteStreamTypeRow = {
  id: string;
  name: string;
  category: string | null;
  sort_order: number;
};

type ApiResponse = { waste_stream_types?: WasteStreamTypeRow[] };

async function fetcher(): Promise<WasteStreamTypeRow[]> {
  const res = await fetch("/api/catalog/waste-stream-types", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch waste stream types");
  const body = (await res.json()) as ApiResponse;
  return Array.isArray(body?.waste_stream_types) ? body.waste_stream_types : [];
}

export function useWasteStreamTypes() {
  return useSWR(["catalog", "waste-stream-types"], fetcher, SWR_DEFAULT_OPTIONS);
}
