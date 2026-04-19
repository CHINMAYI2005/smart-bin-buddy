import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-device-token",
};

async function authDevice(request: Request): Promise<boolean> {
  const token = request.headers.get("x-device-token");
  if (!token) return false;
  const { data } = await supabaseAdmin.from("device_tokens").select("id").eq("token", token).maybeSingle();
  if (!data) return false;
  await supabaseAdmin.from("device_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return true;
}

export const Route = createFileRoute("/api/truck/telemetry")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        if (!(await authDevice(request))) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", ...cors } });
        }
        let body: any;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
        }

        const lat = body.lat != null ? Number(body.lat) : null;
        const lng = body.lng != null ? Number(body.lng) : null;
        const heading = body.heading != null ? Number(body.heading) : null;
        const fill = Math.max(0, Math.min(100, Number(body.fill ?? 0)));
        const state = (body.state ?? "idle").toLowerCase();
        const ir = !!body.ir_triggered;

        if (!["idle", "moving", "dumping", "returning", "full"].includes(state)) {
          return new Response(JSON.stringify({ error: "bad state" }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
        }

        const { data: prev } = await supabaseAdmin.from("truck_state").select("*").eq("id", 1).single();

        const update: any = {
          lat, lng, heading,
          fill_percent: fill,
          state,
          last_seen: new Date().toISOString(),
        };
        await supabaseAdmin.from("truck_state").update(update).eq("id", 1);

        // Event emission on transitions
        const events: { type: string; message: string; bin_id?: string | null }[] = [];

        if (ir && prev?.state === "moving" && prev?.target_bin_id) {
          events.push({ type: "truck_reached", message: `Truck reached ${prev.target_bin_id}`, bin_id: prev.target_bin_id });
        }
        if (state === "dumping" && prev?.state !== "dumping") {
          events.push({ type: "truck_dumping", message: "Dump in progress" });
        }
        if (prev?.state === "dumping" && state !== "dumping") {
          events.push({ type: "dump_completed", message: "Dump completed", bin_id: prev?.target_bin_id });
          if (prev?.target_bin_id) {
            await supabaseAdmin.from("bins").update({ status: "emptied", fill_percent: 0 }).eq("id", prev.target_bin_id);
          }
        }
        if (fill >= 80 && (prev?.fill_percent ?? 0) < 80) {
          events.push({ type: "truck_full", message: `Truck nearly full (${fill}%) — return to base` });
          await supabaseAdmin.from("commands").insert({ type: "RETURN", priority: 7 });
        }
        if (state === "returning" && prev?.state !== "returning") {
          events.push({ type: "truck_returning", message: "Truck returning to base" });
        }
        if (state === "idle" && prev?.state === "returning") {
          events.push({ type: "truck_at_base", message: "Truck arrived at base" });
        }

        if (events.length) await supabaseAdmin.from("events").insert(events);

        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
      },
    },
  },
});
