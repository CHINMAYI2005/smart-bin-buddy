import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Bin } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/bins")({
  component: () => (
    <AppLayout>
      <BinsPage />
    </AppLayout>
  ),
});

function BinsPage() {
  const [bins, setBins] = useState<Bin[]>([]);
  const [editing, setEditing] = useState<Partial<Bin> | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = () => supabase.from("bins").select("*").order("id").then(({ data }) => data && setBins(data as Bin[]));
    load();
    const ch = supabase
      .channel("bins-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "bins" }, load)
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, []);

  const save = async () => {
    if (!editing?.id || !editing.label || editing.lat == null || editing.lng == null) {
      toast.error("Fill ID, label, lat, lng");
      return;
    }
    const { error } = await supabase.from("bins").upsert({
      id: editing.id,
      label: editing.label,
      lat: Number(editing.lat),
      lng: Number(editing.lng),
      status: (editing.status as Bin["status"]) ?? "ok",
      fill_percent: editing.fill_percent ?? 0,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Bin saved");
      setOpen(false);
      setEditing(null);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("bins").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Bin removed");
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Bins</h1>
          <p className="text-xs text-muted-foreground">{bins.length} registered</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditing({ id: "", label: "", lat: 40.7128, lng: -74.006, status: "ok", fill_percent: 0 })}>
              <Plus className="h-4 w-4" /> Add bin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing?.id && bins.find(b => b.id === editing.id) ? "Edit bin" : "New bin"}</DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>ID</Label>
                  <Input value={editing.id ?? ""} onChange={(e) => setEditing({ ...editing, id: e.target.value })} placeholder="BIN_004" />
                </div>
                <div className="space-y-1.5">
                  <Label>Label</Label>
                  <Input value={editing.label ?? ""} onChange={(e) => setEditing({ ...editing, label: e.target.value })} placeholder="Location D" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>Lat</Label>
                    <Input type="number" step="0.000001" value={editing.lat ?? ""} onChange={(e) => setEditing({ ...editing, lat: parseFloat(e.target.value) })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Lng</Label>
                    <Input type="number" step="0.000001" value={editing.lng ?? ""} onChange={(e) => setEditing({ ...editing, lng: parseFloat(e.target.value) })} />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={save}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {bins.map((bin) => (
        <Card key={bin.id}>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className={`h-10 w-1.5 shrink-0 rounded-full ${
              bin.status === "full" ? "bg-destructive" :
              bin.status === "nearly_full" ? "bg-warning" :
              bin.status === "ok" ? "bg-success" : "bg-muted"
            }`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="text-sm font-bold">{bin.id}</div>
                <Badge variant="outline" className="text-[10px]">{bin.fill_percent}%</Badge>
              </div>
              <div className="truncate text-xs text-muted-foreground">{bin.label}</div>
              <div className="text-[10px] text-muted-foreground">
                {bin.last_seen ? `Updated ${new Date(bin.last_seen).toLocaleString()}` : "Never reported"}
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => { setEditing(bin); setOpen(true); }}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => remove(bin.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
