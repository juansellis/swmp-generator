"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";

type VehicleFactor = {
  id: string;
  name: string;
  weight_range: string | null;
  fuel_type: string;
  avg_consumption_per_hr: number;
  consumption_unit: string;
  conversion_factor_kgco2e_per_unit: number;
  is_active: boolean;
  sort_order: number;
};

type ResourceFactor = {
  id: string;
  category: string;
  name: string;
  conversion_factor_kgco2e_per_unit: number;
  unit: string;
  is_active: boolean;
  sort_order: number;
};

/** Parse numeric; return null if empty, NaN, or invalid. */
function parseNum(value: string | number | null | undefined): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : parseFloat(String(value).trim());
  if (Number.isNaN(n)) return null;
  return n;
}

/** Parse numeric strictly > 0 for conversion factor. */
function parseConversionFactor(value: string | number | null | undefined): number | null {
  const n = parseNum(value);
  if (n === null || n <= 0) return null;
  return n;
}

/** Parse non-negative number (e.g. avg_consumption_per_hr, sort_order). */
function parseNonNegative(value: string | number | null | undefined, fallback: number): number {
  const n = parseNum(value);
  if (n === null || n < 0) return fallback;
  return n;
}

export default function AdminCarbonPage() {
  const [vehicleFactors, setVehicleFactors] = useState<VehicleFactor[]>([]);
  const [resourceFactors, setResourceFactors] = useState<ResourceFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVehicleFactors = async () => {
    const { data, error: e } = await supabase
      .from("carbon_vehicle_factors")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name");
    if (e) {
      if (!e.message.includes("Could not find the table")) setError(e.message);
      setVehicleFactors([]);
      return;
    }
    setVehicleFactors((data ?? []) as VehicleFactor[]);
  };

  const fetchResourceFactors = async () => {
    const { data, error: e } = await supabase
      .from("carbon_resource_factors")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name");
    if (e) {
      if (!e.message.includes("Could not find the table")) setError(e.message);
      setResourceFactors([]);
      return;
    }
    setResourceFactors((data ?? []) as ResourceFactor[]);
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([fetchVehicleFactors(), fetchResourceFactors()]).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <PageHeader title="Carbon factors" subtitle="Machinery/vehicles (time-based) and water, energy & fuel (quantity-based)." />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Carbon factors"
        subtitle="Manage carbon factor libraries for the Carbon Forecast module. Machinery & vehicles use time (hours); water, energy & fuel use quantity."
      />
      {error && <p className="text-sm text-destructive mb-2">{error}</p>}
      <Tabs defaultValue="vehicles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vehicles">Machinery & Vehicles</TabsTrigger>
          <TabsTrigger value="resources">Water, Energy & Fuel</TabsTrigger>
        </TabsList>
        <TabsContent value="vehicles" className="space-y-4">
          <VehicleFactorsTab factors={vehicleFactors} onRefresh={fetchVehicleFactors} />
        </TabsContent>
        <TabsContent value="resources" className="space-y-4">
          <ResourceFactorsTab factors={resourceFactors} onRefresh={fetchResourceFactors} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function VehicleFactorsTab({ factors, onRefresh }: { factors: VehicleFactor[]; onRefresh: () => void }) {
  const [modalOpen, setModalOpen] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<VehicleFactor | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<VehicleFactor | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    weight_range: "",
    fuel_type: "Diesel",
    avg_consumption_per_hr: "",
    consumption_unit: "",
    conversion_factor_kgco2e_per_unit: "",
    sort_order: 0,
  });

  const openCreate = () => {
    setForm({
      name: "",
      weight_range: "",
      fuel_type: "Diesel",
      avg_consumption_per_hr: "",
      consumption_unit: "L/hr",
      conversion_factor_kgco2e_per_unit: "",
      sort_order: factors.length > 0 ? Math.max(...factors.map((f) => f.sort_order)) + 1 : 0,
    });
    setEditing(null);
    setModalOpen("create");
  };

  const openEdit = (row: VehicleFactor) => {
    setForm({
      name: row.name,
      weight_range: row.weight_range ?? "",
      fuel_type: row.fuel_type,
      avg_consumption_per_hr: String(row.avg_consumption_per_hr),
      consumption_unit: row.consumption_unit,
      conversion_factor_kgco2e_per_unit: String(row.conversion_factor_kgco2e_per_unit),
      sort_order: row.sort_order,
    });
    setEditing(row);
    setModalOpen("edit");
  };

  const validateVehicle = (): string | null => {
    const name = form.name.trim();
    if (!name) return "Name is required.";
    const consumptionUnit = form.consumption_unit.trim();
    if (!consumptionUnit) return "Consumption unit is required.";
    const avgConsumption = parseNonNegative(form.avg_consumption_per_hr, -1);
    if (avgConsumption < 0) return "Avg consumption per hour must be ≥ 0.";
    const conversion = parseConversionFactor(form.conversion_factor_kgco2e_per_unit);
    if (conversion === null) return "Conversion factor (kgCO2e per unit) must be a number > 0.";
    return null;
  };

  const handleSaveVehicle = async () => {
    const err = validateVehicle();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      weight_range: form.weight_range.trim() || null,
      fuel_type: form.fuel_type.trim() || "Diesel",
      avg_consumption_per_hr: parseNonNegative(form.avg_consumption_per_hr, 0),
      consumption_unit: form.consumption_unit.trim(),
      conversion_factor_kgco2e_per_unit: parseConversionFactor(form.conversion_factor_kgco2e_per_unit)!,
      sort_order: parseNonNegative(form.sort_order, editing?.sort_order ?? 0),
    };
    if (modalOpen === "create") {
      const { error: e } = await supabase.from("carbon_vehicle_factors").insert(payload);
      if (e) {
        toast.error(e.message);
        setSaving(false);
        return;
      }
      toast.success("Factor created");
      setModalOpen(null);
      onRefresh();
    } else if (editing) {
      const { error: e } = await supabase.from("carbon_vehicle_factors").update(payload).eq("id", editing.id);
      if (e) {
        toast.error(e.message);
        setSaving(false);
        return;
      }
      toast.success("Factor updated");
      setModalOpen(null);
      setEditing(null);
      onRefresh();
    }
    setSaving(false);
  };

  const toggleActiveVehicle = async (row: VehicleFactor) => {
    const { error: e } = await supabase
      .from("carbon_vehicle_factors")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (e) {
      toast.error(e.message);
      return;
    }
    toast.success(row.is_active ? "Factor disabled" : "Factor enabled");
    onRefresh();
  };

  const handleDeleteVehicle = async () => {
    if (!rowToDelete) return;
    setDeleting(true);
    const { error: e } = await supabase.from("carbon_vehicle_factors").delete().eq("id", rowToDelete.id);
    setDeleting(false);
    setRowToDelete(null);
    if (e) {
      toast.error(e.message);
      return;
    }
    toast.success("Factor deleted");
    onRefresh();
  };

  const moveVehicle = async (row: VehicleFactor, direction: "up" | "down") => {
    const idx = factors.findIndex((f) => f.id === row.id);
    if (idx < 0) return;
    const otherIdx = direction === "up" ? idx - 1 : idx + 1;
    if (otherIdx < 0 || otherIdx >= factors.length) return;
    const other = factors[otherIdx];
    const myOrder = row.sort_order;
    const otherOrder = other.sort_order;
    const { error: e1 } = await supabase.from("carbon_vehicle_factors").update({ sort_order: otherOrder }).eq("id", row.id);
    if (e1) {
      toast.error(e1.message);
      return;
    }
    const { error: e2 } = await supabase.from("carbon_vehicle_factors").update({ sort_order: myOrder }).eq("id", other.id);
    if (e2) {
      toast.error(e2.message);
      onRefresh();
      return;
    }
    toast.success(direction === "up" ? "Moved up" : "Moved down");
    onRefresh();
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Machinery & Vehicles <Badge variant="secondary">{factors.length}</Badge>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={openCreate}>
            Create factor
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Name</TableHead>
                <TableHead className="w-[80px]">Weight range</TableHead>
                <TableHead className="w-[80px]">Fuel type</TableHead>
                <TableHead className="w-[90px]">Consumption/hr</TableHead>
                <TableHead className="w-[70px]">Unit</TableHead>
                <TableHead className="w-[90px]">kgCO2e/unit</TableHead>
                <TableHead className="w-[60px]">Order</TableHead>
                <TableHead className="w-[70px]">Active</TableHead>
                <TableHead className="w-[160px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {factors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground text-center py-8">
                    No machinery/vehicle factors yet. Create one or run the seed migration.
                  </TableCell>
                </TableRow>
              ) : (
                factors.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.weight_range ?? "—"}</TableCell>
                    <TableCell>{row.fuel_type}</TableCell>
                    <TableCell className="tabular-nums">{row.avg_consumption_per_hr}</TableCell>
                    <TableCell>{row.consumption_unit}</TableCell>
                    <TableCell className="tabular-nums">{row.conversion_factor_kgco2e_per_unit}</TableCell>
                    <TableCell className="tabular-nums">{row.sort_order}</TableCell>
                    <TableCell>
                      <Switch checked={row.is_active} onCheckedChange={() => toggleActiveVehicle(row)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveVehicle(row, "up")}
                          disabled={factors.findIndex((f) => f.id === row.id) === 0}
                          aria-label="Move up"
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveVehicle(row, "down")}
                          disabled={factors.findIndex((f) => f.id === row.id) === factors.length - 1}
                          aria-label="Move down"
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setRowToDelete(row)}
                          aria-label="Delete"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={rowToDelete !== null} onOpenChange={(open) => !open && setRowToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete factor?</DialogTitle>
            <DialogDescription>
              This will permanently remove &quot;{rowToDelete?.name}&quot;
              {rowToDelete?.weight_range ? ` (${rowToDelete.weight_range})` : ""}. Projects using this factor will need to choose another.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRowToDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteVehicle} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalOpen !== null} onOpenChange={(open) => !open && setModalOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit machinery/vehicle factor" : "Create machinery/vehicle factor"}</DialogTitle>
            <DialogDescription>
              Time-based: emissions = hours × consumption/hr × kgCO2e per unit. Units must be non-empty; conversion factor &gt; 0.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Mini Excavator" />
            </div>
            <div className="grid gap-2">
              <Label>Weight range</Label>
              <Input value={form.weight_range} onChange={(e) => setForm((f) => ({ ...f, weight_range: e.target.value }))} placeholder="e.g. 1.0–1.5" />
            </div>
            <div className="grid gap-2">
              <Label>Fuel type *</Label>
              <Select value={form.fuel_type} onValueChange={(v) => setForm((f) => ({ ...f, fuel_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Diesel">Diesel</SelectItem>
                  <SelectItem value="Petrol">Petrol</SelectItem>
                  <SelectItem value="Electric">Electric</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Avg consumption per hour *</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={form.avg_consumption_per_hr}
                  onChange={(e) => setForm((f) => ({ ...f, avg_consumption_per_hr: e.target.value }))}
                  placeholder="e.g. 3"
                />
              </div>
              <div className="grid gap-2">
                <Label>Consumption unit *</Label>
                <Input
                  value={form.consumption_unit}
                  onChange={(e) => setForm((f) => ({ ...f, consumption_unit: e.target.value }))}
                  placeholder="e.g. L/hr, kWh/hr"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Conversion factor (kgCO2e per unit) *</Label>
              <Input
                type="number"
                min={0.0001}
                step="any"
                value={form.conversion_factor_kgco2e_per_unit}
                onChange={(e) => setForm((f) => ({ ...f, conversion_factor_kgco2e_per_unit: e.target.value }))}
                placeholder="e.g. 2.68 for diesel per litre"
              />
            </div>
            <div className="grid gap-2">
              <Label>Sort order</Label>
              <Input
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveVehicle} disabled={saving}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const RESOURCE_CATEGORIES = ["Water", "Energy", "Fuel"] as const;

function ResourceFactorsTab({ factors, onRefresh }: { factors: ResourceFactor[]; onRefresh: () => void }) {
  const [modalOpen, setModalOpen] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<ResourceFactor | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: "Water",
    name: "",
    unit: "",
    conversion_factor_kgco2e_per_unit: "",
    sort_order: 0,
  });

  const openCreate = () => {
    setForm({
      category: "Water",
      name: "",
      unit: "m3",
      conversion_factor_kgco2e_per_unit: "",
      sort_order: factors.length > 0 ? Math.max(...factors.map((f) => f.sort_order)) + 1 : 0,
    });
    setEditing(null);
    setModalOpen("create");
  };

  const openEdit = (row: ResourceFactor) => {
    setForm({
      category: row.category,
      name: row.name,
      unit: row.unit,
      conversion_factor_kgco2e_per_unit: String(row.conversion_factor_kgco2e_per_unit),
      sort_order: row.sort_order,
    });
    setEditing(row);
    setModalOpen("edit");
  };

  const validateResource = (): string | null => {
    const name = form.name.trim();
    if (!name) return "Name is required.";
    const unit = form.unit.trim();
    if (!unit) return "Unit is required.";
    const conversion = parseConversionFactor(form.conversion_factor_kgco2e_per_unit);
    if (conversion === null) return "Conversion factor (kgCO2e per unit) must be a number > 0.";
    return null;
  };

  const handleSaveResource = async () => {
    const err = validateResource();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    const payload = {
      category: form.category.trim() || "Water",
      name: form.name.trim(),
      unit: form.unit.trim(),
      conversion_factor_kgco2e_per_unit: parseConversionFactor(form.conversion_factor_kgco2e_per_unit)!,
      sort_order: parseNonNegative(form.sort_order, editing?.sort_order ?? 0),
    };
    if (modalOpen === "create") {
      const { error: e } = await supabase.from("carbon_resource_factors").insert(payload);
      if (e) {
        toast.error(e.message);
        setSaving(false);
        return;
      }
      toast.success("Factor created");
      setModalOpen(null);
      onRefresh();
    } else if (editing) {
      const { error: e } = await supabase.from("carbon_resource_factors").update(payload).eq("id", editing.id);
      if (e) {
        toast.error(e.message);
        setSaving(false);
        return;
      }
      toast.success("Factor updated");
      setModalOpen(null);
      setEditing(null);
      onRefresh();
    }
    setSaving(false);
  };

  const toggleActiveResource = async (row: ResourceFactor) => {
    const { error: e } = await supabase
      .from("carbon_resource_factors")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (e) {
      toast.error(e.message);
      return;
    }
    toast.success(row.is_active ? "Factor disabled" : "Factor enabled");
    onRefresh();
  };

  const moveResource = async (row: ResourceFactor, direction: "up" | "down") => {
    const idx = factors.findIndex((f) => f.id === row.id);
    if (idx < 0) return;
    const otherIdx = direction === "up" ? idx - 1 : idx + 1;
    if (otherIdx < 0 || otherIdx >= factors.length) return;
    const other = factors[otherIdx];
    const myOrder = row.sort_order;
    const otherOrder = other.sort_order;
    const { error: e1 } = await supabase.from("carbon_resource_factors").update({ sort_order: otherOrder }).eq("id", row.id);
    if (e1) {
      toast.error(e1.message);
      return;
    }
    const { error: e2 } = await supabase.from("carbon_resource_factors").update({ sort_order: myOrder }).eq("id", other.id);
    if (e2) {
      toast.error(e2.message);
      onRefresh();
      return;
    }
    toast.success(direction === "up" ? "Moved up" : "Moved down");
    onRefresh();
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Water, Energy & Fuel <Badge variant="secondary">{factors.length}</Badge>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={openCreate}>
            Create factor
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Category</TableHead>
                <TableHead className="w-[180px]">Name</TableHead>
                <TableHead className="w-[80px]">Unit</TableHead>
                <TableHead className="w-[100px]">kgCO2e/unit</TableHead>
                <TableHead className="w-[60px]">Order</TableHead>
                <TableHead className="w-[70px]">Active</TableHead>
                <TableHead className="w-[160px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {factors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground text-center py-8">
                    No water/energy/fuel factors yet. Create one or run the seed migration.
                  </TableCell>
                </TableRow>
              ) : (
                factors.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.category}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.unit}</TableCell>
                    <TableCell className="tabular-nums">{row.conversion_factor_kgco2e_per_unit}</TableCell>
                    <TableCell className="tabular-nums">{row.sort_order}</TableCell>
                    <TableCell>
                      <Switch checked={row.is_active} onCheckedChange={() => toggleActiveResource(row)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveResource(row, "up")}
                          disabled={factors.findIndex((f) => f.id === row.id) === 0}
                          aria-label="Move up"
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveResource(row, "down")}
                          disabled={factors.findIndex((f) => f.id === row.id) === factors.length - 1}
                          aria-label="Move down"
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                          Edit
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={modalOpen !== null} onOpenChange={(open) => !open && setModalOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit water/energy/fuel factor" : "Create water/energy/fuel factor"}</DialogTitle>
            <DialogDescription>
              Quantity-based: emissions = quantity × kgCO2e per unit. Unit must be non-empty; conversion factor &gt; 0.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Potable Water (supply)" />
            </div>
            <div className="grid gap-2">
              <Label>Unit *</Label>
              <Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="e.g. m3, kWh, litre" />
            </div>
            <div className="grid gap-2">
              <Label>Conversion factor (kgCO2e per unit) *</Label>
              <Input
                type="number"
                min={0.0001}
                step="any"
                value={form.conversion_factor_kgco2e_per_unit}
                onChange={(e) => setForm((f) => ({ ...f, conversion_factor_kgco2e_per_unit: e.target.value }))}
                placeholder="e.g. 0.149"
              />
            </div>
            <div className="grid gap-2">
              <Label>Sort order</Label>
              <Input
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveResource} disabled={saving}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
