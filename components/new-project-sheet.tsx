"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Notice } from "@/components/notice";
import { AddressPicker } from "@/components/address-picker";
import type { QuickCreateProjectFormState } from "@/components/quick-create-project-modal";

const REGION_OPTIONS = [
  "Auckland",
  "Wellington",
  "Christchurch",
  "Hamilton/Waikato",
  "Tauranga/BOP",
  "Dunedin/Otago",
  "Other (NZ)",
] as const;

const defaultFormState: QuickCreateProjectFormState = {
  name: "",
  address: "",
  region: "",
  projectType: "",
  projectTypeOther: "",
  startDate: "",
  clientName: "",
  mainContractor: "",
  swmpOwner: "",
};

export interface NewProjectSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (state: QuickCreateProjectFormState) => Promise<void>;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  projectTypeGroups: { label: string; options: string[] }[];
}

export function NewProjectSheet({
  open,
  onOpenChange,
  onSubmit,
  loading,
  error,
  successMessage,
  projectTypeGroups,
}: NewProjectSheetProps) {
  const [form, setForm] = React.useState<QuickCreateProjectFormState>(defaultFormState);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  React.useEffect(() => {
    if (!open) setForm(defaultFormState);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent showCloseButton={true} className="flex flex-col p-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New project</SheetTitle>
          <SheetDescription>
            Add a new project with required details. You can edit more on the inputs page.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 space-y-4">
            {error ? (
              <Notice type="error" title="Error" message={error} />
            ) : null}
            {successMessage ? (
              <Notice type="success" title="Success" message={successMessage} />
            ) : null}
            <div className="grid gap-2">
              <Label>Project name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="e.g., Hobson St Fit-out"
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label>Site address *</Label>
              <AddressPicker
                value={form.address}
                onChange={(v) =>
                  setForm((s) => ({
                    ...s,
                    address: v?.formatted_address ?? "",
                    place_id: v?.place_id,
                    lat: v?.lat,
                    lng: v?.lng,
                  }))
                }
                onInput={(v) =>
                  setForm((s) => ({
                    ...s,
                    address: v,
                    ...(v.trim() ? {} : { place_id: undefined, lat: undefined, lng: undefined }),
                  }))
                }
                placeholder="Search address…"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">Choose from suggestions to validate.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Region *</Label>
                <Select
                  value={form.region}
                  onValueChange={(v) => setForm((s) => ({ ...s, region: v ?? "" }))}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGION_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Project type *</Label>
                <Select
                  value={form.projectType || (form.projectTypeOther ? "Other" : "")}
                  onValueChange={(v) =>
                    setForm((s) => ({ ...s, projectType: v ?? "", projectTypeOther: v === "Other" ? s.projectTypeOther : "" }))
                  }
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectTypeGroups.flatMap((g) =>
                      g.options.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {form.projectType === "Other" && (
                  <Input
                    value={form.projectTypeOther}
                    onChange={(e) => setForm((s) => ({ ...s, projectTypeOther: e.target.value }))}
                    placeholder="Describe project type"
                    disabled={loading}
                  />
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Start date *</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((s) => ({ ...s, startDate: e.target.value }))}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label>Client name *</Label>
              <Input
                value={form.clientName}
                onChange={(e) => setForm((s) => ({ ...s, clientName: e.target.value }))}
                disabled={loading}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Main contractor *</Label>
                <Input
                  value={form.mainContractor}
                  onChange={(e) => setForm((s) => ({ ...s, mainContractor: e.target.value }))}
                  disabled={loading}
                />
              </div>
              <div className="grid gap-2">
                <Label>SWMP owner *</Label>
                <Input
                  value={form.swmpOwner}
                  onChange={(e) => setForm((s) => ({ ...s, swmpOwner: e.target.value }))}
                  disabled={loading}
                />
              </div>
            </div>
          </div>
          <SheetFooter className="flex-row gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? "Creating…" : "Create project"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
