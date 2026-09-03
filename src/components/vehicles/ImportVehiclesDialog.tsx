/**
 * ImportVehiclesDialog
 *
 * A dialog that lets the admin upload a spreadsheet (CSV or XLSX)
 * to bulk-create vehicles in the system.
 *
 * TODO: Build this out.
 * - Accept a CSV/XLSX file upload
 * - Parse rows into EquipmentInput objects
 * - Show a preview table so the user can confirm before importing
 * - Call the create equipment API for each valid row
 * - Show success/error counts
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ImportVehiclesDialogProps {
  open: boolean;
  onClose: () => void;
}

const ImportVehiclesDialog = ({ open, onClose }: ImportVehiclesDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Vehicles from Spreadsheet</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file with columns: Code, Name, Category, Make, Model, Year, License Plate.
          </DialogDescription>
        </DialogHeader>
        <div className="py-8 text-center text-muted-foreground text-sm">
          <p>TODO: File upload + preview table goes here.</p>
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImportVehiclesDialog;
