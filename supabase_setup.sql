-- FuelSync database upgrades required by this version.
-- Safe to run on an existing project: columns are added only if missing.

ALTER TABLE public.fuel_entries
ADD COLUMN IF NOT EXISTS mileage INTEGER;

ALTER TABLE public.fuel_entries
ADD COLUMN IF NOT EXISTS diesel_type TEXT NOT NULL DEFAULT 'off_road';

ALTER TABLE public.fuel_entries
ADD COLUMN IF NOT EXISTS diesel_rate NUMERIC(10,2);

ALTER TABLE public.fuel_entries
ADD COLUMN IF NOT EXISTS fuel_cost NUMERIC(10,2);

ALTER TABLE public.equipment
ADD COLUMN IF NOT EXISTS current_mileage INTEGER DEFAULT 0;
