import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase.ts";
import type { EntityCode } from "../lib/fuel-constants";

export type DieselType = "on_road" | "off_road";

export interface Equipment {
  id: string;
  code: string;
  name: string;
  category: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  license_plate: string | null;
  active: boolean;
  notes: string | null;
  photo_url: string | null;
  company?: string | null;
  vin?: string | null;
  serial_number?: string | null;
  fuel_type?: string | null;
  current_hours?: number | null;
  current_mileage?: number | null;
  purchase_price?: number | null;
  purchase_date?: string | null;
  current_value?: number | null;
  next_service_date?: string | null;
  service_interval?: string | null;
  assigned_mechanic?: string | null;
  assigned_operator?: string | null;
  insurance_expiration?: string | null;
  registration_expiration?: string | null;
  warranty_expiration?: string | null;
  created_at: string;
}

export interface EquipmentInput {
  code: string;
  name: string;
  category: string | null;
  make?: string;
  model?: string;
  year?: number | null;
  license_plate?: string;
  active?: boolean;
  notes?: string;
  photo_url?: string;
  company?: string | null;
  vin?: string | null;
  serial_number?: string | null;
  fuel_type?: string | null;
  current_hours?: number | null;
  current_mileage?: number | null;
  purchase_price?: number | null;
  purchase_date?: string | null;
  current_value?: number | null;
  next_service_date?: string | null;
  service_interval?: string | null;
  assigned_mechanic?: string | null;
  assigned_operator?: string | null;
  insurance_expiration?: string | null;
  registration_expiration?: string | null;
  warranty_expiration?: string | null;
}

export interface FuelEntry {
  id: string;
  equipment_id: string;
  entity: EntityCode;
  gallons: number;
  mileage: number | null;
  diesel_rate: number | null;
  fuel_cost: number | null;
  diesel_type: DieselType | null;
  logged_at: string;
  logged_by: string | null;
  logged_by_name: string | null;
  equipment?: Pick<Equipment, "code" | "name">;
}

export interface MaintenanceEntry {
  id: string;
  equipment_id: string;
  entity: EntityCode;
  cost: number;
  description: string;
  logged_at: string;
  logged_by_name: string | null;
  equipment?: Pick<Equipment, "code" | "name">;
}

export interface FuelSummary {
  total: number;
  count: number;
  byEntity: Record<EntityCode, number>;
  byDieselType: Record<DieselType, number>;
  byEquipment: { code: string; name: string; gallons: number }[];
}

export interface MaintenanceSummary {
  totalCost: number;
  count: number;
  byEntity: Record<EntityCode, number>;
  byEquipment: { code: string; name: string; cost: number }[];
}

export interface FuelFilters {
  from?: string;
  to?: string;
  entity?: EntityCode | "all";
  equipmentId?: string;
}

export function useEquipment({ activeOnly = true }: { activeOnly?: boolean } = {}) {
  return useQuery<Equipment[]>({
    queryKey: ["equipment", { activeOnly }],
    queryFn: async () => {
      let query = supabase
        .from("equipment")
        .select("*")
        .order("code", { ascending: true });

      if (activeOnly) query = query.eq("active", true);

      const { data, error } = await query;
      if (error) throw error;

      return data ?? [];
    },
  });
}

export function useEquipmentByCode(code?: string) {
  return useQuery<Equipment | null>({
    queryKey: ["equipment", code],
    enabled: !!code,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment")
        .select("*")
        .eq("code", code)
        .eq("active", true)
        .maybeSingle();

      if (error) throw error;

      return data;
    },
  });
}

export function useCreateEquipment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: EquipmentInput): Promise<Equipment> => {
      const { data, error } = await supabase
        .from("equipment")
        .insert([input])
        .select()
        .single();

      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipment"] });
    },
  });
}

export function useUpdateEquipment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: Partial<EquipmentInput> & { id: string }
    ): Promise<Equipment> => {
      const { id, ...fields } = input;

      const { data, error } = await supabase
        .from("equipment")
        .update(fields)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipment"] });
    },
  });
}

export function useDeleteEquipment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("equipment").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipment"] });
    },
  });
}

