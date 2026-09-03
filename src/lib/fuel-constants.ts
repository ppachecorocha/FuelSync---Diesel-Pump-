/**
 * FuelSync Constants
 *
 * Entity codes represent the business entities that own/operate equipment.
 * Each fuel entry is tagged with an entity so costs can be tracked per entity.
 */

export type EntityCode = "MP" | "YB" | "CC" | "DP" | "OT";

export interface EntityDef {
  code: EntityCode;
  name: string;
  color: string; // Tailwind bg class
}

export const ENTITIES: EntityDef[] = [
  { code: "MP", name: "Mr. Pave",         color: "bg-orange-600" },
  { code: "YB", name: "Yellow Bins",      color: "bg-yellow-500" },
  { code: "CC", name: "Concrete Co.",     color: "bg-slate-600"  },
  { code: "DP", name: "Dantas Properties", color: "bg-emerald-600" },
  { code: "OT", name: "Other",            color: "bg-gray-500"   },
];

export const ENTITY_NAMES: Record<EntityCode, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.code, e.name])
) as Record<EntityCode, string>;

export const ENTITY_HEX: Record<EntityCode, string> = {
  MP: "#ea580c",
  YB: "#eab308",
  CC: "#475569",
  DP: "#059669",
  OT: "#6b7280",
};

export const ENTITY_COLORS: Record<EntityCode, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.code, e.color])
) as Record<EntityCode, string>;

/**
 * Equipment categories — used for filtering the vehicle list.
 */
export const EQUIPMENT_CATEGORIES = [
  { value: "truck",      label: "Truck" },
  { value: "trailer",    label: "Trailer" },
  { value: "excavator",  label: "Excavator" },
  { value: "loader",     label: "Loader" },
  { value: "roller",     label: "Roller" },
  { value: "skid_steer", label: "Skid Steer" },
  { value: "paver",      label: "Paver" },
  { value: "other",      label: "Other" },
] as const;
