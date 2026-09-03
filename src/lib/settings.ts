export type Period = "day" | "week" | "month";

const DEFAULT_ON_ROAD_DIESEL_RATE = 4.39;
const DEFAULT_OFF_ROAD_DIESEL_RATE = 3.68;
const DEFAULT_DASHBOARD_PERIOD: Period = "week";

const readNumberSetting = (key: string, fallback: number) => {
  if (typeof window === "undefined") return fallback;

  const stored = window.localStorage.getItem(key);
  const value = Number(stored);

  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const getOnRoadDieselRate = () => {
  return readNumberSetting("onRoadDieselRate", DEFAULT_ON_ROAD_DIESEL_RATE);
};

export const getOffRoadDieselRate = () => {
  return readNumberSetting("offRoadDieselRate", DEFAULT_OFF_ROAD_DIESEL_RATE);
};

export const getDefaultPeriod = (): Period => {
  if (typeof window === "undefined") return DEFAULT_DASHBOARD_PERIOD;

  const stored = window.localStorage.getItem("defaultPeriod") as Period | null;
  return stored || DEFAULT_DASHBOARD_PERIOD;
};

export const saveFuelSyncSettings = ({
  onRoadDieselRate,
  offRoadDieselRate,
  defaultPeriod,
}: {
  onRoadDieselRate: number;
  offRoadDieselRate: number;
  defaultPeriod: Period;
}) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem("onRoadDieselRate", Number(onRoadDieselRate).toFixed(2));
  window.localStorage.setItem("offRoadDieselRate", Number(offRoadDieselRate).toFixed(2));
  window.localStorage.setItem("defaultPeriod", defaultPeriod);

  window.dispatchEvent(new Event("fuelsync-settings-updated"));
};

export const getDieselRate = (dieselType?: string | null) => {
  return dieselType === "on_road" ? getOnRoadDieselRate() : getOffRoadDieselRate();
};

export const calculateHistoricalFuelCost = (
  entries: Array<{
    gallons: number;
    diesel_type?: string | null;
    diesel_rate?: number | null;
    fuel_cost?: number | null;
  }>
) => {
  return entries.reduce((sum, entry) => {
    if (entry.fuel_cost != null) return sum + Number(entry.fuel_cost);

    const rate = entry.diesel_rate != null ? Number(entry.diesel_rate) : getDieselRate(entry.diesel_type);
    return sum + Number(entry.gallons || 0) * rate;
  }, 0);
};
