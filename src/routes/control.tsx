import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Bin, TruckState } from "@/lib/api";
import { sendManualCommand, triggerDump, returnToBase, emergencyStop, setMode, dispatchTruckToBin } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowUp, ArrowDown, Square, AlertOctagon, Trash2, Home } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/control")({
  component: () => (
    <AppLayout>
      <ControlPage />
    </AppLayout>
  ),
});

function ControlPage() {
  const [truck, setTruck] = useState<TruckState | null>(null);
  const [bins, setBins] = useState<Bin[]>([]);
  const [selectedBin, setSelectedBin] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      const [t, b] = await Promise.all([
        supabase.from("truck_state").select("*").eq("id", 1).single(),
        supabase.from("bins").select("*").order("status", { ascending: false }),
      ]);
      if (t.data) setTruck(t.data as TruckState);
      if (b.data) setBins(b.data as Bin[]);
    };
    load();
    const ch = supabase
      .channel("control")
      .on("postgres_changes", { event: "*", schema: "public", table: "truck_state" }, (p) => setTruck(p.new as TruckState))
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, []);

  const isManual = truck?.mode === "manual";

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mode</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <div className="text-sm">{isManual ? "Manual override engaged" : "Autonomous dispatch"}</div>
            <div className="text-xs text-muted-foreground">{isManual ? "You drive the truck" : "AUTO follows queued GOTOs"}</div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="mode" className="text-xs">AUTO</Label>
            <Switch
              id="mode"
              checked={isManual}
              onCheckedChange={async (v) => {
                await setMode(v ? "manual" : "auto");
                toast.success(v ? "Manual mode" : "Auto mode");
              }}
            />
            <Label htmlFor="mode" className="text-xs">MANUAL</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Manual drive</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mx-auto grid w-48 grid-cols-3 gap-2">
            <div />
            <Button
              size="lg"
              className="h-20"
              onClick={async () => { await sendManualCommand("F"); toast.info("→ /F Forward"); }}
            >
              <ArrowUp className="h-8 w-8" />
            </Button>
            <div />
            <div />
            <Button
              size="lg"
              variant="destructive"
              className="h-20"
              onClick={async () => { await sendManualCommand("S"); toast.info("→ /S Stop"); }}
            >
              <Square className="h-7 w-7" />
            </Button>
            <div />
            <div />
            <Button
              size="lg"
              variant="secondary"
              className="h-20"
              onClick={async () => { await sendManualCommand("B"); toast.info("→ /B Backward"); }}
            >
              <ArrowDown className="h-8 w-8" />
            </Button>
            <div />
          </div>
          <p className="mt-3 text-center text-[10px] text-muted-foreground">
            Manual commands have priority over AUTO and override mid-run.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dispatch to bin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <select
            value={selectedBin}
            onChange={(e) => setSelectedBin(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select a bin…</option>
            {bins.map((b) => (
              <option key={b.id} value={b.id}>{b.id} — {b.label} ({b.status}, {b.fill_percent}%)</option>
            ))}
          </select>
          <Button
            className="w-full"
            disabled={!selectedBin}
            onClick={async () => {
              const bin = bins.find((b) => b.id === selectedBin);
              if (!bin) return;
              await dispatchTruckToBin(bin);
              toast.success(`Dispatched to ${bin.id}`);
            }}
          >
            Dispatch
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={async () => { await triggerDump(); toast.info("Dump triggered"); }}>
          <Trash2 className="h-4 w-4" /> Dump
        </Button>
        <Button variant="secondary" onClick={async () => { await returnToBase(); toast.info("Returning to base"); }}>
          <Home className="h-4 w-4" /> Return
        </Button>
      </div>

      <Button
        variant="destructive"
        className="w-full"
        size="lg"
        onClick={async () => { await emergencyStop(); toast.error("EMERGENCY STOP"); }}
      >
        <AlertOctagon className="h-5 w-5" /> Emergency stop
      </Button>

      {truck && (
        <div className="text-center text-xs text-muted-foreground">
          State: <Badge variant="outline" className="capitalize">{truck.state}</Badge> · Fill {truck.fill_percent}%
        </div>
      )}
    </div>
  );
}
