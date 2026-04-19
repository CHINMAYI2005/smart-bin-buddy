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
  return true;
}

export const Route = createFileRoute("/api/truck/ack")({
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

        const command_id: string = body.command_id;
        const status: string = body.status === "failed" ? "failed" : "done";
        if (!command_id) {
          return new Response(JSON.stringify({ error: "missing command_id" }), { status: 400, headers: { "Content-Type": "application/json", ...cors } });
        }
        await supabaseAdmin.from("commands").update({ status: status as any, acked_at: new Date().toISOString() }).eq("id", command_id);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json", ...cors } });
      },
    },
  },
});
