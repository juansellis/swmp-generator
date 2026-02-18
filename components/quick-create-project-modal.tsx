"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { AddressPicker, type AddressPickerValue } from "@/components/address-picker";
import { cn } from "@/lib/utils";

type FieldErrors = Record<string, string>;

function validateQuickCreateForm(state: QuickCreateProjectFormState): { fieldErrors: FieldErrors; missingLabels: string[] } {
  const fieldErrors: FieldErrors = {};
  const missingLabels: string[] = [];

  if (state.name.trim().length < 2) {
    fieldErrors.name = "Please enter at least 2 characters.";
    missingLabels.push("Project name");
  }

  const isAddressValidated = !!(state.place_id && state.lat != null && state.lng != null);
  if (state.address.trim() && !isAddressValidated) {
    fieldErrors.address = "Please choose an address from suggestions to validate.";
    missingLabels.push("Site address (choose from suggestions)");
  } else if (!state.address.trim()) {
    fieldErrors.address = "Site address is required.";
    missingLabels.push("Site address");
  }

  if (!(state.region ?? "").trim()) {
    fieldErrors.region = "Please select a region.";
    missingLabels.push("Region");
  }

  const projectTypeValue = state.projectType === "Other" ? (state.projectTypeOther ?? "").trim() : (state.projectType ?? "").trim();
  if (!projectTypeValue) {
    fieldErrors.projectType = "Please select or enter a project type.";
    missingLabels.push("Project type");
  }

  if (!(state.startDate ?? "").trim()) {
    fieldErrors.startDate = "Please enter a start date.";
    missingLabels.push("Start date");
  }

  if (!(state.clientName ?? "").trim()) {
    fieldErrors.clientName = "Client name is required.";
    missingLabels.push("Client name");
  }

  if (!(state.mainContractor ?? "").trim()) {
    fieldErrors.mainContractor = "Main contractor is required.";
    missingLabels.push("Main contractor");
  }

  if (!(state.swmpOwner ?? "").trim()) {
    fieldErrors.swmpOwner = "SWMP owner is required.";
    missingLabels.push("SWMP owner");
  }

  return { fieldErrors, missingLabels };
}

export type QuickCreateProjectFormState = {
  name: string;
  address: string;
  /** Set when user selects from Places Autocomplete; required to save. */
  place_id?: string;
  lat?: number;
  lng?: number;
  region: string;
  projectType: string;
  projectTypeOther: string;
  startDate: string;
  clientName: string;
  mainContractor: string;
  swmpOwner: string;
};

const REGION_OPTIONS = [
  "Auckland",
  "Wellington",
  "Christchurch",
  "Hamilton/Waikato",
  "Tauranga/BOP",
  "Dunedin/Otago",
  "Other (NZ)",
] as const;

export interface QuickCreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (state: QuickCreateProjectFormState) => Promise<void>;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  projectTypeOptions: { value: string; label: string }[];
  projectTypeGroups?: { label: string; options: string[] }[];
}

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

