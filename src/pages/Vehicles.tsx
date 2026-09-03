import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Pencil,
  Search,
  QrCode,
  FileUp,
  Printer,
  Truck,
  Download,
  Calendar as CalendarIcon,
  Fuel,
  ListChecks,
  TrendingUp,
  Trash2,
  History,
  AlertTriangle,
  Settings,
} from "lucide-react";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  parseISO,
  startOfHour,
} from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import {
  useEquipment,
  useUpdateEquipment,
  useCreateEquipment,
  useDeleteEquipment,
  useFuelEntries,
  useFuelSummary,
  useMaintenanceSummary,
  useMaintenanceEntries,
  type Equipment,
  type EquipmentInput,
} from "@/hooks/useFuel";
import {
  ENTITIES,
  ENTITY_NAMES,
  ENTITY_HEX,
  ENTITY_COLORS,
  EQUIPMENT_CATEGORIES,
  type EntityCode,
} from "@/lib/fuel-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

import QRCodeCard, { fuelUrlForCode } from "@/components/vehicles/QRCodeCard";
import ImportVehiclesDialog from "@/components/vehicles/ImportVehiclesDialog";
import {
  downloadEquipmentQRPng,
  downloadEquipmentQRSvg,
} from "@/lib/qr-utils";
import {
  calculateHistoricalFuelCost,
  getDefaultPeriod,
  getOffRoadDieselRate,
  getOnRoadDieselRate,
  saveFuelSyncSettings,
} from "@/lib/settings";

type ExtendedEquipmentFields = {
  company?: string | null;
  fuel_type?: string | null;
  vin?: string | null;
  serial_number?: string | null;
  current_hours?: number | null;
  current_mileage?: number | null;
  purchase_date?: string | null;
  purchase_cost?: number | null;
  estimated_value?: number | null;
  next_service_date?: string | null;
  service_interval?: string | null;
  assigned_mechanic?: string | null;
  warranty_expiration?: string | null;
  registration_expiration?: string | null;
  insurance_expiration?: string | null;
};

type ExtendedEquipmentInput = EquipmentInput & ExtendedEquipmentFields;

const EMPTY_FORM: ExtendedEquipmentInput = {
  code: "",
  name: "",
  category: null,
  make: "",
  model: "",
  year: null,
  license_plate: "",
  active: true,
  notes: "",
  company: "",
  fuel_type: "off_road",
  vin: "",
  serial_number: "",
  current_hours: null,
  current_mileage: null,
  purchase_date: "",
  purchase_cost: null,
  estimated_value: null,
  next_service_date: "",
  service_interval: "",
  assigned_mechanic: "",
  warranty_expiration: "",
  registration_expiration: "",
  insurance_expiration: "",
};
type Period = "day" | "week" | "month";

const dieselTypeLabel = (dieselType?: string | null) =>
  dieselType === "on_road" ? "On-Road Diesel" : "Off-Road Diesel";

const dieselRateFor = (
  dieselType: string | null | undefined,
  onRoadRate: number,
  offRoadRate: number
) => (dieselType === "on_road" ? onRoadRate : offRoadRate);

const calculateFuelCost = (
  entries: Array<{
    gallons: number;
    diesel_type?: string | null;
    diesel_rate?: number | null;
    fuel_cost?: number | null;
  }>,
  onRoadRate: number,
  offRoadRate: number
) =>
  entries.reduce((sum, entry) => {
    if ((entry as any).fuel_cost != null) {
      return sum + Number((entry as any).fuel_cost);
    }

    const savedRate = (entry as any).diesel_rate;
    const rate =
      savedRate != null
        ? Number(savedRate)
        : dieselRateFor((entry as any).diesel_type, onRoadRate, offRoadRate);

    return sum + Number(entry.gallons || 0) * rate;
  }, 0);

const periodRange = (p: Period): { from: string; to: string } => {
  const now = new Date();
  let from: Date;
  let to: Date;
  if (p === "day") {
    from = startOfDay(now);
    to = endOfDay(now);
  } else if (p === "week") {
    from = startOfWeek(now, { weekStartsOn: 1 });
    to = endOfWeek(now, { weekStartsOn: 1 });
  } else {
    from = startOfMonth(now);
    to = endOfMonth(now);
  }
  return { from: from.toISOString(), to: to.toISOString() };
};


function GallonsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 shadow-xl">
      <p className="text-lg font-bold text-white">{label}</p>
      <p className="mt-2 text-sm text-zinc-300">
        Gallons:
        <span className="ml-2 text-xl font-bold text-orange-400">
          {Number(payload[0].value).toFixed(2)} gal
        </span>
      </p>
    </div>
  );
}

function CostTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 shadow-xl">
      <p className="text-lg font-bold text-white">{label}</p>
      <p className="mt-2 text-sm text-zinc-300">
        Total:
        <span className="ml-2 text-xl font-bold text-orange-400">
          ${Number(payload[0].value).toFixed(2)}
        </span>
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * VEHICLES LIST TAB
 * ────────────────────────────────────────────────────────────────── */



