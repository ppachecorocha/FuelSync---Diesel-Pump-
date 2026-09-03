import { QRCodeSVG } from "qrcode.react";
import type { Equipment } from "@/hooks/useFuel";

export function fuelUrlForCode(code: string): string {
  const base = window.location.origin;
  return `${base}/fuel/${encodeURIComponent(code)}`;
}

interface QRCodeCardProps {
  equipment: Equipment;
  size?: number;
}

const QRCodeCard = ({ equipment, size = 200 }: QRCodeCardProps) => {
  const url = fuelUrlForCode(equipment.code);

  console.log("QR DEBUG:", {
    code: equipment.code,
    url,
  });

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-white p-4 text-black shadow-sm">
      <QRCodeSVG
        value={url}
        size={size}
        level="H"
        includeMargin
      />

      <div className="w-full rounded-md bg-yellow-100 p-2 text-center text-xs text-black">
        QR VALUE:
        <br />
        {url}
      </div>

      <div className="text-center">
        <p className="text-sm font-bold tracking-wide">{equipment.code}</p>
        <p className="max-w-[220px] truncate text-xs text-gray-600">
          {equipment.name}
        </p>
      </div>
    </div>
  );
};

export default QRCodeCard;