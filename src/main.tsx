import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import FuelForm from "@/pages/FuelForm";


import Vehicles from "@/pages/Vehicles";
// @ts-ignore: allow CSS side-effect import when no type declarations exist
import "./index.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Vehicles />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/fuel/:vehicleCode" element={<FuelForm />} />
          {/* TODO: Add these routes */}
          {/* <Route path="/vehicles/print-qr" element={<PrintQR />} /> */}
          {/* <Route path="/vehicles/qr-export" element={<QRExport />} /> */}
          {/* <Route path="/fuel" element={<PublicFuelForm />} />  ← the page drivers see after scanning */}
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  </React.StrictMode>
);
