import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: () => (
    <AppLayout>
      <SettingsPage />
    </AppLayout>
  ),
});

type DeviceToken = { id: string; name: string; token: string; created_at: string };

function SettingsPage() {
  const [tokens, setTokens] = useState<DeviceToken[]>([]);
  const [newName, setNewName] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    supabase.from("device_tokens").select("*").order("created_at", { ascending: false }).then(({ data }) => data && setTokens(data as DeviceToken[]));
  }, []);

  const createToken = async () => {
    if (!newName.trim()) { toast.error("Name required"); return; }
    const arr = new Uint8Array(24);
    crypto.getRandomValues(arr);
    const token = Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
    const { data, error } = await supabase.from("device_tokens").insert({ name: newName.trim(), token }).select().single();
    if (error) toast.error(error.message);
    else if (data) {
      setTokens([data as DeviceToken, ...tokens]);
      setNewName("");
      toast.success("Token created");
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("device_tokens").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { setTokens(tokens.filter((t) => t.id !== id)); toast.success("Token deleted"); }
  };

  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copied"); };

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ESP32 device tokens</CardTitle>
          <CardDescription>Used in the <code className="text-xs">x-device-token</code> header.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Token name (e.g., truck-01)" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Button onClick={createToken}><RefreshCw className="h-4 w-4" /> Generate</Button>
          </div>
          {tokens.map((t) => (
            <div key={t.id} className="space-y-1 rounded-lg border border-border p-2.5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{t.name}</div>
                <Button size="sm" variant="ghost" onClick={() => remove(t.id)}>Delete</Button>
              </div>
              <div className="flex items-center gap-1">
                <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-[10px]">{t.token}</code>
                <Button size="icon" variant="ghost" onClick={() => copy(t.token)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ESP32 endpoints</CardTitle>
          <CardDescription>Base: <code className="text-xs">{origin}</code></CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <Endpoint method="POST" path="/api/bin/status" body='{"bin_id":"BIN_001","lat":40.71,"lng":-74,"status":"full","fill":100}' />
          <Endpoint method="POST" path="/api/truck/telemetry" body='{"lat":40.71,"lng":-74,"state":"moving","fill":40,"ir_triggered":false}' />
          <Endpoint method="GET" path="/api/truck/commands" body="" />
          <Endpoint method="POST" path="/api/truck/ack" body='{"command_id":"<uuid>","status":"done"}' />
          <p className="pt-2 text-[10px] text-muted-foreground">
            All endpoints require header <code>x-device-token: &lt;token&gt;</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Endpoint({ method, path, body }: { method: string; path: string; body: string }) {
  return (
    <div className="rounded-lg border border-border p-2">
      <div className="flex items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${method === "GET" ? "bg-success/20 text-success" : "bg-primary/20 text-primary"}`}>
          {method}
        </span>
        <code className="text-xs">{path}</code>
      </div>
      {body && <pre className="mt-1 overflow-x-auto rounded bg-muted p-1.5 text-[10px]">{body}</pre>}
    </div>
  );
}