export function useFuelEntries(filters: FuelFilters = {}) {
  return useQuery<FuelEntry[]>({
    queryKey: ["fuel-entries", filters],
    queryFn: async () => {
      let query = supabase
        .from("fuel_entries")
        .select("*, equipment:equipment_id (code, name)")
        .order("logged_at", { ascending: false });

      if (filters.from) query = query.gte("logged_at", filters.from);
      if (filters.to) query = query.lte("logged_at", filters.to);
      if (filters.entity && filters.entity !== "all") {
        query = query.eq("entity", filters.entity);
      }
      if (filters.equipmentId) {
        query = query.eq("equipment_id", filters.equipmentId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data ?? [];
    },
  });
}

export function useLogFuel() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      equipment_id: string;
      entity: EntityCode;
      gallons: number;
      mileage?: number | null;
      diesel_type?: DieselType;
      diesel_rate?: number | null;
      fuel_cost?: number | null;
      logged_by_name?: string;
    }) => {
      const { data, error } = await supabase
        .from("fuel_entries")
        .insert([
          {
            ...input,
            mileage: input.mileage ?? null,
            logged_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      if (input.mileage != null) {
        const { error: updateError } = await supabase
          .from("equipment")
          .update({
            current_mileage: input.mileage,
          })
          .eq("id", input.equipment_id);

        if (updateError) throw updateError;
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fuel-entries"] });
      qc.invalidateQueries({ queryKey: ["fuel-summary"] });
      qc.invalidateQueries({ queryKey: ["equipment"] });
    },
  });
}

export function useFuelSummary(filters: FuelFilters = {}) {
  return useQuery<FuelSummary>({
    queryKey: ["fuel-summary", filters],
    queryFn: async () => {
      let query = supabase
        .from("fuel_entries")
        .select("gallons, mileage, diesel_rate, fuel_cost, diesel_type, entity, equipment:equipment_id (code, name)");

      if (filters.from) query = query.gte("logged_at", filters.from);
      if (filters.to) query = query.lte("logged_at", filters.to);
      if (filters.entity && filters.entity !== "all") {
        query = query.eq("entity", filters.entity);
      }
      if (filters.equipmentId) {
        query = query.eq("equipment_id", filters.equipmentId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as unknown as Array<{
        gallons: number;
        mileage: number | null;
        diesel_rate: number | null;
        fuel_cost: number | null;
        diesel_type: DieselType | null;
        entity: EntityCode;
        equipment:
          | { code: string; name: string }
          | { code: string; name: string }[]
          | null;
      }>;

      const byEntity = {
        MP: 0,
        YB: 0,
        CC: 0,
        DP: 0,
        OT: 0,
      } as Record<EntityCode, number>;

      const byDieselType = {
        on_road: 0,
        off_road: 0,
      } as Record<DieselType, number>;

      const equipMap = new Map<
        string,
        { code: string; name: string; gallons: number }
      >();

      for (const row of rows) {
        if (row.entity in byEntity) {
          byEntity[row.entity] += Number(row.gallons);
        }

        const dieselType = row.diesel_type === "on_road" ? "on_road" : "off_road";
        byDieselType[dieselType] += Number(row.gallons);

        const eq = Array.isArray(row.equipment)
          ? row.equipment[0]
          : row.equipment;

        if (!eq) continue;

        const existing = equipMap.get(eq.code) ?? {
          code: eq.code,
          name: eq.name,
          gallons: 0,
        };

        existing.gallons += Number(row.gallons);
        equipMap.set(eq.code, existing);
      }

      return {
        total: rows.reduce((sum, r) => sum + Number(r.gallons), 0),
        count: rows.length,
        byEntity,
        byDieselType,
        byEquipment: Array.from(equipMap.values()).sort(
          (a, b) => b.gallons - a.gallons
        ),
      };
    },
  });
}

export function useMaintenanceEntries(filters: FuelFilters = {}) {
  return useQuery<MaintenanceEntry[]>({
    queryKey: ["maintenance-entries", filters],
    queryFn: async () => {
      let query = supabase
        .from("maintenance_entries")
        .select("*, equipment:equipment_id (code, name)")
        .order("logged_at", { ascending: false });

      if (filters.from) query = query.gte("logged_at", filters.from);
      if (filters.to) query = query.lte("logged_at", filters.to);
      if (filters.entity && filters.entity !== "all") {
        query = query.eq("entity", filters.entity);
      }
      if (filters.equipmentId) {
        query = query.eq("equipment_id", filters.equipmentId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data ?? [];
    },
  });
}

export function useLogMaintenance() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      equipment_id: string;
      entity: EntityCode;
      cost: number;
      description: string;
      logged_by_name?: string;
    }) => {
      const { data, error } = await supabase
        .from("maintenance_entries")
        .insert([
          {
            ...input,
            logged_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance-entries"] });
      qc.invalidateQueries({ queryKey: ["maintenance-summary"] });
    },
  });
}

export function useMaintenanceSummary(filters: FuelFilters = {}) {
  return useQuery<MaintenanceSummary>({
    queryKey: ["maintenance-summary", filters],
    queryFn: async () => {
      let query = supabase
        .from("maintenance_entries")
        .select("cost, entity, equipment:equipment_id (code, name)");

      if (filters.from) query = query.gte("logged_at", filters.from);
      if (filters.to) query = query.lte("logged_at", filters.to);
      if (filters.entity && filters.entity !== "all") {
        query = query.eq("entity", filters.entity);
      }
      if (filters.equipmentId) {
        query = query.eq("equipment_id", filters.equipmentId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as unknown as Array<{
        cost: number;
        entity: EntityCode;
        equipment:
          | { code: string; name: string }
          | { code: string; name: string }[]
          | null;
      }>;

      const byEntity = {
        MP: 0,
        YB: 0,
        CC: 0,
        DP: 0,
        OT: 0,
      } as Record<EntityCode, number>;

      const equipMap = new Map<
        string,
        { code: string; name: string; cost: number }
      >();

      for (const row of rows) {
        if (row.entity in byEntity) {
          byEntity[row.entity] += Number(row.cost);
        }

        const eq = Array.isArray(row.equipment)
          ? row.equipment[0]
          : row.equipment;

        if (!eq) continue;

        const existing = equipMap.get(eq.code) ?? {
          code: eq.code,
          name: eq.name,
          cost: 0,
        };

        existing.cost += Number(row.cost);
        equipMap.set(eq.code, existing);
      }

      return {
        totalCost: rows.reduce((sum, r) => sum + Number(r.cost), 0),
        count: rows.length,
        byEntity,
        byEquipment: Array.from(equipMap.values()).sort(
          (a, b) => b.cost - a.cost
        ),
      };
    },
  });
}
