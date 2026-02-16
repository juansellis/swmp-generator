"use client";

import * as React from "react";
import { Autocomplete, useJsApiLoader } from "@react-google-maps/api";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

const LIBRARIES: ("places")[] = ["places"];
const API_KEY = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "") : "";

export type AddressPickerValue = {
  formatted_address: string;
  place_id: string;
  lat: number;
  lng: number;
};

export interface AddressPickerProps {
  /** Controlled input value (displayed in the input). */
  value?: string;
  /** Called when user selects a place (valid place_id, formatted_address, geometry) or when selection becomes dirty (user typed). */
  onChange?: (value: AddressPickerValue | null) => void;
  /** Called when user types in the input; use to sync the displayed string and clear validated state when empty. */
  onInput?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

function getLatLng(location: google.maps.places.PlaceResult["geometry"]): { lat: number; lng: number } | null {
  const loc = location?.location;
  if (!loc) return null;
  const latVal = (loc as unknown as { lat: (() => number) | number }).lat;
  const lngVal = (loc as unknown as { lng: (() => number) | number }).lng;
  const lat = typeof latVal === "function" ? latVal() : latVal;
  const lng = typeof lngVal === "function" ? lngVal() : lngVal;
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat: Number(lat), lng: Number(lng) };
}

export function AddressPicker({
  value = "",
  onChange,
  onInput,
  placeholder = "Search address…",
  disabled,
  className,
  id,
}: AddressPickerProps) {
  const autocompleteRef = React.useRef<google.maps.places.Autocomplete | null>(null);
  const [inputValue, setInputValue] = React.useState(value);
  const placeIdRef = React.useRef<string | null>(null);
  const formattedAddressRef = React.useRef<string | null>(null);
  const latRef = React.useRef<number | null>(null);
  const lngRef = React.useRef<number | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: API_KEY,
    libraries: LIBRARIES,
  });

  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handlePlaceChanged = React.useCallback(() => {
    const autocomplete = autocompleteRef.current;
    if (!autocomplete) return;
    const place = autocomplete.getPlace();
    const pid = place.place_id ?? null;
    const addr = place.formatted_address ?? null;
    const coords = getLatLng(place.geometry);
    if (!pid || !addr || !coords) {
      onChange?.(null);
      return;
    }
    placeIdRef.current = pid;
    formattedAddressRef.current = addr;
    latRef.current = coords.lat;
    lngRef.current = coords.lng;
    setInputValue(addr);
    onChange?.({
      formatted_address: addr,
      place_id: pid,
      lat: coords.lat,
      lng: coords.lng,
    });
  }, [onChange]);

  const handleLoad = React.useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  }, []);

  const handleUnmount = React.useCallback(() => {
    autocompleteRef.current = null;
  }, []);

  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setInputValue(v);
      onInput?.(v);
      placeIdRef.current = null;
      formattedAddressRef.current = null;
      latRef.current = null;
      lngRef.current = null;
      onChange?.(null);
    },
    [onInput, onChange]
  );

  if (loadError) {
    return (
      <div className={cn("space-y-2", className)}>
        <Input
          type="text"
          id={id}
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Address (maps failed to load)"
          disabled={true}
          className="border-amber-500"
        />
        <p className="text-xs text-amber-600 dark:text-amber-500">
          Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and ensure Maps JavaScript API is enabled.
        </p>
      </div>
    );
  }

  if (!API_KEY) {
    return (
      <div className={cn("space-y-2", className)}>
        <Input
          type="text"
          id={id}
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Address (API key missing)"
          disabled={true}
          className="border-amber-500"
        />
        <p className="text-xs text-amber-600 dark:text-amber-500">
          Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for address autocomplete.
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={cn("space-y-2", className)}>
        <Input
          type="text"
          id={id}
          value={inputValue}
          placeholder={placeholder}
          disabled={true}
          readOnly
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Autocomplete
        onLoad={handleLoad}
        onPlaceChanged={handlePlaceChanged}
        onUnmount={handleUnmount}
        types={["address"]}
        fields={["place_id", "formatted_address", "geometry.location"]}
        className="w-full"
      >
        <Input
          type="text"
          id={id}
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
      </Autocomplete>
    </div>
  );
}
