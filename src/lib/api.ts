import { supabase } from "@/integrations/supabase/client";

export type Bin = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  status: "ok" | "nearly_full" | "full" | "emptied";
  fill_percent: number;
  last_seen: string | null;
  updated_at: string;
};

export type TruckState = {
  id: number;
  mode: "auto" | "manual";
  state: "idle" | "moving" | "dumping" | "returning" | "full";
  lat: number | null;
  lng: number | null;
  heading: number | null;
  fill_percent: number;
  target_bin_id: string | null;
  last_seen: string | null;
  updated_at: string;
};

export type AppEvent = {
  id: string;
  type: string;
  message: string;
  bin_id: string | null;
  metadata: any;
  created_at: string;
};

export const binStatusColor = (status: Bin["status"]) =>
  status === "full" ? "destructive" : status === "nearly_full" ? "warning" : status === "ok" ? "success" : "muted";

export async function logEvent(type: string, message: string, bin_id?: string | null) {
  await supabase.from("events").insert({ type, message, bin_id: bin_id ?? null });
}

export async function queueCommand(
  type: "F" | "B" | "S" | "DUMP" | "GOTO" | "RETURN",
  payload?: Record<string, any>,
  priority = 0,
) {
  const { data: u } = await supabase.auth.getUser();
  return supabase.from("commands").insert({
    type,
    payload: payload ?? null,
    priority,
    issued_by: u.user?.id ?? null,
  });
}

export async function dispatchTruckToBin(bin: Bin) {
  await supabase.from("truck_state").update({ target_bin_id: bin.id, state: "moving" }).eq("id", 1);
  await queueCommand("GOTO", { bin_id: bin.id, lat: bin.lat, lng: bin.lng }, 5);
  await logEvent("truck_moving", `Truck moving to ${bin.label}`, bin.id);
}

export async function sendManualCommand(t: "F" | "B" | "S") {
  await queueCommand(t, null, 10); // manual override = high priority
  await logEvent("manual_override", `Manual command: ${t}`);
}

export async function triggerDump() {
  await supabase.from("truck_state").update({ state: "dumping" }).eq("id", 1);
  await queueCommand("DUMP", null, 8);
  await logEvent("dump_triggered", "Dump triggered manually");
}

export async function returnToBase() {
  await supabase.from("truck_state").update({ state: "returning", target_bin_id: null }).eq("id", 1);
  await queueCommand("RETURN", null, 5);
  await logEvent("truck_returning", "Truck returning to base");
}

export async function emergencyStop() {
  await queueCommand("S", { emergency: true }, 100);
  await supabase.from("truck_state").update({ state: "idle" }).eq("id", 1);
  await logEvent("emergency_stop", "EMERGENCY STOP issued");
}

export async function setMode(mode: "auto" | "manual") {
  await supabase.from("truck_state").update({ mode }).eq("id", 1);
  await logEvent("mode_change", `Mode set to ${mode.toUpperCase()}`);
}
