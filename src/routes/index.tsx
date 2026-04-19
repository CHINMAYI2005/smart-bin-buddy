import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Bin, TruckState, AppEvent } from "@/lib/api";
import { dispatchTruckToBin } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Truck, Activity, Gauge, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: () => (
    <AppLayout>
      <Dashboard />
    </AppLayout>
  ),
});

function Dashboard() {
  const [truck, setTruck] = useState<TruckState | null>(null);
  const [bins, setBins] = useState<Bin[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [t, b, e] = await Promise.all([
        supabase.from("truck_state").select("*").eq("id", 1).single(),
        supabase.from("bins").select("*").order("status", { ascending: false }),
        supabase.from("events").select("*").order("created_at", { ascending: false }).limit(10),
      ]);
      if (!mounted) return;
      if (t.data) setTruck(t.data as TruckState);
      if (b.data) setBins(b.data as Bin[]);
      if (e.data) setEvents(e.data as AppEvent[]);
    };
    load();

    const ch = supabase
      .channel("dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "truck_state" }, (p) => setTruck(p.new as TruckState))
      .on("postgres_changes", { event: "*", schema: "public", table: "bins" }, () => {
        supabase.from("bins").select("*").order("status", { ascending: false }).then(({ data }) => data && setBins(data as Bin[]));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, (p) => {
        const ev = p.new as AppEvent;
        setEvents((cur) => [ev, ...cur].slice(0, 10));
        if (ev.type === "bin_full") toast.error(ev.message);
        else if (ev.type.startsWith("truck_")) toast.info(ev.message);
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);

  const fullBins = bins.filter((b) => b.status === "full");

  return (
    <div className="space-y-4 p-4">
      <TruckCard truck={truck} />

      {fullBins.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {fullBins.length} bin{fullBins.length > 1 ? "s" : ""} need pickup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {fullBins.map((bin) => (
              <div key={bin.id} className="flex items-center justify-between gap-2 rounded-lg bg-card p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{bin.id}</div>
                  <div className="truncate text-xs text-muted-foreground">{bin.label}</div>
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    await dispatchTruckToBin(bin);
                    toast.success(`Dispatched to ${bin.id}`);
                  }}
                >
                  Dispatch
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" /> Live activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No events yet.</div>
          ) : (
            <ul className="space-y-2">
              {events.map((ev) => (
                <li key={ev.id} className="flex items-start gap-2 border-b border-border pb-2 last:border-0">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{ev.message}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(ev.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TruckCard({ truck }: { truck: TruckState | null }) {
  if (!truck) return <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Loading truck…</CardContent></Card>;
  const stateColor =
    truck.state === "moving" ? "bg-primary" :
    truck.state === "dumping" ? "bg-warning" :
    truck.state === "returning" ? "bg-accent" :
    truck.state === "full" ? "bg-destructive" : "bg-muted";

  return (
    <Card className="overflow-hidden">
      <div className={`h-1 w-full ${stateColor}`} />
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Truck</div>
              <div className="text-lg font-bold capitalize">{truck.state}</div>
            </div>
          </div>
          <Badge variant={truck.mode === "auto" ? "default" : "secondary"} className="uppercase">
            {truck.mode}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-muted/50 p-2.5">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Gauge className="h-3 w-3" /> Fill
            </div>
            <div className="mt-1 text-base font-bold">{truck.fill_percent}%</div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background">
              <div className={`h-full ${truck.fill_percent >= 80 ? "bg-destructive" : truck.fill_percent >= 50 ? "bg-warning" : "bg-success"}`} style={{ width: `${truck.fill_percent}%` }} />
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5">
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3" /> Target
            </div>
            <div className="mt-1 text-base font-bold">{truck.target_bin_id ?? "—"}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              {truck.last_seen ? `Seen ${new Date(truck.last_seen).toLocaleTimeString()}` : "No telemetry yet"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
