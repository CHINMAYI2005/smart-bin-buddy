import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

export const Route = createFileRoute("/api/truck/commands")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        if (!(await authDevice(request))) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", ...cors } });
        }

        const { data: cmds, error } = await supabaseAdmin
          .from("commands")
          .select("*")
          .eq("status", "pending")
          .order("priority", { ascending: false })
          .order("created_at", { ascending: true })
          .limit(20);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...cors } });
        }

        if (cmds && cmds.length > 0) {
          const ids = cmds.map((c) => c.id);
          await supabaseAdmin.from("commands").update({ status: "sent", sent_at: new Date().toISOString() }).in("id", ids);
        }

        return new Response(JSON.stringify({ commands: cmds ?? [] }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...cors },
        });
      },
    },
  },
});
