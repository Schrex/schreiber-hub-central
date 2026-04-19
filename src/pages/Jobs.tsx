import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, MapPin, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { geocodeAddress } from "@/lib/weather";

interface Job {
  id: string;
  job_number: string | null;
  name: string;
  address: string | null;
  status: "active" | "on_hold" | "complete";
  latitude: number | null;
  longitude: number | null;
}

const Jobs = () => {
  const { role } = useAuth();
  const canEdit = role === "office" || role === "admin";
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ job_number: "", name: "", address: "" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("jobs")
      .select("id, job_number, name, address, status, latitude, longitude")
      .order("created_at", { ascending: false });
    setJobs((data as Job[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      let lat: number | null = null;
      let lon: number | null = null;
      if (form.address.trim()) {
        const c = await geocodeAddress(form.address.trim());
        if (c) { lat = c.lat; lon = c.lon; }
      }
      const { error } = await supabase.from("jobs").insert({
        job_number: form.job_number || null,
        name: form.name,
        address: form.address || null,
        latitude: lat,
        longitude: lon,
      });
      if (error) throw error;
      toast.success(lat ? "Job added with location" : "Job added (couldn't geocode address)");
      setForm({ job_number: "", name: "", address: "" });
      setOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl uppercase tracking-wide">Jobs</h1>
            <p className="text-sm text-muted-foreground">Active projects and locations</p>
          </div>
          {canEdit && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-4 w-4" /> New</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Job</DialogTitle></DialogHeader>
                <form onSubmit={submit} className="space-y-3">
                  <div>
                    <Label htmlFor="job_number">Job #</Label>
                    <Input id="job_number" value={form.job_number} onChange={(e) => setForm({ ...form, job_number: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" placeholder="123 Main St, Ontario, NY" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                    <p className="mt-1 text-[10px] text-muted-foreground">We'll geocode it for the map + weather.</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save Job"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="mt-6 space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && jobs.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <Briefcase className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No jobs yet.</p>
              {canEdit && <p className="mt-1 text-xs text-muted-foreground">Tap "New" to add one.</p>}
            </div>
          )}
          {jobs.map((j) => (
            <Link
              key={j.id}
              to={`/jobs/${j.id}`}
              className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {j.job_number && <span className="text-[10px] font-mono text-muted-foreground">#{j.job_number}</span>}
                    <span className={`text-[9px] uppercase font-bold tracking-wider rounded px-1.5 py-0.5 ${
                      j.status === "active" ? "bg-primary/15 text-primary" :
                      j.status === "on_hold" ? "bg-accent/15 text-accent-foreground" :
                      "bg-muted text-muted-foreground"
                    }`}>{j.status.replace("_", " ")}</span>
                  </div>
                  <p className="mt-1 font-display text-base uppercase tracking-wide truncate">{j.name}</p>
                  {j.address && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground truncate">
                      <MapPin className="h-3 w-3 shrink-0" /> {j.address}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Jobs;
