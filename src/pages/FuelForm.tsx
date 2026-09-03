import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  useEquipmentByCode,
  useLogFuel,
  useLogMaintenance,
} from "@/hooks/useFuel";
import { getDieselRate } from "@/lib/settings";

type TransactionType = "fuel" | "maintenance";
type DieselType = "off_road" | "on_road";

const companyOptions = [
  { value: "MP", label: "Mr. Pave" },
  { value: "YB", label: "Yellow Bins" },
  { value: "CC", label: "Concrete Company" },
  { value: "DP", label: "Dantas Properties" },
  { value: "OT", label: "Other" },
];

export default function FuelForm() {
  const { vehicleCode } = useParams();
  const { data: equipment, isLoading, error } = useEquipmentByCode(vehicleCode);

  const logFuel = useLogFuel();
  const logMaintenance = useLogMaintenance();

  const [transactionType, setTransactionType] =
    useState<TransactionType>("fuel");

  const [gallons, setGallons] = useState("");
  const [mileage, setMileage] = useState("");
  const [dieselType, setDieselType] = useState<DieselType>("off_road");

  const [maintenanceCost, setMaintenanceCost] = useState("");
  const [maintenanceDescription, setMaintenanceDescription] = useState("");

  const [operatorName, setOperatorName] = useState("");
  const [entity, setEntity] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!equipment) return;

    if (!entity) {
      alert("Please select a company.");
      return;
    }

    if (!operatorName.trim()) {
      alert("Please enter your name.");
      return;
    }

    if (transactionType === "fuel") {
      const gallonsNumber = parseFloat(gallons);
      const mileageNumber = mileage ? Number(mileage) : null;

      if (Number.isNaN(gallonsNumber) || gallonsNumber <= 0) {
        alert("Please enter a valid gallon amount.");
        return;
      }

      if (mileageNumber !== null && (Number.isNaN(mileageNumber) || mileageNumber < 0)) {
        alert("Please enter a valid mileage.");
        return;
      }

      const dieselRate = getDieselRate(dieselType);
      const fuelCost = Number((gallonsNumber * dieselRate).toFixed(2));

      await logFuel.mutateAsync({
        equipment_id: equipment.id,
        entity: entity as any,
        gallons: gallonsNumber,
        mileage: mileageNumber,
        diesel_type: dieselType,
        diesel_rate: dieselRate,
        fuel_cost: fuelCost,
        logged_by_name: operatorName.trim(),
      } as any);
    }

    if (transactionType === "maintenance") {
      const costNumber = parseFloat(maintenanceCost);

      if (Number.isNaN(costNumber) || costNumber < 0) {
        alert("Please enter a valid maintenance cost.");
        return;
      }

      if (!maintenanceDescription.trim()) {
        alert("Please enter a short maintenance description.");
        return;
      }

      await logMaintenance.mutateAsync({
        equipment_id: equipment.id,
        entity: entity as any,
        cost: costNumber,
        description: maintenanceDescription.trim(),
        logged_by_name: operatorName.trim(),
      });
    }

    setSubmitted(true);
  }

  const isSubmitting = logFuel.isPending || logMaintenance.isPending;

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-white">
        Loading vehicle...
      </main>
    );
  }

  if (error || !equipment) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-white">
        Invalid or inactive vehicle QR code.
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-white">
        <div className="w-full max-w-md rounded-2xl border border-green-700 bg-zinc-900 p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-3xl">
            ✓
          </div>

          <h1 className="text-3xl font-bold text-green-400">
            {transactionType === "fuel" ? "Fuel Logged" : "Maintenance Logged"}
          </h1>

          <p className="mt-4 text-zinc-300">
            {equipment.code} — {equipment.name}
          </p>

          {transactionType === "fuel" ? (
            <div className="mt-3">
              <p className="text-3xl font-bold">{gallons} gallons</p>
              <p className="mt-1 text-sm text-zinc-400">
                {dieselType === "on_road" ? "On-Road Diesel" : "Off-Road Diesel"}
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                Rate: ${getDieselRate(dieselType).toFixed(2)} / gal
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                Fuel Cost: ${(Number(gallons || 0) * getDieselRate(dieselType)).toFixed(2)}
              </p>

              {mileage && (
                <p className="mt-2 text-sm text-zinc-400">
                  Mileage: {Number(mileage).toLocaleString()} mi
                </p>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-3xl font-bold">${maintenanceCost}</p>
              <p className="mt-2 text-sm text-zinc-400">
                {maintenanceDescription}
              </p>
            </div>
          )}

          <p className="mt-2 text-sm text-zinc-400">
            Operator: {operatorName}
          </p>

          <button
            onClick={() => {
              setGallons("");
              setMileage("");
              setDieselType("off_road");
              setMaintenanceCost("");
              setMaintenanceDescription("");
              setOperatorName("");
              setEntity("");
              setTransactionType("fuel");
              setSubmitted(false);
            }}
            className="mt-6 w-full rounded-xl bg-orange-600 p-4 font-bold text-white"
          >
            Log Another Entry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-orange-500">
            Mr. Pave FuelSync
          </p>
          <h1 className="mt-2 text-3xl font-bold">Log Entry</h1>
          <p className="text-sm text-zinc-400">
            Select transaction type, company, operator, and details.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Vehicle
          </p>
          <h2 className="mt-1 text-3xl font-bold">{equipment.code}</h2>
          <p className="text-zinc-300">{equipment.name}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {[equipment.make, equipment.model, equipment.year]
              .filter(Boolean)
              .join(" ")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-zinc-300">
              Transaction Type
            </p>

            <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-950 p-1">
              <button
                type="button"
                onClick={() => setTransactionType("fuel")}
                className={`rounded-lg p-3 text-sm font-bold transition ${
                  transactionType === "fuel"
                    ? "bg-orange-600 text-white"
                    : "text-zinc-400 hover:bg-zinc-800"
                }`}
              >
                Gas Fill-Up
              </button>

              <button
                type="button"
                onClick={() => setTransactionType("maintenance")}
                className={`rounded-lg p-3 text-sm font-bold transition ${
                  transactionType === "maintenance"
                    ? "bg-orange-600 text-white"
                    : "text-zinc-400 hover:bg-zinc-800"
                }`}
              >
                Maintenance
              </button>
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-zinc-300">Company</span>
            <select
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-lg font-semibold outline-none ring-orange-600 focus:ring-2"
              required
            >
              <option value="">Select Company</option>
              {companyOptions.map((company) => (
                <option key={company.value} value={company.value}>
                  {company.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-300">
              Operator Name
            </span>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-xl font-bold outline-none ring-orange-600 placeholder:text-zinc-700 focus:ring-2"
              placeholder="Your name"
              required
            />
          </label>

          {transactionType === "fuel" ? (
            <>
              <label className="block">
                <span className="text-sm font-medium text-zinc-300">
                  Diesel Type
                </span>
                <select
                  value={dieselType}
                  onChange={(e) => setDieselType(e.target.value as DieselType)}
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-lg font-semibold outline-none ring-orange-600 focus:ring-2"
                  required
                >
                  <option value="off_road">Off-Road Diesel</option>
                  <option value="on_road">On-Road Diesel</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-zinc-300">
                  Gallons Fueled
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  step="0.001"
                  value={gallons}
                  onChange={(e) => setGallons(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-5 text-3xl font-bold outline-none ring-orange-600 focus:ring-2"
                  placeholder="30.5"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-zinc-300">
                  Current Mileage
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-5 text-3xl font-bold outline-none ring-orange-600 focus:ring-2"
                  placeholder="120,000"
                />
              </label>
            </>
          ) : (
            <>
              <label className="block">
                <span className="text-sm font-medium text-zinc-300">
                  Final Cost
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={maintenanceCost}
                  onChange={(e) => setMaintenanceCost(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-5 text-3xl font-bold outline-none ring-orange-600 focus:ring-2"
                  placeholder="250.00"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-zinc-300">
                  Maintenance Description
                </span>
                <textarea
                  value={maintenanceDescription}
                  onChange={(e) => setMaintenanceDescription(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-base font-medium outline-none ring-orange-600 placeholder:text-zinc-700 focus:ring-2"
                  placeholder="Oil change, tire replacement, brake repair..."
                  rows={3}
                  required
                />
              </label>
            </>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-orange-600 p-5 text-lg font-bold text-white shadow-lg disabled:opacity-50"
          >
            {isSubmitting
              ? "Submitting..."
              : transactionType === "fuel"
              ? "Submit Fuel Entry"
              : "Submit Maintenance Entry"}
          </button>
        </form>
      </div>
    </main>
  );
}