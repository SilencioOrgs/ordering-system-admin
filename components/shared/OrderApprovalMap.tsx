"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, MapPin, ExternalLink, X, XCircle } from "lucide-react";

interface OrderApprovalMapProps {
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    deliveryAddress: string | null;
    deliveryLat: number | null;
    deliveryLng: number | null;
    total: number;
  };
  onApprove: (orderId: string) => void;
  onReject: (orderId: string, reason: string) => void;
  onClose: () => void;
}

export default function OrderApprovalMap({ order, onApprove, onReject, onClose }: OrderApprovalMapProps) {
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
  const hasCoordinates = order.deliveryLat !== null && order.deliveryLng !== null;

  const mapQuery = useMemo(() => {
    if (hasCoordinates) {
      return `${order.deliveryLat},${order.deliveryLng}`;
    }
    return order.deliveryAddress ?? "";
  }, [hasCoordinates, order.deliveryAddress, order.deliveryLat, order.deliveryLng]);

  const mapboxStaticUrl = useMemo(() => {
    if (!mapboxToken || !hasCoordinates) return null;
    const lng = Number(order.deliveryLng);
    const lat = Number(order.deliveryLat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+047857(${lng},${lat})/${lng},${lat},15/1000x500?access_token=${mapboxToken}`;
  }, [hasCoordinates, mapboxToken, order.deliveryLat, order.deliveryLng]);

  const mapboxOpenUrl = useMemo(() => {
    if (!mapQuery.trim()) return null;
    return `https://www.mapbox.com/search?query=${encodeURIComponent(mapQuery)}`;
  }, [mapQuery]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="font-bold text-slate-900">Review Delivery Location</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Order #{order.orderNumber} - {order.customerName}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative h-64 bg-slate-100">
          {mapboxStaticUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mapboxStaticUrl}
              alt={`Delivery map for order ${order.orderNumber}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              {hasCoordinates ? "Map preview unavailable. Check Mapbox token." : "No pinned map location available for this order."}
            </div>
          )}
        </div>

        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
              Mapbox Address Review
            </div>
            {mapboxOpenUrl && (
              <a
                href={mapboxOpenUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Open
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-left">
            <div>
              <p className="text-xs font-medium text-slate-400">Address</p>
              <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-800">{order.deliveryAddress ?? "Not provided"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Coordinates</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {hasCoordinates ? `${order.deliveryLat}, ${order.deliveryLng}` : "Not pinned"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Customer</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">{order.customerName}</p>
              <p className="text-xs text-slate-500">{order.customerPhone}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Total</p>
              <p className="mt-0.5 text-sm font-bold text-slate-800">PHP {order.total.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-6 py-4">
          {!showRejectInput ? (
            <div className="flex gap-3">
              <button
                onClick={() => onApprove(order.id)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-700 py-3 font-bold text-white transition-colors hover:bg-emerald-800"
              >
                <CheckCircle2 className="h-5 w-5" />
                Approve Order
              </button>
              <button
                onClick={() => setShowRejectInput(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 py-3 font-bold text-red-600 transition-colors hover:bg-red-100"
              >
                <XCircle className="h-5 w-5" />
                Reject
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Reason for rejection"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRejectInput(false)}
                  className="flex-1 rounded-lg bg-slate-100 py-3 font-semibold text-slate-600 transition-colors hover:bg-slate-200"
                >
                  Back
                </button>
                <button
                  onClick={() => onReject(order.id, rejectionReason.trim() || "Order rejected by admin")}
                  disabled={!rejectionReason.trim()}
                  className="flex-1 rounded-lg bg-red-600 py-3 font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
