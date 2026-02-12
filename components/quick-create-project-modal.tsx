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

export type QuickCreateProjectFormState = {
  name: string;
  address: string;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  React.useEffect(() => {
    if (!open) setForm(defaultFormState);
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
            <Input
              value={form.address}
              onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
              placeholder="e.g., 26 Hobson Street, Auckland CBD"
              disabled={loading}
            />
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
