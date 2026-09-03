# FuelSync

Fleet fuel, mileage, maintenance, QR-code and cost tracking dashboard built with React, TypeScript, Vite, Supabase and Tailwind CSS.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and add your Supabase project URL and anon key.
3. Run `supabase_setup.sql` in the Supabase SQL Editor if upgrading an existing FuelSync database.
4. Start locally:
   ```bash
   npm run dev -- --host 0.0.0.0 --port 5173
   ```
5. Production build:
   ```bash
   npm run build
   ```

## Historical diesel pricing

Each new fuel entry stores `diesel_rate` and `fuel_cost`. This preserves the actual rate used when the fuel was logged, so changing today's On-Road or Off-Road diesel rate does not rewrite historical costs.

Current rates are managed in Settings and stored in browser localStorage for this build. New QR fuel entries use the currently saved rate.
