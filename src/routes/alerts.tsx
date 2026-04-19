import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppEvent } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Trash2, Truck } from "lucide-react";

export const Route = createFileRoute("/alerts")({
  component: () => (
    <AppLayout>
      <AlertsPage />
    </AppLayout>
  ),
});

type Filter = "all" | "bin" | "truck";

function AlertsPage() {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const load = () =>
      supabase.from("events").select("*").order("created_at", { ascending: false }).limit(100)
        .then(({ data }) => data && setEvents(data as AppEvent[]));
    load();
    const ch = supabase
      .channel("alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, (p) =>
        setEvents((cur) => [p.new as AppEvent, ...cur].slice(0, 100)),
      )
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, []);

  const filtered = events.filter((e) =>
    filter === "all" ? true : filter === "bin" ? e.type.includes("bin") : e.type.includes("truck") || e.type.includes("dump") || e.type.includes("manual") || e.type.includes("emergency") || e.type.includes("mode"),
  );

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Alerts</h1>
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          {(["all", "bin", "truck"] as Filter[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "ghost"}
              className="h-7 px-2.5 text-xs capitalize"
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Bell className="mx-auto mb-2 h-8 w-8 opacity-40" />
            No alerts yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((ev) => {
            const isBin = ev.type.includes("bin");
            return (
              <Card key={ev.id}>
                <CardContent className="flex items-start gap-3 pt-4">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    ev.type === "bin_full" ? "bg-destructive/15 text-destructive" :
                    ev.type === "emergency_stop" ? "bg-destructive/15 text-destructive" :
                    isBin ? "bg-warning/15 text-warning" :
                    "bg-primary/15 text-primary"
                  }`}>
                    {isBin ? <Trash2 className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{ev.message}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(ev.created_at).toLocaleString()}
                      {ev.bin_id && ` · ${ev.bin_id}`}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
