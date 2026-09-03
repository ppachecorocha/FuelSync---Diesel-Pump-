import type { Equipment } from "@/hooks/useFuel";

export function getAppBaseUrl() {
  return window.location.origin;
}

export function getFuelFormUrl(vehicleCode: string) {
  return `${getAppBaseUrl()}/fuel/${encodeURIComponent(vehicleCode)}`;
}

export function getQRCodeFilename(
  vehicleCode: string,
  extension: "png" | "svg" = "png"
) {
  return `fuelsync-qr-${vehicleCode}.${extension}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadEquipmentQRPng(
  equipment: Equipment,
  size: number = 640
): Promise<void> {
  const QRCode = await import("qrcode");
  const canvas = document.createElement("canvas");

  const url = getFuelFormUrl(equipment.code);

  await QRCode.toCanvas(canvas, url, {
    width: size,
    margin: 2,
    errorCorrectionLevel: "H",
  });

  canvas.toBlob((blob) => {
    if (!blob) throw new Error("Could not generate QR PNG");
    downloadBlob(blob, getQRCodeFilename(equipment.code, "png"));
  }, "image/png");
}

export async function downloadEquipmentQRSvg(
  equipment: Equipment,
  size: number = 400
): Promise<void> {
  const QRCode = await import("qrcode");

  const url = getFuelFormUrl(equipment.code);

  const svg = await QRCode.toString(url, {
    type: "svg",
    width: size,
    margin: 2,
    errorCorrectionLevel: "H",
  });

  const blob = new Blob([svg], { type: "image/svg+xml" });
  downloadBlob(blob, getQRCodeFilename(equipment.code, "svg"));
}

export const downloadEquipmentQrPng = downloadEquipmentQRPng;
export const downloadEquipmentQrSvg = downloadEquipmentQRSvg;