export function QuickCreateProjectModal({
  open,
  onOpenChange,
  onSubmit,
  loading,
  error,
  successMessage,
  projectTypeOptions,
  projectTypeGroups,
}: QuickCreateProjectModalProps) {
  const [form, setForm] = React.useState<QuickCreateProjectFormState>(defaultFormState);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [validationMissingLabels, setValidationMissingLabels] = React.useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { fieldErrors: errors, missingLabels } = validateQuickCreateForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setValidationMissingLabels(missingLabels);
      return;
    }
    setFieldErrors({});
    setValidationMissingLabels([]);
    await onSubmit(form);
  };

  React.useEffect(() => {
    if (!open) {
      setForm(defaultFormState);
      setFieldErrors({});
      setValidationMissingLabels([]);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick Create Project</DialogTitle>
          <DialogDescription>
            Add a new project with required details. You can edit more on the inputs page.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <Notice type="error" title="Error" message={error} />
          ) : null}
          {validationMissingLabels.length > 0 ? (
            <Notice
              type="error"
              title="Please complete the highlighted fields"
              message={validationMissingLabels.join(", ")}
            />
          ) : null}
          {successMessage ? (
            <Notice type="success" title="Success" message={successMessage} />
          ) : null}
          <div className="grid gap-2">
            <Label className={cn(fieldErrors.name && "text-destructive")}>Project name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="e.g., Hobson St Fit-out"
              disabled={loading}
              className={cn(fieldErrors.name && "border-destructive")}
            />
            {fieldErrors.name ? <p className="text-xs text-destructive">{fieldErrors.name}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label className={cn(fieldErrors.address && "text-destructive")}>Site address *</Label>
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
              className={cn(fieldErrors.address && "[&_input]:border-destructive")}
            />
            {fieldErrors.address ? (
              <p className="text-xs text-destructive">{fieldErrors.address}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Choose from suggestions to validate.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className={cn(fieldErrors.region && "text-destructive")}>Region *</Label>
              <Select
                value={form.region}
                onValueChange={(v) => setForm((s) => ({ ...s, region: v ?? "" }))}
                disabled={loading}
              >
                <SelectTrigger className={cn(fieldErrors.region && "border-destructive")}>
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
              {fieldErrors.region ? <p className="text-xs text-destructive">{fieldErrors.region}</p> : null}
            </div>
            <div className="grid gap-2">
              <Label className={cn(fieldErrors.projectType && "text-destructive")}>Project type *</Label>
              <Select
                value={form.projectType || (form.projectTypeOther ? "Other" : "")}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, projectType: v ?? "", projectTypeOther: v === "Other" ? s.projectTypeOther : "" }))
                }
                disabled={loading}
              >
                <SelectTrigger className={cn(fieldErrors.projectType && "border-destructive")}>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {projectTypeGroups
                    ? projectTypeGroups.flatMap((g) =>
                        g.options.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))
                      )
                    : projectTypeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
              {form.projectType === "Other" && (
                <Input
                  value={form.projectTypeOther}
                  onChange={(e) => setForm((s) => ({ ...s, projectTypeOther: e.target.value }))}
                  placeholder="Describe project type"
                  disabled={loading}
                  className={cn(fieldErrors.projectType && "border-destructive")}
                />
              )}
              {fieldErrors.projectType ? <p className="text-xs text-destructive">{fieldErrors.projectType}</p> : null}
            </div>
          </div>
          <div className="grid gap-2">
            <Label className={cn(fieldErrors.startDate && "text-destructive")}>Start date *</Label>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((s) => ({ ...s, startDate: e.target.value }))}
              disabled={loading}
              className={cn(fieldErrors.startDate && "border-destructive")}
            />
            {fieldErrors.startDate ? <p className="text-xs text-destructive">{fieldErrors.startDate}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label className={cn(fieldErrors.clientName && "text-destructive")}>Client name *</Label>
            <Input
              value={form.clientName}
              onChange={(e) => setForm((s) => ({ ...s, clientName: e.target.value }))}
              disabled={loading}
              className={cn(fieldErrors.clientName && "border-destructive")}
            />
            {fieldErrors.clientName ? <p className="text-xs text-destructive">{fieldErrors.clientName}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className={cn(fieldErrors.mainContractor && "text-destructive")}>Main contractor *</Label>
              <Input
                value={form.mainContractor}
                onChange={(e) => setForm((s) => ({ ...s, mainContractor: e.target.value }))}
                disabled={loading}
                className={cn(fieldErrors.mainContractor && "border-destructive")}
              />
              {fieldErrors.mainContractor ? <p className="text-xs text-destructive">{fieldErrors.mainContractor}</p> : null}
            </div>
            <div className="grid gap-2">
              <Label className={cn(fieldErrors.swmpOwner && "text-destructive")}>SWMP owner *</Label>
              <Input
                value={form.swmpOwner}
                onChange={(e) => setForm((s) => ({ ...s, swmpOwner: e.target.value }))}
                disabled={loading}
                className={cn(fieldErrors.swmpOwner && "border-destructive")}
              />
              {fieldErrors.swmpOwner ? <p className="text-xs text-destructive">{fieldErrors.swmpOwner}</p> : null}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? "Creating…" : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
