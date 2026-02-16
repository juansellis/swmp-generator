"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const SCRIPT_URL = "https://maps.googleapis.com/maps/api/js";
const API_KEY = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "") : "";

export type AddressAutocompleteValue = {
  formatted_address: string;
  place_id: string;
  lat: number;
  lng: number;
};

export interface AddressAutocompleteProps {
  value?: string;
  /** Called when user selects a place. Server should re-validate via /api/validate-address before save. */
  onChange?: (value: AddressAutocompleteValue | null) => void;
  /** Called when user types or clears; use to clear validated state when input is empty. */
  onInput?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Show a small static map preview after selection. */
  showMapPreview?: boolean;
}

type AutocompleteInstance = {
  getPlace: () => {
    place_id?: string;
    formatted_address?: string;
    geometry?: {
      location?: { lat: () => number; lng: () => number } | { lat: number; lng: number };
    };
  };
  addListener: (event: string, cb: () => void) => void;
};

declare global {
  interface Window {
    google?: {
      maps: {
        places: { Autocomplete: new (input: HTMLInputElement, opts?: { types?: string[]; fields?: string[] }) => AutocompleteInstance };
        event?: { clearInstanceListeners: (instance: unknown) => void };
        Map?: new (el: HTMLElement, opts?: { center?: { lat: number; lng: number }; zoom?: number }) => { setCenter: (c: { lat: number; lng: number }) => void };
        Marker?: new (opts?: { map?: unknown; position?: { lat: number; lng: number } }) => void;
      };
    };
    initAddressAutocomplete?: () => void;
  }
}

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.places?.Autocomplete) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src^="${SCRIPT_URL}"]`);
    if (existing) {
      if (window.google?.maps?.places?.Autocomplete) {
        resolve();
        return;
      }
      window.initAddressAutocomplete = () => resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `${SCRIPT_URL}?key=${encodeURIComponent(API_KEY)}&libraries=places&callback=initAddressAutocomplete`;
    script.async = true;
    script.defer = true;
    window.initAddressAutocomplete = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });
}

export function AddressAutocomplete({
  value = "",
  onChange,
  onInput,
  placeholder = "Search address…",
  disabled,
  className,
  id,
  showMapPreview = false,
}: AddressAutocompleteProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const autocompleteRef = React.useRef<AutocompleteInstance | null>(null);
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<unknown>(null);
  const [scriptReady, setScriptReady] = React.useState(false);
  const [scriptError, setScriptError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<AddressAutocompleteValue | null>(null);

  React.useEffect(() => {
    if (!API_KEY) {
      setScriptError("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set");
      return;
    }
    loadScript()
      .then(() => setScriptReady(true))
      .catch((e) => setScriptError(e?.message ?? "Script failed"));
  }, []);

  React.useEffect(() => {
    if (!scriptReady || !inputRef.current || !window.google?.maps?.places?.Autocomplete) return;
    const input = inputRef.current;
    const Autocomplete = window.google.maps.places.Autocomplete;
    const ac = new Autocomplete(input, {
      types: ["address"],
      fields: ["place_id", "formatted_address", "geometry"],
    });
    autocompleteRef.current = ac;
    const listener = () => {
      const place = ac.getPlace();
      const pid = place.place_id ?? "";
      const addr = place.formatted_address ?? "";
      const loc = place.geometry?.location;
      const lat = loc ? (typeof (loc as { lat: () => number }).lat === "function" ? (loc as { lat: () => number; lng: () => number }).lat() : (loc as { lat: number; lng: number }).lat) : undefined;
      const lng = loc ? (typeof (loc as { lng: () => number }).lng === "function" ? (loc as { lat: () => number; lng: () => number }).lng() : (loc as { lat: number; lng: number }).lng) : undefined;
      if (pid && addr && lat != null && lng != null) {
        const next: AddressAutocompleteValue = {
          formatted_address: addr,
          place_id: pid,
          lat: Number(lat),
          lng: Number(lng),
        };
        setSelected(next);
        onChange?.(next);
      } else {
        setSelected(null);
        onChange?.(null);
      }
    };
    ac.addListener("place_changed", listener);
    return () => {
      if (window.google?.maps?.event && autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
      autocompleteRef.current = null;
    };
  }, [scriptReady, onChange]);

  // Create map only when: google.maps available, lat/lng exist, container ref mounted
  React.useEffect(() => {
    if (!showMapPreview || !selected || selected.lat == null || selected.lng == null) return;
    const container = mapContainerRef.current;
    const g = typeof window !== "undefined" ? window.google : undefined;
    if (!container || !g?.maps?.Map) return;

    const MapClass = g.maps.Map;
    const map = new MapClass(container, {
      center: { lat: selected.lat, lng: selected.lng },
      zoom: 15,
    });
    mapInstanceRef.current = map;
    if (g.maps.Marker) {
      new g.maps.Marker({ map, position: { lat: selected.lat, lng: selected.lng } });
    }
    return () => {
      mapInstanceRef.current = null;
    };
  }, [showMapPreview, selected?.lat, selected?.lng]);

  // Fallback: warn when map preview requested but maps not loaded
  React.useEffect(() => {
    if (showMapPreview && selected && (scriptError || !scriptReady)) {
      console.warn("[AddressAutocomplete] Map preview unavailable: Google Maps script not loaded or failed.");
    }
  }, [showMapPreview, selected, scriptReady, scriptError]);

  const canShowMap =
    showMapPreview &&
    selected &&
    selected.lat != null &&
    selected.lng != null &&
    scriptReady &&
    !scriptError;
  const showMapFallback = showMapPreview && selected && selected.lat != null && selected.lng != null && (!scriptReady || !!scriptError);

  return (
    <div className={cn("space-y-2", className)}>
      <Input
        ref={inputRef}
        type="text"
        id={id}
        value={value}
        onChange={(e) => onInput?.(e.target.value)}
        placeholder={scriptError ? "Address (API key missing)" : placeholder}
        disabled={disabled || !scriptReady || !!scriptError}
        className={cn(scriptError && "border-amber-500")}
        autoComplete="off"
      />
      {scriptError && (
        <p className="text-xs text-amber-600 dark:text-amber-500">
          Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for address autocomplete.
        </p>
      )}
      {showMapPreview && (canShowMap || showMapFallback) && (
        <div className="w-full h-48 rounded-lg border overflow-hidden">
          {canShowMap && (
            <div ref={mapContainerRef} className="w-full h-full" />
          )}
          {showMapFallback && (
            <div className="w-full h-full flex items-center justify-center bg-muted/30 text-sm text-muted-foreground">
              Map preview unavailable
            </div>
          )}
        </div>
      )}
    </div>
  );
}
