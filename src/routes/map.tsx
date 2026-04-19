import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Bin, TruckState } from "@/lib/api";
import { dispatchTruckToBin } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { MapContainer, TileLayer, CircleMarker, Popup, Marker, useMap } from "react-leaflet";
import L from "leaflet";

export const Route = createFileRoute("/map")({
  component: () => (
    <AppLayout>
      <MapPage />
    </AppLayout>
  ),
});

const truckIcon = L.divIcon({
  className: "",
  html: `<div style="background:oklch(0.72 0.17 230);width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 0 12px oklch(0.72 0.17 230 / 0.6);display:flex;align-items:center;justify-content:center;font-size:12px;">🚛</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

function MapPage() {
  const [bins, setBins] = useState<Bin[]>([]);
  const [truck, setTruck] = useState<TruckState | null>(null);
  const [selected, setSelected] = useState<Bin | null>(null);

  useEffect(() => {
    const load = async () => {
      const [b, t] = await Promise.all([
        supabase.from("bins").select("*"),
        supabase.from("truck_state").select("*").eq("id", 1).single(),
      ]);
      if (b.data) setBins(b.data as Bin[]);
      if (t.data) setTruck(t.data as TruckState);
    };
    load();
    const ch = supabase
      .channel("map")
      .on("postgres_changes", { event: "*", schema: "public", table: "bins" }, () => {
        supabase.from("bins").select("*").then(({ data }) => data && setBins(data as Bin[]));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "truck_state" }, (p) => setTruck(p.new as TruckState))
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, []);

  const center: [number, number] = bins[0] ? [bins[0].lat, bins[0].lng] : [40.7128, -74.006];
  const colorOf = (s: Bin["status"]) =>
    s === "full" ? "oklch(0.62 0.23 25)" : s === "nearly_full" ? "oklch(0.78 0.17 70)" : s === "ok" ? "oklch(0.7 0.18 150)" : "oklch(0.5 0.02 240)";

  return (
    <div className="relative h-[calc(100vh-9rem)] w-full">
      <MapContainer center={center} zoom={15} className="h-full w-full" zoomControl={false}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />
        {bins.map((b) => (
          <CircleMarker
            key={b.id}
            center={[b.lat, b.lng]}
            radius={b.status === "full" ? 14 : 10}
            pathOptions={{ color: colorOf(b.status), fillColor: colorOf(b.status), fillOpacity: 0.85, weight: 2 }}
            eventHandlers={{ click: () => setSelected(b) }}
          >
            <Popup>
              <div className="font-semibold">{b.id}</div>
              <div className="text-xs">{b.label}</div>
              <div className="text-xs">Fill: {b.fill_percent}%</div>
            </Popup>
          </CircleMarker>
        ))}
        {truck?.lat != null && truck?.lng != null && (
          <>
            <Marker position={[truck.lat, truck.lng]} icon={truckIcon}>
              <Popup>Truck — {truck.state}</Popup>
            </Marker>
            <FlyTo lat={truck.lat} lng={truck.lng} />
          </>
        )}
      </MapContainer>

      {selected && (
        <Card className="absolute bottom-4 left-4 right-4 z-[400] shadow-2xl">
          <CardContent className="space-y-2 pt-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-bold">{selected.id}</div>
                <div className="text-xs text-muted-foreground">{selected.label}</div>
              </div>
              <Badge variant={selected.status === "full" ? "destructive" : "secondary"}>
                {selected.status} · {selected.fill_percent}%
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={async () => {
                  await dispatchTruckToBin(selected);
                  toast.success(`Truck dispatched to ${selected.id}`);
                  setSelected(null);
                }}
              >
                Send truck here
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
