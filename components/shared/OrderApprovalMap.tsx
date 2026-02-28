"use client";

import { useMemo, useState } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import { CheckCircle2, MapPin, X, XCircle } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

const STORE_LAT = 14.5547;
const STORE_LNG = 121.0223;

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
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_API_KEY;
  const hasCoordinates = order.deliveryLat !== null && order.deliveryLng !== null;

  const distanceKm = useMemo(() => {
    if (!hasCoordinates) return null;

    const lat1 = (STORE_LAT * Math.PI) / 180;
    const lat2 = ((order.deliveryLat as number) * Math.PI) / 180;
    const dLat = lat2 - lat1;
    const dLng = (((order.deliveryLng as number) - STORE_LNG) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((6371 * c).toFixed(1));
  }, [hasCoordinates, order.deliveryLat, order.deliveryLng]);

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
          {mapboxToken && hasCoordinates ? (
            <Map
              initialViewState={{
                longitude: (STORE_LNG + (order.deliveryLng as number)) / 2,
                latitude: (STORE_LAT + (order.deliveryLat as number)) / 2,
                zoom: 11,
              }}
              mapboxAccessToken={mapboxToken}
              mapStyle="mapbox://styles/mapbox/streets-v12"
              style={{ width: "100%", height: "100%" }}
            >
              <Marker longitude={STORE_LNG} latitude={STORE_LAT} anchor="bottom">
                <div className="flex flex-col items-center">
                  <div className="mb-1 rounded-md bg-emerald-700 px-2 py-1 text-[10px] font-bold text-white">Store</div>
                  <MapPin className="h-8 w-8 fill-emerald-100 text-emerald-700" />
                </div>
              </Marker>
              <Marker longitude={order.deliveryLng as number} latitude={order.deliveryLat as number} anchor="bottom">
                <div className="flex flex-col items-center">
                  <div className="mb-1 rounded-md bg-red-600 px-2 py-1 text-[10px] font-bold text-white">Customer</div>
                  <MapPin className="h-8 w-8 fill-red-100 text-red-600" />
                </div>
              </Marker>
              <NavigationControl position="top-right" />
            </Map>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              {!hasCoordinates ? "Customer did not pin location." : "Mapbox key not configured."}
            </div>
          )}
        </div>

        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs font-medium text-slate-400">Address</p>
              <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-800">{order.deliveryAddress ?? "Not provided"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Distance</p>
              <p className={`mt-0.5 text-sm font-bold ${distanceKm !== null && distanceKm > 10 ? "text-red-500" : "text-emerald-600"}`}>
                {distanceKm !== null ? `~${distanceKm} km` : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Total</p>
              <p className="mt-0.5 text-sm font-bold text-slate-800">PHP {order.total.toFixed(2)}</p>
            </div>
          </div>
          {distanceKm !== null && distanceKm > 10 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              Customer is more than 10 km away. Check if delivery is feasible.
            </div>
          )}
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
