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

export const Route = createFileRoute("/api/bin/status")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        if (!(await authDevice(request))) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...cors },
          });
        }

        let body: any;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
        }

        const bin_id: string = body.bin_id;
        const lat: number = Number(body.lat);
        const lng: number = Number(body.lng);
        const status: string = (body.status ?? "ok").toLowerCase();
        const fill: number = Math.max(0, Math.min(100, Number(body.fill ?? 0)));

        if (!bin_id || isNaN(lat) || isNaN(lng)) {
          return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
        }
        if (!["ok", "nearly_full", "full", "emptied"].includes(status)) {
          return new Response(JSON.stringify({ error: "bad status" }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
        }

        // Check previous status to detect FULL transition
        const { data: prev } = await supabaseAdmin.from("bins").select("status, label").eq("id", bin_id).maybeSingle();

        const { error } = await supabaseAdmin.from("bins").upsert({
          id: bin_id,
          label: prev?.label ?? bin_id,
          lat, lng,
          status: status as any,
          fill_percent: fill,
          last_seen: new Date().toISOString(),
        });
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...cors } });

        if (status === "full" && prev?.status !== "full") {
          await supabaseAdmin.from("events").insert({
            type: "bin_full",
            message: `Bin ${bin_id} FULL at ${prev?.label ?? bin_id}`,
            bin_id,
          });
        }

        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
      },
    },
  },
});