const DashboardTab = ({
  onGoToTab,
}: {
  onGoToTab: (tab: string) => void;
}) => {
  const onRoadDieselRate = getOnRoadDieselRate();
  const offRoadDieselRate = getOffRoadDieselRate();

  const { data: equipment = [] } = useEquipment({ activeOnly: true });
  const { data: fuelSummary } = useFuelSummary({});
  const { data: fuelEntries = [] } = useFuelEntries({});
  const { data: maintenanceSummary } = useMaintenanceSummary({});
  const { data: maintenanceEntries = [] } = useMaintenanceEntries({});

  const totalGallons = fuelSummary?.total ?? 0;
  const fuelCost = calculateFuelCost(fuelEntries, onRoadDieselRate, offRoadDieselRate);
  const maintenanceCost = maintenanceSummary?.totalCost ?? 0;
  const totalFleetCost = fuelCost + maintenanceCost;

  const daysSince = (dateString?: string) => {
    if (!dateString) return null;
    const ms = Date.now() - new Date(dateString).getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  };

  const alerts = equipment.flatMap((vehicle) => {
    const vehicleFuel = fuelEntries.filter((e) => e.equipment_id === vehicle.id);
    const vehicleMaintenance = maintenanceEntries.filter((e) => e.equipment_id === vehicle.id);

    const latestFuel = vehicleFuel[0];
    const latestFuelDays = daysSince(latestFuel?.logged_at);

    const vehicleMaintenanceCost = vehicleMaintenance.reduce(
      (sum, e) => sum + Number(e.cost),
      0
    );

    const vehicleAlerts = [];

    if (vehicleFuel.length === 0) {
      vehicleAlerts.push({
        level: "medium",
        title: `${vehicle.code} has no fuel records`,
        description: `${vehicle.name} has never had fuel logged.`,
      });
    } else if (latestFuelDays !== null && latestFuelDays > 30) {
      vehicleAlerts.push({
        level: "medium",
        title: `${vehicle.code} has not been fueled recently`,
        description: `Last fuel entry was ${latestFuelDays} days ago.`,
      });
    }

    if (vehicleMaintenanceCost > 4000) {
      vehicleAlerts.push({
        level: "high",
        title: `${vehicle.code} has high maintenance cost`,
        description: `$${vehicleMaintenanceCost.toFixed(2)} in maintenance logged.`,
      });
    }

    if (vehicleMaintenance.length === 0) {
      vehicleAlerts.push({
        level: "low",
        title: `${vehicle.code} has no maintenance history`,
        description: `${vehicle.name} has no maintenance records yet.`,
      });
    }

    return vehicleAlerts;
  });

  const highAlerts = alerts.filter((a) => a.level === "high").length;
  const mediumAlerts = alerts.filter((a) => a.level === "medium").length;

  const recentActivity = [
    ...fuelEntries.map((entry) => ({
      id: `fuel-${entry.id}`,
      type: "Fuel",
      date: entry.logged_at,
      title: entry.equipment?.code || "Unknown Vehicle",
      detail: `${Number(entry.gallons).toFixed(2)} gallons`,
      sub: entry.logged_by_name || "No operator",
    })),
    ...maintenanceEntries.map((entry) => ({
      id: `maintenance-${entry.id}`,
      type: "Maintenance",
      date: entry.logged_at,
      title: entry.equipment?.code || "Unknown Vehicle",
      detail: `$${Number(entry.cost).toFixed(2)}`,
      sub: entry.description,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);


  const fuelByCompany = ENTITIES.map((entity) => ({
    name: entity.code,
    gallons: fuelSummary?.byEntity?.[entity.code] ?? 0,
    fill: ENTITY_HEX[entity.code],
  })).filter((row) => row.gallons > 0);

  const topVehiclesChart = (fuelSummary?.byEquipment ?? [])
    .slice(0, 5)
    .map((vehicle) => ({
      name: vehicle.code,
      gallons: Number(vehicle.gallons) || 0,
    }));

  const spendingChart = [
    { name: "Fuel", amount: fuelCost },
    { name: "Maintenance", amount: maintenanceCost },
  ];

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.26),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] p-6 shadow-2xl shadow-black/30">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] text-orange-300">
              <span className="h-2 w-2 rounded-full bg-orange-400 shadow-[0_0_16px_rgba(251,146,60,0.9)]" />
              Live Fleet Command
            </div>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">Fleet Dashboard</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Real-time view of vehicles, fuel usage, maintenance costs, alerts, and operational activity.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Fleet Cost</p>
              <p className="mt-1 text-2xl font-black text-white">${totalFleetCost.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Entries</p>
              <p className="mt-1 text-2xl font-black text-white">{fuelEntries.length + maintenanceEntries.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Alerts</p>
              <p className="mt-1 text-2xl font-black text-orange-300">{alerts.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={<Truck className="h-4 w-4 text-orange-400" />}
          label="Active Vehicles"
          value={String(equipment.length)}
          sub="click to view vehicles"
          onClick={() => onGoToTab("list")}
        />

        <StatCard
          icon={<Fuel className="h-4 w-4 text-orange-400" />}
          label="Fuel Logged"
          value={`${totalGallons.toFixed(2)} gal`}
          sub="click to view fuel log"
          onClick={() => onGoToTab("fuel")}
        />

        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
          label="Fuel Cost"
          value={`$${fuelCost.toFixed(2)}`}
          sub="click to view costs"
          onClick={() => onGoToTab("cost")}
        />

        <StatCard
          icon={<ListChecks className="h-4 w-4 text-sky-400" />}
          label="Maintenance"
          value={`$${maintenanceCost.toFixed(2)}`}
          sub="click to view activity"
          onClick={() => onGoToTab("activity")}
        />

        <StatCard
          icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
          label="Fleet Alerts"
          value={String(alerts.length)}
          sub="click to view alerts"
          onClick={() => document.getElementById("fleet-alerts-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="border-white/10 bg-slate-950/70 shadow-xl shadow-black/20 backdrop-blur xl:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-white">Quick Actions</CardTitle>
            <CardDescription>Jump directly to common fleet tasks.</CardDescription>
          </CardHeader>

          <CardContent className="grid grid-cols-1 gap-3">
            <Button className="h-12 justify-start rounded-xl bg-orange-600 font-bold hover:bg-orange-500" onClick={() => onGoToTab("list")}>
              <Plus className="h-4 w-4 mr-2" />
              Add / Manage Vehicles
            </Button>

            <Button className="h-12 justify-start rounded-xl border-white/10 bg-slate-900/70 hover:bg-slate-800" variant="outline" onClick={() => onGoToTab("activity")}>
              <ListChecks className="h-4 w-4 mr-2" />
              Fleet Activity
            </Button>

            <Button className="h-12 justify-start rounded-xl border-white/10 bg-slate-900/70 hover:bg-slate-800" variant="outline" onClick={() => onGoToTab("cost")}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Cost Tracking
            </Button>

            <Button className="h-12 justify-start rounded-xl border-white/10 bg-slate-900/70 hover:bg-slate-800" variant="outline" onClick={() => window.open("/vehicles/print-qr", "_blank")}>
              <Printer className="h-4 w-4 mr-2" />
              Print QR Codes
            </Button>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/70 shadow-xl shadow-black/20 backdrop-blur xl:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-white">Recent Activity</CardTitle>
                <CardDescription>Latest fuel and maintenance activity.</CardDescription>
              </div>
              <Button variant="ghost" className="text-orange-400 hover:bg-orange-500/10 hover:text-orange-300" onClick={() => onGoToTab("activity")}>
                View all
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-8 text-center text-sm text-slate-500">
                No recent activity yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {recentActivity.map((item) => (
                  <div key={item.id} className="group flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/50 p-4 transition hover:border-orange-500/25 hover:bg-slate-900">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${item.type === "Fuel" ? "border-orange-500/20 bg-orange-500/10" : "border-sky-500/20 bg-sky-500/10"}`}>
                        {item.type === "Fuel" ? "⛽" : "🔧"}
                      </div>
                      <div>
                        <p className="font-bold text-white">{item.title}</p>
                        <p className="max-w-[220px] truncate text-sm text-slate-400">{item.sub}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-mono font-black text-white">{item.detail}</p>
                      <p className="text-xs text-slate-500">{format(parseISO(item.date), "MMM d, h:mm a")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card id="fleet-alerts-section" className="scroll-mt-24 border-white/10 bg-slate-950/70 shadow-xl shadow-black/20 backdrop-blur xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-white">Fleet Alerts</CardTitle>
            <CardDescription>Automatic warnings based on fuel activity and maintenance spending.</CardDescription>
          </CardHeader>

          <CardContent>
            {alerts.length === 0 ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center text-sm text-emerald-300">
                No fleet alerts right now. Everything looks good.
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.slice(0, 6).map((alert, index) => (
                  <div key={index} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-900/50 p-4">
                    <AlertTriangle
                      className={
                        alert.level === "high"
                          ? "mt-0.5 h-5 w-5 text-red-400"
                          : alert.level === "medium"
                          ? "mt-0.5 h-5 w-5 text-yellow-400"
                          : "mt-0.5 h-5 w-5 text-sky-400"
                      }
                    />

                    <div>
                      <p className="font-bold text-white">{alert.title}</p>
                      <p className="text-sm text-slate-400">{alert.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/70 shadow-xl shadow-black/20 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="text-white">Fleet Overview</CardTitle>
            <CardDescription>Cost breakdown summary.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-sm text-slate-400">Fuel Spending</p>
              <p className="mt-1 text-3xl font-black text-white">${fuelCost.toFixed(2)}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-sm text-slate-400">Maintenance Spending</p>
              <p className="mt-1 text-3xl font-black text-white">${maintenanceCost.toFixed(2)}</p>
            </div>

            <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
              <p className="text-sm text-orange-300">Total Fleet Cost</p>
              <p className="mt-1 text-3xl font-black text-white">${totalFleetCost.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="border-white/10 bg-slate-950/70 shadow-xl shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Fuel by Company</CardTitle>
            <CardDescription>Total gallons grouped by company.</CardDescription>
          </CardHeader>
          <CardContent>
            {fuelByCompany.length === 0 ? (
              <div className="h-52 flex items-center justify-center rounded-2xl border border-white/10 bg-slate-900/50 text-sm text-slate-500">
                No fuel data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={fuelByCompany}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.22} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} width={40} />
                  <RechartTooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} content={<GallonsTooltip />} />
                  <Bar dataKey="gallons" radius={[8, 8, 0, 0]}>
                    {fuelByCompany.map((row) => (
                      <Cell key={row.name} fill={row.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/70 shadow-xl shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Top Vehicles</CardTitle>
            <CardDescription>Highest fuel usage by vehicle.</CardDescription>
          </CardHeader>
          <CardContent>
            {topVehiclesChart.length === 0 ? (
              <div className="h-52 flex items-center justify-center rounded-2xl border border-white/10 bg-slate-900/50 text-sm text-slate-500">
                No vehicle fuel data yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={topVehiclesChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.22} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} width={40} />
                  <RechartTooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} content={<GallonsTooltip />} />
                  <Bar dataKey="gallons" fill="#f97316" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/70 shadow-xl shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Fuel vs Maintenance</CardTitle>
            <CardDescription>Estimated fuel cost compared with logged maintenance.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={spendingChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.22} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} width={55} />
                <RechartTooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} content={<CostTooltip />} />
                <Bar dataKey="amount" fill="#f97316" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const VehicleHistoryDialog = ({
  vehicle,
  onClose,
}: {
  vehicle: Equipment | null;
  onClose: () => void;
}) => {
  const [profileTab, setProfileTab] = useState("overview");
  const { data: fuelEntries = [], isLoading: fuelLoading } = useFuelEntries(
    vehicle ? { equipmentId: vehicle.id } : {}
  );

  const { data: maintenanceEntries = [], isLoading: maintenanceLoading } =
    useMaintenanceEntries(vehicle ? { equipmentId: vehicle.id } : {});

  const totalGallons = fuelEntries.reduce(
    (sum, entry) => sum + Number(entry.gallons),
    0
  );

  const totalMaintenanceCost = maintenanceEntries.reduce(
    (sum, entry) => sum + Number(entry.cost),
    0
  );

  const totalFuelCost = calculateFuelCost(fuelEntries, getOnRoadDieselRate(), getOffRoadDieselRate());
  const totalVehicleCost = totalFuelCost + totalMaintenanceCost;

  const averageGallons =
    fuelEntries.length > 0 ? totalGallons / fuelEntries.length : 0;

  const latestFuel = fuelEntries[0];
  const latestMaintenance = maintenanceEntries[0];
  const vehicleAny = (vehicle ?? {}) as any;

  const fuelActivity = fuelEntries.map((entry) => ({
    id: `fuel-${entry.id}`,
    type: "Fuel",
    date: entry.logged_at,
    amount: `${Number(entry.gallons).toFixed(2)} gal`,
    cost: `$${calculateFuelCost([entry as any], getOnRoadDieselRate(), getOffRoadDieselRate()).toFixed(2)}`,
    description: dieselTypeLabel((entry as any).diesel_type),
    entity: entry.entity,
    operator: entry.logged_by_name || "—",
  }));

  const maintenanceActivity = maintenanceEntries.map((entry) => ({
    id: `maintenance-${entry.id}`,
    type: "Maintenance",
    date: entry.logged_at,
    amount: "—",
    cost: `$${Number(entry.cost).toFixed(2)}`,
    description: entry.description,
    entity: entry.entity,
    operator: entry.logged_by_name || "—",
  }));

  const activity = [...fuelActivity, ...maintenanceActivity].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const isLoading = fuelLoading || maintenanceLoading;

  const DetailBox = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value || "—"}</p>
    </div>
  );

  const ActivityTable = ({ rows }: { rows: typeof activity }) => (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date / Time</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Operator</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                Loading vehicle profile…
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                No records for this section yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{format(parseISO(entry.date), "MMM d, yyyy h:mm a")}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      entry.type === "Fuel"
                        ? "border-orange-500 text-orange-500"
                        : "border-blue-500 text-blue-500"
                    }
                  >
                    {entry.type === "Fuel" ? "⛽ Fuel" : "🔧 Maintenance"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={`${ENTITY_COLORS[entry.entity]} border-0 text-white`}>
                    {ENTITY_NAMES[entry.entity]}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono">{entry.amount}</TableCell>
                <TableCell className="text-right font-mono font-bold">{entry.cost}</TableCell>
                <TableCell className="max-w-[280px] truncate">{entry.description}</TableCell>
                <TableCell>{entry.operator}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <Dialog open={!!vehicle} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-7xl overflow-y-auto border-white/10 bg-slate-950 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black">Vehicle Profile — {vehicle?.code}</DialogTitle>
          <DialogDescription>
            Full profile, fuel history, maintenance, costs, documents, and QR code for {vehicle?.name}.
          </DialogDescription>
        </DialogHeader>

        {!vehicle ? null : (
          <div className="space-y-5">
            <div className="overflow-hidden rounded-3xl border border-orange-500/20 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.22),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
                    {vehicle.photo_url ? (
                      <img src={vehicle.photo_url} alt={vehicle.name} className="h-full w-full object-cover" />
                    ) : (
                      <Truck className="h-10 w-10 text-orange-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-3xl font-black tracking-tight">{vehicle.name}</h2>
                      <Badge className={vehicle.active ? "border-0 bg-emerald-600 text-white" : "border-0 bg-slate-700 text-white"}>
                        {vehicle.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="mt-1 font-mono text-orange-300">{vehicle.code}</p>
                    <p className="mt-1 text-sm text-slate-400">
                      {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" • ") || "No specifications added yet"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Fuel</p>
                    <p className="mt-1 text-2xl font-black">{totalGallons.toFixed(2)} gal</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Fuel Cost</p>
                    <p className="mt-1 text-2xl font-black">${totalFuelCost.toFixed(2)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Maintenance</p>
                    <p className="mt-1 text-2xl font-black">${totalMaintenanceCost.toFixed(2)}</p>
                  </div>
                  <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4 text-center">
                    <p className="text-xs uppercase tracking-[0.18em] text-orange-300">Total Cost</p>
                    <p className="mt-1 text-2xl font-black">${totalVehicleCost.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            <ToggleGroup type="single" value={profileTab} onValueChange={(v) => v && setProfileTab(v)} className="flex flex-wrap justify-start gap-2">
              <ToggleGroupItem value="overview">Overview</ToggleGroupItem>
              <ToggleGroupItem value="fuel">Fuel History</ToggleGroupItem>
              <ToggleGroupItem value="maintenance">Maintenance</ToggleGroupItem>
              <ToggleGroupItem value="costs">Costs</ToggleGroupItem>
              <ToggleGroupItem value="documents">Documents</ToggleGroupItem>
              <ToggleGroupItem value="qr">QR Code</ToggleGroupItem>
            </ToggleGroup>

            {profileTab === "overview" && (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <Card className="border-white/10 bg-slate-950/70 xl:col-span-2">
                  <CardHeader>
                    <CardTitle>Vehicle Details</CardTitle>
                    <CardDescription>General, specifications, usage, financial, and service information.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div>
                      <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-orange-400">General</h3>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <DetailBox label="Code" value={vehicle.code} />
                        <DetailBox label="Name" value={vehicle.name} />
                        <DetailBox label="Category" value={vehicle.category || "—"} />
                        <DetailBox label="Company" value={vehicleAny.company || vehicleAny.entity || "Not assigned"} />
                        <DetailBox label="Status" value={vehicle.active ? "Active" : "Inactive"} />
                        <DetailBox label="Default Fuel Type" value={dieselTypeLabel(vehicleAny.fuel_type || vehicleAny.diesel_type)} />
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-orange-400">Specifications</h3>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <DetailBox label="Make" value={vehicle.make || "—"} />
                        <DetailBox label="Model" value={vehicle.model || "—"} />
                        <DetailBox label="Year" value={vehicle.year || "—"} />
                        <DetailBox label="VIN / Serial" value={vehicleAny.vin || vehicleAny.serial_number || "Not added"} />
                        <DetailBox label="License Plate" value={vehicle.license_plate || "—"} />
                        <DetailBox label="Photo URL" value={vehicle.photo_url ? "Added" : "Not added"} />
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-orange-400">Usage & Financial</h3>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <DetailBox label="Current Hours" value={vehicleAny.current_hours || "Not added"} />
                        <DetailBox label="Current Mileage" value={vehicleAny.current_mileage || vehicleAny.odometer || "Not added"} />
                        <DetailBox label="Purchase Date" value={vehicleAny.purchase_date || "Not added"} />
                        <DetailBox label="Purchase Cost" value={vehicleAny.purchase_cost ? `$${Number(vehicleAny.purchase_cost).toFixed(2)}` : "Not added"} />
                        <DetailBox label="Estimated Value" value={vehicleAny.estimated_value ? `$${Number(vehicleAny.estimated_value).toFixed(2)}` : "Not added"} />
                        <DetailBox label="Assigned Mechanic" value={vehicleAny.assigned_mechanic || "Not assigned"} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-slate-950/70">
                  <CardHeader>
                    <CardTitle>Service Snapshot</CardTitle>
                    <CardDescription>Latest activity and upcoming service placeholders.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <DetailBox label="Last Fuel" value={latestFuel ? format(parseISO(latestFuel.logged_at), "MMM d, yyyy") : "No fuel yet"} />
                    <DetailBox label="Last Maintenance" value={latestMaintenance ? format(parseISO(latestMaintenance.logged_at), "MMM d, yyyy") : "No maintenance yet"} />
                    <DetailBox label="Next Service Date" value={vehicleAny.next_service_date || "Not scheduled"} />
                    <DetailBox label="Service Interval" value={vehicleAny.service_interval || "Not configured"} />
                    <DetailBox label="Warranty" value={vehicleAny.warranty_expiration || "Not added"} />
                    <DetailBox label="Registration" value={vehicleAny.registration_expiration || "Not added"} />
                  </CardContent>
                </Card>
              </div>
            )}

            {profileTab === "fuel" && (
              <Card className="border-white/10 bg-slate-950/70">
                <CardHeader>
                  <CardTitle>Fuel History</CardTitle>
                  <CardDescription>Fuel entries with On-Road and Off-Road diesel pricing applied.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ActivityTable rows={fuelActivity} />
                </CardContent>
              </Card>
            )}

            {profileTab === "maintenance" && (
              <Card className="border-white/10 bg-slate-950/70">
                <CardHeader>
                  <CardTitle>Maintenance</CardTitle>
                  <CardDescription>Maintenance jobs, costs, descriptions, and operators.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ActivityTable rows={maintenanceActivity} />
                </CardContent>
              </Card>
            )}

            {profileTab === "costs" && (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <Card className="border-white/10 bg-slate-950/70">
                  <CardHeader><CardTitle>Fuel Cost</CardTitle></CardHeader>
                  <CardContent><p className="text-4xl font-black text-white">${totalFuelCost.toFixed(2)}</p><p className="mt-2 text-sm text-slate-400">{totalGallons.toFixed(2)} gallons logged</p></CardContent>
                </Card>
                <Card className="border-white/10 bg-slate-950/70">
                  <CardHeader><CardTitle>Maintenance Cost</CardTitle></CardHeader>
                  <CardContent><p className="text-4xl font-black text-white">${totalMaintenanceCost.toFixed(2)}</p><p className="mt-2 text-sm text-slate-400">{maintenanceEntries.length} maintenance entries</p></CardContent>
                </Card>
                <Card className="border-orange-500/20 bg-orange-500/10">
                  <CardHeader><CardTitle>Total Vehicle Cost</CardTitle></CardHeader>
                  <CardContent><p className="text-4xl font-black text-white">${totalVehicleCost.toFixed(2)}</p><p className="mt-2 text-sm text-orange-200">Fuel + maintenance combined</p></CardContent>
                </Card>
                <Card className="border-white/10 bg-slate-950/70 lg:col-span-3">
                  <CardHeader>
                    <CardTitle>Diesel Price Reference</CardTitle>
                    <CardDescription>Rates used by the vehicle profile calculations.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <DetailBox label="On-Road Diesel" value={`$${getOnRoadDieselRate().toFixed(2)} / gal`} />
                    <DetailBox label="Off-Road Diesel" value={`$${getOffRoadDieselRate().toFixed(2)} / gal`} />
                  </CardContent>
                </Card>
              </div>
            )}

            {profileTab === "documents" && (
              <Card className="border-white/10 bg-slate-950/70">
                <CardHeader>
                  <CardTitle>Documents & Attachments</CardTitle>
                  <CardDescription>Photos, receipts, manuals, warranties, and insurance documents.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/40 p-8 text-center">
                    <FileUp className="mx-auto h-10 w-10 text-slate-500" />
                    <h3 className="mt-3 text-lg font-bold text-white">Document center placeholder</h3>
                    <p className="mt-1 text-sm text-slate-400">Next step: connect Supabase Storage for receipts, manuals, warranty files, and equipment photos.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {profileTab === "qr" && (
              <Card className="border-white/10 bg-slate-950/70">
                <CardHeader>
                  <CardTitle>QR Code</CardTitle>
                  <CardDescription>Print, download, or export the QR code for this vehicle.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start">
                    <div className="rounded-2xl bg-white p-4">
                      <QRCodeCard equipment={vehicle} size={260} />
                    </div>
                    <div className="grid w-full gap-3 lg:max-w-sm">
                      <Button variant="outline" onClick={() => downloadEquipmentQRPng(vehicle, 640)}><Download className="mr-2 h-4 w-4" />Download PNG</Button>
                      <Button variant="outline" onClick={() => downloadEquipmentQRSvg(vehicle, 400)}><Download className="mr-2 h-4 w-4" />Download SVG</Button>
                      <Button variant="outline" onClick={() => window.open(`/vehicles/print-qr?codes=${encodeURIComponent(vehicle.code)}`, "_blank")}><Printer className="mr-2 h-4 w-4" />Print QR Code</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const VehiclesListTab = ({
  onOpenImport,
}: {
  onOpenImport: () => void;
}) => {
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ExtendedEquipmentInput>(EMPTY_FORM);
  const [qrFor, setQrFor] = useState<Equipment | null>(null);
  const [historyFor, setHistoryFor] = useState<Equipment | null>(null);

  const { data: equipment = [], isLoading } = useEquipment({ activeOnly: !showInactive });
  const createMut = useCreateEquipment();
  const updateMut = useUpdateEquipment();
  const deleteMut = useDeleteEquipment();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return equipment.filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        e.code.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        (e.make || "").toLowerCase().includes(q) ||
        (e.model || "").toLowerCase().includes(q)
      );
    });
  }, [equipment, search, categoryFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setCreating(true);
  };

  const openEdit = (e: Equipment) => {
  setEditing(e);
  const equipmentDetails = e as Equipment & ExtendedEquipmentFields;
  setForm({
    code: e.code,
    name: e.name,
    category: e.category,
    make: e.make ?? "",
    model: e.model ?? "",
    year: e.year ?? null,
    license_plate: e.license_plate ?? "",
    active: e.active,
    notes: e.notes ?? "",
    photo_url: e.photo_url ?? "",

    company: equipmentDetails.company ?? "",
    fuel_type: equipmentDetails.fuel_type ?? "off_road",
    vin: equipmentDetails.vin ?? "",
    serial_number: equipmentDetails.serial_number ?? "",
    current_hours: equipmentDetails.current_hours ?? null,
    current_mileage: equipmentDetails.current_mileage ?? null,
    purchase_date: equipmentDetails.purchase_date ?? "",
    purchase_cost: equipmentDetails.purchase_cost ?? null,
    estimated_value: equipmentDetails.estimated_value ?? null,
    next_service_date: equipmentDetails.next_service_date ?? "",
    service_interval: equipmentDetails.service_interval ?? "",
    assigned_mechanic: equipmentDetails.assigned_mechanic ?? "",
    warranty_expiration: equipmentDetails.warranty_expiration ?? "",
    registration_expiration: equipmentDetails.registration_expiration ?? "",
    insurance_expiration: equipmentDetails.insurance_expiration ?? "",
  });
  setCreating(true);
};

  const closeDialog = () => {
    setCreating(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Code and Name are required");
      return;
    }

    const vehiclePayload = {
      ...form,
      code: form.code.trim(),
      name: form.name.trim(),
      make: form.make || null,
      model: form.model || null,
      license_plate: form.license_plate || null,
      notes: form.notes || null,
      photo_url: form.photo_url || null,
      company: form.company || null,
      fuel_type: form.fuel_type || "off_road",
      vin: form.vin || null,
      serial_number: form.serial_number || null,
      purchase_date: form.purchase_date || null,
      next_service_date: form.next_service_date || null,
      service_interval: form.service_interval || null,
      assigned_mechanic: form.assigned_mechanic || null,
      warranty_expiration: form.warranty_expiration || null,
      registration_expiration: form.registration_expiration || null,
      insurance_expiration: form.insurance_expiration || null,
    };

    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, ...vehiclePayload } as any);
        toast.success("Vehicle updated");
      } else {
        await createMut.mutateAsync(vehiclePayload as any);
        toast.success("Vehicle added — QR code ready.");
      }
      closeDialog();
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.toLowerCase().includes("duplicate") || e?.code === "23505") {
        toast.error(`Code "${form.code}" is already in use`);
      } else {
        toast.error(msg || "Save failed");
      }
    }
  };

  const toggleActive = async (e: Equipment) => {
  try {
    await updateMut.mutateAsync({ id: e.id, active: !e.active });
  } catch (err: any) {
    toast.error(err?.message || "Update failed");
  }
};

const handleDelete = async (e: Equipment) => {
  const confirmed = window.confirm(
    `Delete ${e.code} — ${e.name}?\n\nOnly delete test vehicles. For real vehicles, mark them inactive instead.`
  );

  if (!confirmed) return;

  try {
    await deleteMut.mutateAsync(e.id);
    toast.success("Vehicle deleted");
  } catch (err: any) {
    const msg = String(err?.message || "");

    if (msg.includes("violates foreign key constraint")) {
      toast.error(
        "This vehicle has fuel history and cannot be deleted. Mark it inactive instead."
      );
    } else {
      toast.error(msg || "Delete failed");
    }
  }
};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search code, name, make, model…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {EQUIPMENT_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} />
          Show inactive
        </label>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onOpenImport}>
            <FileUp className="h-4 w-4 mr-1.5" /> Import Spreadsheet
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/vehicles/print-qr">
              <Printer className="h-4 w-4 mr-1.5" /> Print All QR Codes
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/vehicles/qr-export">
              <Download className="h-4 w-4 mr-1.5" /> QR Code Export
            </Link>
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Vehicle
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Make / Model</TableHead>
              <TableHead className="w-[70px]">Year</TableHead>
              <TableHead>License</TableHead>
              <TableHead className="w-[110px]">Active</TableHead>
              <TableHead className="w-[70px] text-center">History</TableHead>
              <TableHead className="w-[60px] text-center">QR</TableHead>
              <TableHead className="w-[60px] text-center">Edit</TableHead>
              <TableHead className="w-[60px] text-center">Delete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">No vehicles found</TableCell></TableRow>
            ) : (
              filtered.map((e) => (
                <TableRow
                  key={e.id}
                  onClick={(event) => { event.stopPropagation(); setHistoryFor(e); }}
                  className={`${!e.active ? "opacity-60" : ""} cursor-pointer transition hover:bg-orange-500/5`}
                >
                  <TableCell className="font-mono font-semibold">{e.code}</TableCell>
                  <TableCell>{e.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground capitalize">{e.category || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[e.make, e.model].filter(Boolean).join(" / ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.year || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.license_plate || "—"}</TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <Switch checked={e.active} onCheckedChange={() => toggleActive(e)} />
                  </TableCell>

                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(event) => { event.stopPropagation(); setHistoryFor(e); }}
                    >
                      <History className="h-4 w-4" />
                    </Button>
                  </TableCell>

                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(event) => { event.stopPropagation(); setQrFor(e); }}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </TableCell>

                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(event) => { event.stopPropagation(); openEdit(e); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>

                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      onClick={(event) => { event.stopPropagation(); handleDelete(e); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>

                </TableRow>
              )))}
            </TableBody>
</Table>
</div>

{/* Add / Edit dialog */}
<Dialog open={creating} onOpenChange={(o) => !o && closeDialog()}>
  <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
    <DialogHeader>
      <DialogTitle>{editing ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
      <DialogDescription>
        The code is what gets encoded into the QR sticker on the machine.
      </DialogDescription>
    </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Code <span className="text-destructive">*</span></Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.trim() })}
                placeholder="EXC-01"
                className="font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label>Category</Label>
              <Select
                value={form.category || ""}
                onValueChange={(v) => setForm({ ...form, category: (v || null) as any })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick…" />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 space-y-1">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="CAT 320 Excavator"
              />
            </div>

            <div className="space-y-1">
              <Label>Company</Label>
              <Input
                value={form.company || ""}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Mr. Pave"
              />
            </div>

            <div className="space-y-1">
              <Label>Default Fuel Type</Label>
              <Select
                value={form.fuel_type || "off_road"}
                onValueChange={(v) => setForm({ ...form, fuel_type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select fuel type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off_road">Off-Road Diesel</SelectItem>
                  <SelectItem value="on_road">On-Road Diesel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Make</Label>
              <Input
                value={form.make || ""}
                onChange={(e) => setForm({ ...form, make: e.target.value })}
                placeholder="CAT"
              />
            </div>

            <div className="space-y-1">
              <Label>Model</Label>
              <Input
                value={form.model || ""}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="320"
              />
            </div>

            <div className="space-y-1">
              <Label>Year</Label>
              <Input
                type="number"
                value={form.year ?? ""}
                onChange={(e) => setForm({ ...form, year: e.target.value ? Number(e.target.value) : null })}
                placeholder="2021"
              />
            </div>

            <div className="space-y-1">
              <Label>License Plate</Label>
              <Input
                value={form.license_plate || ""}
                onChange={(e) => setForm({ ...form, license_plate: e.target.value })}
                placeholder="ABC-1234"
              />
            </div>

            <div className="space-y-1">
              <Label>VIN</Label>
              <Input
                value={form.vin || ""}
                onChange={(e) => setForm({ ...form, vin: e.target.value })}
                placeholder="Vehicle VIN"
              />
            </div>

            <div className="space-y-1">
              <Label>Serial Number</Label>
              <Input
                value={form.serial_number || ""}
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                placeholder="Equipment serial number"
              />
            </div>

            <div className="space-y-1">
              <Label>Current Hours</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={form.current_hours ?? ""}
                onChange={(e) => setForm({ ...form, current_hours: e.target.value ? Number(e.target.value) : null })}
                placeholder="1250.5"
              />
            </div>

            <div className="space-y-1">
              <Label>Current Mileage</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={form.current_mileage ?? ""}
                onChange={(e) => setForm({ ...form, current_mileage: e.target.value ? Number(e.target.value) : null })}
                placeholder="58200"
              />
            </div>

            <div className="space-y-1">
              <Label>Purchase Date</Label>
              <Input
                type="date"
                value={form.purchase_date || ""}
                onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label>Purchase Cost</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.purchase_cost ?? ""}
                onChange={(e) => setForm({ ...form, purchase_cost: e.target.value ? Number(e.target.value) : null })}
                placeholder="85000"
              />
            </div>

            <div className="space-y-1">
              <Label>Estimated Value</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.estimated_value ?? ""}
                onChange={(e) => setForm({ ...form, estimated_value: e.target.value ? Number(e.target.value) : null })}
                placeholder="72000"
              />
            </div>

            <div className="space-y-1">
              <Label>Assigned Mechanic</Label>
              <Input
                value={form.assigned_mechanic || ""}
                onChange={(e) => setForm({ ...form, assigned_mechanic: e.target.value })}
                placeholder="Mechanic name"
              />
            </div>

            <div className="space-y-1">
              <Label>Next Service Date</Label>
              <Input
                type="date"
                value={form.next_service_date || ""}
                onChange={(e) => setForm({ ...form, next_service_date: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label>Service Interval</Label>
              <Input
                value={form.service_interval || ""}
                onChange={(e) => setForm({ ...form, service_interval: e.target.value })}
                placeholder="Every 250 hours"
              />
            </div>

            <div className="space-y-1">
              <Label>Warranty Expiration</Label>
              <Input
                type="date"
                value={form.warranty_expiration || ""}
                onChange={(e) => setForm({ ...form, warranty_expiration: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label>Registration Expiration</Label>
              <Input
                type="date"
                value={form.registration_expiration || ""}
                onChange={(e) => setForm({ ...form, registration_expiration: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label>Insurance Expiration</Label>
              <Input
                type="date"
                value={form.insurance_expiration || ""}
                onChange={(e) => setForm({ ...form, insurance_expiration: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label>Photo URL</Label>
              <Input
                value={form.photo_url || ""}
                onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                placeholder="https://..."
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                placeholder="Internal notes, condition, ownership details, reminders..."
              />
            </div>

            <div className="md:col-span-2 flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Inactive vehicles still keep history but are hidden from the public form.
                </p>
              </div>
              <Switch
                checked={form.active ?? true}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {editing ? "Save changes" : "Add Vehicle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR dialog */}
      <Dialog open={!!qrFor} onOpenChange={(o) => !o && setQrFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code — {qrFor?.code}</DialogTitle>
            <DialogDescription className="break-all">
              {qrFor && fuelUrlForCode(qrFor.code)}
            </DialogDescription>
          </DialogHeader>
          {qrFor && (
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-lg">
                <QRCodeCard equipment={qrFor} size={260} />
              </div>
              <div className="grid grid-cols-3 gap-2 w-full">
                <Button
                  variant="outline"
                  onClick={() => downloadEquipmentQRPng(qrFor, 640)}
                >
                  <Download className="h-4 w-4 mr-1.5" /> PNG
                </Button>
                <Button
                  variant="outline"
                  onClick={() => downloadEquipmentQRSvg(qrFor, 400)}
                >
                  <Download className="h-4 w-4 mr-1.5" /> SVG
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    window.open(
                      `/vehicles/print-qr?codes=${encodeURIComponent(qrFor.code)}`,
                      "_blank",
                    )
                  }
                >
                  <Printer className="h-4 w-4 mr-1.5" /> Print
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <VehicleHistoryDialog
        vehicle={historyFor}
        onClose={() => setHistoryFor(null)}
      />
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────
 * FUEL LOG TAB
 * ────────────────────────────────────────────────────────────────── */

const FuelLogTab = () => {
  const [period, setPeriod] = useState<Period>("week");
  const [entityFilter, setEntityFilter] = useState<EntityCode | "all">("all");
  const [equipFilter, setEquipFilter] = useState<string>("all");

  const { from, to } = useMemo(() => periodRange(period), [period]);
  const { data: equipment = [] } = useEquipment({ activeOnly: true });
  const filters = {
    from,
    to,
    entity: entityFilter,
    equipmentId: equipFilter === "all" ? undefined : equipFilter,
  };
  const { data: entries = [], isLoading } = useFuelEntries(filters);
  const { data: summary } = useFuelSummary(filters);

  const topEntity = useMemo<{ code: EntityCode; gallons: number } | null>(() => {
    if (!summary?.byEntity) return null;
    let best: { code: EntityCode; gallons: number } | null = null;
    const entries = Object.entries(summary.byEntity) as [EntityCode, number][];
    for (const [code, gallons] of entries) {
      if (!best || gallons > best.gallons) best = { code, gallons };
    }
    return best && best.gallons > 0 ? best : null;
  }, [summary]);
  const topEquip = summary?.byEquipment?.[0] || null;

  // Chart data — per period bucket. For "day", group by hour; for week/month, by day.
  const chartData = useMemo(() => {
    if (entries.length === 0) return [];
    type Bucket = { label: string; total: number } & Partial<Record<EntityCode, number>>;
    const buckets = new Map<string, Bucket>();
    for (const e of entries) {
      let key: string;
      let label: string;
      const dt = parseISO(e.logged_at);
      if (period === "day") {
        const bucket = startOfHour(dt);
        key = bucket.toISOString();
        label = format(bucket, "ha");
      } else {
        key = e.logged_at.slice(0, 10);
        label = format(parseISO(key), period === "week" ? "EEE" : "MMM d");
      }
      const b = buckets.get(key) || { label, total: 0 } as Bucket;
      const g = Number(e.gallons) || 0;
      b.total += g;
      b[e.entity] = (b[e.entity] || 0) + g;
      buckets.set(key, b);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [entries, period]);

  const exportCsv = () => {
    const header = ["Logged At", "Code", "Name", "Gallons", "Entity", "Logged By"];
    const rows = entries.map((e) => [
      e.logged_at,
      e.equipment?.code || "",
      e.equipment?.name || "",
      String(e.gallons),
      ENTITY_NAMES[e.entity],
      e.logged_by_name || "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fuel-log-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup type="single" value={period} onValueChange={(v) => v && setPeriod(v as Period)}>
          <ToggleGroupItem value="day">Day</ToggleGroupItem>
          <ToggleGroupItem value="week">Week</ToggleGroupItem>
          <ToggleGroupItem value="month">Month</ToggleGroupItem>
        </ToggleGroup>

        <Select value={entityFilter} onValueChange={(v) => setEntityFilter(v as EntityCode | "all")}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            {ENTITIES.map((e) => (
              <SelectItem key={e.code} value={e.code}>{e.code} — {e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={equipFilter} onValueChange={setEquipFilter}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vehicles</SelectItem>
            {equipment.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.code} — {e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <CalendarIcon className="h-3.5 w-3.5" />
          {format(parseISO(from), "MMM d")} – {format(parseISO(to), "MMM d, yyyy")}
        </div>

        <Button variant="outline" size="sm" onClick={exportCsv} disabled={entries.length === 0}>
          <Download className="h-4 w-4 mr-1.5" /> Export CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Fuel className="h-4 w-4 text-orange-500" />}
          label="Total Gallons"
          value={summary ? summary.total.toFixed(2) : "—"}
          sub={`in this ${period}`}
        />
        <StatCard
          icon={<ListChecks className="h-4 w-4 text-blue-500" />}
          label="Entries Logged"
          value={summary ? String(summary.count) : "—"}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-violet-500" />}
          label="Top Entity"
          value={topEntity ? `${ENTITY_NAMES[topEntity.code]}` : "—"}
          sub={topEntity ? `${topEntity.gallons.toFixed(2)} gal` : undefined}
        />
        <StatCard
          icon={<Truck className="h-4 w-4 text-emerald-500" />}
          label="Top Vehicle"
          value={topEquip ? topEquip.code : "—"}
          sub={topEquip ? `${topEquip.gallons.toFixed(2)} gal` : undefined}
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Gallons by {period === "day" ? "hour" : "day"}</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
              No fuel entries in this range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={40} />
                <RechartTooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} content={<GallonsTooltip />} />

                {entityFilter === "all" ? (
                  ENTITIES.map((e) => (
                    <Bar key={e.code} dataKey={e.code} stackId="g" fill={ENTITY_HEX[e.code]} />
                  ))
                ) : (
                  <Bar dataKey="total">
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={ENTITY_HEX[entityFilter as EntityCode]} />
                    ))}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Entries table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[170px]">Date / Time</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead className="text-right w-[100px]">Gallons</TableHead>
              <TableHead className="w-[160px]">Diesel Type</TableHead>
              <TableHead className="w-[150px]">Entity</TableHead>
              <TableHead>Logged By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : entries.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No entries in this range</TableCell></TableRow>
            ) : (
              entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm">
                    {format(parseISO(e.logged_at), "MMM d, h:mm a")}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-orange-500 mr-2">{e.equipment?.code || "—"}</span>
                    <span className="text-sm">{e.equipment?.name || "—"}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono">{Number(e.gallons).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-orange-500/50 text-orange-500">
                      {dieselTypeLabel((e as any).diesel_type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${ENTITY_COLORS[e.entity]} text-white border-0`}>
                      {e.entity} · {ENTITY_NAMES[e.entity]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{e.logged_by_name || (e.logged_by ? "(authenticated)" : "—")}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  onClick?: () => void;
}) => (
  <Card
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={(event) => {
      if (!onClick) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onClick();
      }
    }}
    className={`overflow-hidden border-white/10 bg-slate-950/70 shadow-xl shadow-black/20 backdrop-blur transition ${
      onClick
        ? "cursor-pointer hover:-translate-y-1 hover:border-orange-500/60 hover:bg-slate-900/90 hover:shadow-orange-950/30 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
        : ""
    }`}
  >
    <CardContent className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10">
          {icon}
        </div>
        <div className="h-2 w-2 rounded-full bg-orange-500/70 shadow-[0_0_18px_rgba(249,115,22,0.9)]" />
      </div>
      <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-black tracking-tight text-white">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </CardContent>
  </Card>
);


const TransactionHistoryTab = () => {
  const { data: fuelEntries = [] } = useFuelEntries({});
  const { data: maintenanceEntries = [] } = useMaintenanceEntries({});

  const transactions = useMemo(() => {
    const fuel = fuelEntries.map((entry) => ({
      id: `fuel-${entry.id}`,
      type: "Fuel",
      date: entry.logged_at,
      vehicleCode: entry.equipment?.code || "—",
      vehicleName: entry.equipment?.name || "—",
      entity: entry.entity,
      amount: `${Number(entry.gallons).toFixed(2)} gal`,
      cost: `$${calculateFuelCost([entry as any], getOnRoadDieselRate(), getOffRoadDieselRate()).toFixed(2)}`,
      description: dieselTypeLabel((entry as any).diesel_type),
      operator: entry.logged_by_name || "—",
    }));

    const maintenance = maintenanceEntries.map((entry) => ({
      id: `maintenance-${entry.id}`,
      type: "Maintenance",
      date: entry.logged_at,
      vehicleCode: entry.equipment?.code || "—",
      vehicleName: entry.equipment?.name || "—",
      entity: entry.entity,
      amount: "—",
      cost: `$${Number(entry.cost).toFixed(2)}`,
      description: entry.description,
      operator: entry.logged_by_name || "—",
    }));

    return [...fuel, ...maintenance].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [fuelEntries, maintenanceEntries]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Fleet Activity</CardTitle>
          <CardDescription>
            Combined activity log of fuel fill-ups and maintenance expenses.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date / Time</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Operator</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No activity found.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="text-sm">
                        {format(parseISO(transaction.date), "MMM d, yyyy h:mm a")}
                      </TableCell>

                      <TableCell>
                        <span className="font-mono text-xs text-orange-500 mr-2">
                          {transaction.vehicleCode}
                        </span>
                        <span className="text-sm">{transaction.vehicleName}</span>
                      </TableCell>

                      <TableCell>
                        <Badge className={`${ENTITY_COLORS[transaction.entity]} text-white border-0`}>
                          {ENTITY_NAMES[transaction.entity]}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            transaction.type === "Fuel"
                              ? "border-orange-500 text-orange-500"
                              : "border-blue-500 text-blue-500"
                          }
                        >
                          {transaction.type === "Fuel" ? "⛽ Fuel" : "🔧 Maintenance"}
                        </Badge>
                      </TableCell>

                      <TableCell className="font-mono">
                        {transaction.amount}
                      </TableCell>

                      <TableCell className="text-right font-mono font-bold">
                        {transaction.cost}
                      </TableCell>

                      <TableCell className="max-w-[260px] truncate">
                        {transaction.description}
                      </TableCell>

                      <TableCell>{transaction.operator}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};


/* ──────────────────────────────────────────────────────────────────
 * REPORTS TAB
 * ────────────────────────────────────────────────────────────────── */

const ReportsTab = () => {
  const [onRoadDieselRate, setOnRoadDieselRate] = useState<number>(() => getOnRoadDieselRate());
  const [offRoadDieselRate, setOffRoadDieselRate] = useState<number>(() => getOffRoadDieselRate());

  const { data: equipment = [] } = useEquipment({ activeOnly: true });
  const { data: maintenanceEntries = [] } = useMaintenanceEntries({});
  const { data: fuelSummary } = useFuelSummary({});
  const { data: fuelEntries = [] } = useFuelEntries({});
  const { data: maintenanceSummary } = useMaintenanceSummary({});

  const totalGallons = fuelSummary?.total ?? 0;
  const fuelCost = calculateFuelCost(fuelEntries, onRoadDieselRate, offRoadDieselRate);
  const maintenanceCost = maintenanceSummary?.totalCost ?? 0;
  const totalFleetCost = fuelCost + maintenanceCost;

  const companyReport = ENTITIES.map((entity) => {
    const gallons = fuelSummary?.byEntity?.[entity.code] ?? 0;
    const maintenance = maintenanceSummary?.byEntity?.[entity.code] ?? 0;
    return {
      code: entity.code,
      name: entity.name,
      gallons,
      fuelCost: calculateFuelCost(fuelEntries.filter((entry) => entry.entity === entity.code), onRoadDieselRate, offRoadDieselRate),
      maintenance,
      total: calculateFuelCost(fuelEntries.filter((entry) => entry.entity === entity.code), onRoadDieselRate, offRoadDieselRate) + maintenance,
    };
  }).filter((row) => row.gallons > 0 || row.maintenance > 0);

  const topVehicleReport = (fuelSummary?.byEquipment ?? []).slice(0, 10).map((vehicle) => {
    const maintenanceForVehicle = maintenanceSummary?.byEquipment?.find((m) => m.code === vehicle.code)?.cost ?? 0;
    const estimatedFuelCost = calculateFuelCost(fuelEntries.filter((entry) => entry.equipment?.code === vehicle.code), onRoadDieselRate, offRoadDieselRate);
    return {
      code: vehicle.code,
      name: vehicle.name,
      gallons: Number(vehicle.gallons),
      fuelCost: estimatedFuelCost,
      maintenance: maintenanceForVehicle,
      total: estimatedFuelCost + maintenanceForVehicle,
    };
  });

  const exportFleetReportCsv = () => {
    const rows = [
      ["FuelSync Fleet Report"],
      ["Generated", new Date().toLocaleString()],
      [],
      ["Summary"],
      ["Active Vehicles", equipment.length],
      ["Total Gallons", totalGallons.toFixed(2)],
      ["Fuel Cost", fuelCost.toFixed(2)],
      ["Maintenance Cost", maintenanceCost.toFixed(2)],
      ["Total Fleet Cost", totalFleetCost.toFixed(2)],
      [],
      ["Company", "Gallons", "Fuel Cost", "Maintenance", "Total"],
      ...companyReport.map((row) => [
        row.name,
        row.gallons.toFixed(2),
        row.fuelCost.toFixed(2),
        row.maintenance.toFixed(2),
        row.total.toFixed(2),
      ]),
      [],
      ["Top Vehicles", "Name", "Gallons", "Fuel Cost", "Maintenance", "Total"],
      ...topVehicleReport.map((row) => [
        row.code,
        row.name,
        row.gallons.toFixed(2),
        row.fuelCost.toFixed(2),
        row.maintenance.toFixed(2),
        row.total.toFixed(2),
      ]),
    ];

    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fuelsync-fleet-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold">Reports</h2>
          <p className="text-sm text-muted-foreground">
            Executive summary for fuel usage, maintenance spending, companies, and vehicles.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={exportFleetReportCsv}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Print Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Truck className="h-4 w-4 text-orange-500" />}
          label="Active Vehicles"
          value={String(equipment.length)}
        />
        <StatCard
          icon={<Fuel className="h-4 w-4 text-orange-500" />}
          label="Fuel Gallons"
          value={`${totalGallons.toFixed(2)} gal`}
        />
        <StatCard
          icon={<ListChecks className="h-4 w-4 text-blue-500" />}
          label="Maintenance"
          value={`$${maintenanceCost.toFixed(2)}`}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-green-500" />}
          label="Total Fleet Cost"
          value={`$${totalFleetCost.toFixed(2)}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Settings</CardTitle>
          <CardDescription>
            Adjust the estimated fuel rate used for this report.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>On-Road Diesel Rate</Label>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xl font-bold">$</span>
                <Input type="number" min="0" step="0.01" value={onRoadDieselRate.toFixed(2)} onChange={(e) => setOnRoadDieselRate(Number(e.target.value))} className="h-10 text-lg font-bold" />
                <span className="text-sm text-muted-foreground">/ gal</span>
              </div>
            </div>
            <div>
              <Label>Off-Road Diesel Rate</Label>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xl font-bold">$</span>
                <Input type="number" min="0" step="0.01" value={offRoadDieselRate.toFixed(2)} onChange={(e) => setOffRoadDieselRate(Number(e.target.value))} className="h-10 text-lg font-bold" />
                <span className="text-sm text-muted-foreground">/ gal</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company Summary</CardTitle>
          <CardDescription>Fuel and maintenance spending grouped by company.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead className="text-right">Gallons</TableHead>
                  <TableHead className="text-right">Fuel Cost</TableHead>
                  <TableHead className="text-right">Maintenance</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyReport.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No company activity yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  companyReport.map((row) => (
                    <TableRow key={row.code}>
                      <TableCell>
                        <Badge className={`${ENTITY_COLORS[row.code]} text-white border-0`}>
                          {row.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{row.gallons.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">${row.fuelCost.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">${row.maintenance.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono font-bold">${row.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Vehicles Report</CardTitle>
          <CardDescription>Highest fuel usage vehicles with estimated cost totals.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Gallons</TableHead>
                  <TableHead className="text-right">Fuel Cost</TableHead>
                  <TableHead className="text-right">Maintenance</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topVehicleReport.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No vehicle data yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  topVehicleReport.map((row) => (
                    <TableRow key={row.code}>
                      <TableCell className="font-mono font-bold text-orange-500">{row.code}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-right font-mono">{row.gallons.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">${row.fuelCost.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">${row.maintenance.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono font-bold">${row.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────
 * COST PLACEHOLDER TAB
 * ────────────────────────────────────────────────────────────────── */

const CostTab = () => {
  const [onRoadDieselRate, setOnRoadDieselRate] = useState<number>(() => getOnRoadDieselRate());
  const [offRoadDieselRate, setOffRoadDieselRate] = useState<number>(() => getOffRoadDieselRate());

  const { data: fuelSummary } = useFuelSummary({});
  const { data: fuelEntries = [] } = useFuelEntries({});
  const { data: maintenanceSummary } = useMaintenanceSummary({});

  const totalGallons = fuelSummary?.total ?? 0;
  const fuelCost = calculateFuelCost(fuelEntries, onRoadDieselRate, offRoadDieselRate);
  const maintenanceCost = maintenanceSummary?.totalCost ?? 0;
  const totalFleetCost = fuelCost + maintenanceCost;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Fuel className="h-4 w-4 text-orange-500" />}
          label="Fuel Gallons"
          value={totalGallons.toFixed(2)}
          sub="total gallons logged"
        />

        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-green-500" />}
          label="Fuel Spending"
          value={`$${fuelCost.toFixed(2)}`}
          sub="on-road/off-road rates"
        />

        <StatCard
          icon={<Truck className="h-4 w-4 text-blue-500" />}
          label="Maintenance"
          value={`$${maintenanceCost.toFixed(2)}`}
          sub={`${maintenanceSummary?.count ?? 0} maintenance entries`}
        />

        <StatCard
          icon={<ListChecks className="h-4 w-4 text-violet-500" />}
          label="Total Fleet Cost"
          value={`$${totalFleetCost.toFixed(2)}`}
          sub="fuel + maintenance"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cost Settings</CardTitle>
          <CardDescription>
            Fuel cost is estimated from gallons logged multiplied by the current per-gallon rate.
            Maintenance cost comes directly from maintenance entries.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>On-Road Diesel Rate</Label>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xl font-bold">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={onRoadDieselRate.toFixed(2)}
                  onChange={(e) => setOnRoadDieselRate(Number(e.target.value))}
                  className="h-10 text-lg font-bold"
                />
                <span className="text-sm text-muted-foreground">/ gal</span>
              </div>
            </div>

            <div>
              <Label>Off-Road Diesel Rate</Label>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xl font-bold">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={offRoadDieselRate.toFixed(2)}
                  onChange={(e) => setOffRoadDieselRate(Number(e.target.value))}
                  className="h-10 text-lg font-bold"
                />
                <span className="text-sm text-muted-foreground">/ gal</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fuel vs Maintenance Spending</CardTitle>
          <CardDescription>
            This separates gas spending from repair and service costs.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Fuel Spending</TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    ${fuelCost.toFixed(2)}
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell className="font-medium">Maintenance Spending</TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    ${maintenanceCost.toFixed(2)}
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell className="font-bold">Total Fleet Cost</TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    ${totalFleetCost.toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};


const SettingsTab = () => {
  const [onRoadDieselRate, setOnRoadDieselRate] = useState<number>(() => {
    return Number(localStorage.getItem("onRoadDieselRate")) || getOnRoadDieselRate();
  });
  const [offRoadDieselRate, setOffRoadDieselRate] = useState<number>(() => {
    return Number(localStorage.getItem("offRoadDieselRate")) || getOffRoadDieselRate();
  });
  const [fuelInactivityDays, setFuelInactivityDays] = useState<number>(30);
  const [maintenanceWarningLimit, setMaintenanceWarningLimit] = useState<number>(4000);
  const [defaultPeriod, setDefaultPeriod] = useState<Period>(() => {
    return getDefaultPeriod();
  });
  const [accentColor, setAccentColor] = useState("orange");
  const [companyNames, setCompanyNames] = useState<Record<EntityCode, string>>({
    MP: ENTITY_NAMES.MP,
    YB: ENTITY_NAMES.YB,
    CC: ENTITY_NAMES.CC,
    DP: ENTITY_NAMES.DP,
    OT: ENTITY_NAMES.OT,
  });
  const [saved, setSaved] = useState(false);

  const saveSettings = () => {
    toast.success("Settings saved for this session");
  };

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/15 via-slate-950 to-slate-950 p-6 shadow-xl shadow-black/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-400">FuelSync Control Center</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white">Settings</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Configure rates, company names, alert thresholds, dashboard defaults, and visual preferences.
            </p>
          </div>
<Button
  onClick={() => {
    saveFuelSyncSettings({
      onRoadDieselRate,
      offRoadDieselRate,
      defaultPeriod,
    });

    setSaved(true);

    toast.success("Settings saved!");

    setTimeout(() => {
      setSaved(false);
    }, 2500);
  }}
  className={`h-12 px-8 font-semibold transition-all duration-300 ${
    saved
      ? "bg-green-600 hover:bg-green-600 text-white"
      : "bg-orange-500 hover:bg-orange-600 text-black"
  }`}
>
  {saved ? "✓ Settings Saved" : "Save Settings"}
</Button>
        </div>
      </div>

   <div className="max-w-6xl">
  <Card className="border-white/10 bg-slate-950/70">
    <CardHeader>
      <CardTitle>Financial Settings</CardTitle>
      <CardDescription>
        These values control cost estimates across dashboard cards and reports.
      </CardDescription>
    </CardHeader>

    <CardContent>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

  {/* On-Road Diesel */}
  <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/50 p-4">
    <Label>On-Road Diesel Rate</Label>

    <div className="flex items-center gap-2">
      <span className="text-xl font-bold text-slate-400">$</span>

      <Input
        type="number"
        min="0"
        step="0.01"
        value={onRoadDieselRate.toFixed(2)}
        onChange={(e) => setOnRoadDieselRate(Number(e.target.value))}
        className="h-11 text-lg font-bold"
      />

      <span className="text-sm text-muted-foreground whitespace-nowrap">
        / gal
      </span>
    </div>
  </div>

  {/* Off-Road Diesel */}
  <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/50 p-4">
    <Label>Off-Road Diesel Rate</Label>

    <div className="flex items-center gap-2">
      <span className="text-xl font-bold text-slate-400">$</span>

      <Input
        type="number"
        min="0"
        step="0.01"
        value={offRoadDieselRate.toFixed(2)}
        onChange={(e) => setOffRoadDieselRate(Number(e.target.value))}
        className="h-11 text-lg font-bold"
      />

      <span className="text-sm text-muted-foreground whitespace-nowrap">
        / gal
      </span>
    </div>
  </div>

  {/* Dashboard Period */}
  <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/50 p-4">
    <Label>Default Dashboard Period</Label>

    <Select
      value={defaultPeriod}
      onValueChange={(v) => setDefaultPeriod(v as Period)}
    >
      <SelectTrigger className="h-11">
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="day">Today</SelectItem>
        <SelectItem value="week">This Week</SelectItem>
        <SelectItem value="month">This Month</SelectItem>
      </SelectContent>
    </Select>
  </div>
      </div>
</CardContent>
</Card>
</div>
      <Card className="border-white/10 bg-slate-950/70">
        <CardHeader>
          <CardTitle>Company Names</CardTitle>
          <CardDescription>Customize how each company appears in forms, activity logs, and reports.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ENTITIES.map((entity) => (
              <div key={entity.code} className="space-y-2 rounded-xl border border-white/10 bg-slate-900/50 p-4">
                <Label>{entity.code}</Label>
                <Input
                  value={companyNames[entity.code]}
                  onChange={(e) =>
                    setCompanyNames({
                      ...companyNames,
                      [entity.code]: e.target.value,
                    })
                  }
                  className="font-semibold"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-slate-950/70">
        <CardHeader>
          <CardTitle>Alert Thresholds</CardTitle>
          <CardDescription>Control when FuelSync warns managers about possible fleet issues.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/50 p-4">
            <Label>Fuel Inactivity Warning Days</Label>
            <Input
              type="number"
              min="1"
              value={fuelInactivityDays}
              onChange={(e) => setFuelInactivityDays(Number(e.target.value))}
              className="h-11 text-lg font-bold"
            />
            <p className="text-xs text-muted-foreground">Warn when a vehicle has not been fueled after this many days.</p>
          </div>

          <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/50 p-4">
            <Label>Maintenance Cost Warning Limit</Label>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-slate-400">$</span>
              <Input
                type="number"
                min="0"
                step="100"
                value={maintenanceWarningLimit}
                onChange={(e) => setMaintenanceWarningLimit(Number(e.target.value))}
                className="h-11 text-lg font-bold"
              />
            </div>
            <p className="text-xs text-muted-foreground">Warn when one vehicle exceeds this maintenance total.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-slate-950/70">
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>Prepare FuelSync for company branding and future customization.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/50 p-4">
              <Label>Application Name</Label>
              <Input value="FuelSync" readOnly className="font-bold" />
            </div>

            <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/50 p-4">
              <Label>Primary Dashboard Title</Label>
              <Input value="Fleet Management Dashboard" readOnly className="font-bold" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────
 * Page shell
 * ────────────────────────────────────────────────────────────────── */

const Vehicles = () => {
  const [saved, setSaved] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  const navItems = [
    { value: "dashboard", label: "Dashboard", icon: Truck },
    { value: "list", label: "Vehicles", icon: Truck },
    { value: "activity", label: "Fleet Activity", icon: ListChecks },
    { value: "fuel", label: "Fuel Log", icon: Fuel },
    { value: "cost", label: "Cost Tracking", icon: TrendingUp },
    { value: "reports", label: "Reports", icon: Download },
    { value: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="dark min-h-screen bg-[#050914] text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-[#070b12] lg:flex lg:flex-col">
          <div className="flex h-24 items-center gap-3 border-b border-white/10 px-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/10 shadow-[0_0_30px_rgba(249,115,22,0.25)]">
              <Truck className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">FuelSync</h1>
              <p className="text-xs text-slate-500">Fleet management dashboard</p>
            </div>
          </div>

          <nav className="flex-1 space-y-2 px-4 py-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.value;

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setActiveTab(item.value)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-orange-500/15 text-orange-400 shadow-[0_0_24px_rgba(249,115,22,0.12)]"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-4">
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>
        </aside>

        <main className="flex-1 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.10),transparent_30%),#0a0f1c]">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a0f1c]/90 backdrop-blur-xl">
            <div className="flex min-h-20 flex-col justify-center gap-3 px-4 py-4 md:px-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-orange-500/30 bg-orange-500/10 lg:hidden">
                  <Truck className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <h1 className="text-3xl font-black leading-tight tracking-tight text-white">FuelSync</h1>
                  <p className="text-sm text-muted-foreground">
                    Fleet management dashboard for vehicles, QR codes, fuel, maintenance, costs, and reports.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative w-full lg:w-80">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    placeholder="Search fleet, vehicles, operators..."
                    className="h-11 rounded-xl border-white/10 bg-slate-950/70 pl-9 text-sm"
                  />
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-2 text-left lg:text-right">
                  <p className="text-xs text-slate-500">
                    {format(new Date(), "EEEE, MMMM d, yyyy")}
                  </p>
                  <p className="text-sm font-semibold text-white">Hi Pedro 👋</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto px-4 pb-4 lg:hidden">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setActiveTab(item.value)}
                    className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? "border-orange-500/40 bg-orange-500/10 text-orange-500"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </header>

          <div className="mx-auto max-w-screen-2xl p-4 md:p-6 xl:p-8">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsContent value="dashboard" className="mt-0">
                <DashboardTab onGoToTab={setActiveTab} />
              </TabsContent>
              <TabsContent value="list" className="mt-0">
                <VehiclesListTab onOpenImport={() => setImportOpen(true)} />
              </TabsContent>
              <TabsContent value="activity" className="mt-0">
                <TransactionHistoryTab />
              </TabsContent>
              <TabsContent value="fuel" className="mt-0">
                <FuelLogTab />
              </TabsContent>
              <TabsContent value="cost" className="mt-0">
                <CostTab />
              </TabsContent>
              <TabsContent value="reports" className="mt-0">
                <ReportsTab />
              </TabsContent>
              <TabsContent value="settings" className="mt-0">
                <SettingsTab />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      <ImportVehiclesDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
};

export default Vehicles;