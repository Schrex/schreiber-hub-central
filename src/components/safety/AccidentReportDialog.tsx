import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, X, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SignaturePad } from "@/components/safety/SignaturePad";
import { toast } from "sonner";

interface Job { id: string; name: string; job_number: string | null; }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  presetJob?: { id: string; name: string; job_number: string | null } | null;
}

type IncidentType = "injury" | "near_miss" | "property_damage" | "vehicle" | "other";
type Severity = "none" | "first_aid" | "medical_treatment" | "lost_time" | "fatality";

const incidentTypes: { value: IncidentType; label: string }[] = [
  { value: "injury", label: "Injury" },
  { value: "near_miss", label: "Near miss" },
  { value: "property_damage", label: "Property damage" },
  { value: "vehicle", label: "Vehicle incident" },
  { value: "other", label: "Other" },
];

const severities: { value: Severity; label: string }[] = [
  { value: "none", label: "No injury" },
  { value: "first_aid", label: "First aid only" },
  { value: "medical_treatment", label: "Medical treatment needed" },
  { value: "lost_time", label: "Lost time" },
  { value: "fatality", label: "Fatality" },
];

const nowLocalISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export const AccidentReportDialog = ({ open, onOpenChange, presetJob }: Props) => {
  const { user, displayName } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [jobId, setJobId] = useState<string>(presetJob?.id ?? "");
  const [incidentAt, setIncidentAt] = useState(nowLocalISO());
  const [location, setLocation] = useState("");
  const [incidentType, setIncidentType] = useState<IncidentType>("injury");
  const [severity, setSeverity] = useState<Severity>("none");
  const [description, setDescription] = useState("");
  const [injuredName, setInjuredName] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [witnesses, setWitnesses] = useState("");
  const [immediateAction, setImmediateAction] = useState("");
  const [contributing, setContributing] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [signature, setSignature] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!presetJob) {
      supabase.from("jobs").select("id, name, job_number").eq("status", "active").order("name")
        .then(({ data }) => setJobs((data as Job[]) ?? []));
    }
    setJobId(presetJob?.id ?? "");
  }, [open, presetJob]);

  const reset = () => {
    setJobId(presetJob?.id ?? "");
    setIncidentAt(nowLocalISO());
    setLocation(""); setIncidentType("injury"); setSeverity("none");
    setDescription(""); setInjuredName(""); setBodyPart("");
    setWitnesses(""); setImmediateAction(""); setContributing("");
    setPhotos([]); setSignature(null);
  };

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setPhotos((cur) => [...cur, ...files].slice(0, 8));
    e.target.value = "";
  };

  const submit = async () => {
    if (!user) { toast.error("Not signed in"); return; }
    if (!description.trim()) { toast.error("Description is required"); return; }
    if (!incidentAt) { toast.error("Date/time is required"); return; }

    setSubmitting(true);
    try {
      const selectedJob = presetJob ?? jobs.find(j => j.id === jobId);

      // Upload photos first
      const photoPaths: string[] = [];
      for (const file of photos) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("accident-photos").upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        photoPaths.push(path);
      }

      const profileEmail = user.email ?? null;
      const { data: report, error } = await supabase.from("accident_reports").insert({
        job_id: selectedJob?.id ?? null,
        job_name_snapshot: selectedJob?.name ?? null,
        job_number_snapshot: selectedJob?.job_number ?? null,
        reported_by: user.id,
        reported_by_name: displayName ?? user.email ?? "Unknown",
        reported_by_email: profileEmail,
        incident_at: new Date(incidentAt).toISOString(),
        location: location.trim() || null,
        incident_type: incidentType,
        severity,
        description: description.trim(),
        injured_person_name: injuredName.trim() || null,
        body_part: bodyPart.trim() || null,
        witnesses: witnesses.trim() || null,
        immediate_action: immediateAction.trim() || null,
        contributing_factors: contributing.trim() || null,
        photo_paths: photoPaths,
        signature_data: signature,
      }).select("id").single();

      if (error) throw error;

      // Fire-and-forget email; don't block UX on it
      supabase.functions.invoke("submit-accident-report", { body: { reportId: report.id } })
        .catch((e) => console.error("email dispatch failed", e));

      toast.success("Accident report submitted. Office has been notified.");
      reset();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) { if (!o) reset(); onOpenChange(o); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Report an accident
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!presetJob && (
            <div>
              <Label className="text-xs">Job</Label>
              <Select value={jobId} onValueChange={setJobId}>
                <SelectTrigger><SelectValue placeholder="Select job (optional)" /></SelectTrigger>
                <SelectContent>
                  {jobs.map(j => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.job_number ? `#${j.job_number} · ` : ""}{j.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {presetJob && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">Job: </span>
              {presetJob.job_number ? `#${presetJob.job_number} · ` : ""}{presetJob.name}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">When *</Label>
              <Input type="datetime-local" value={incidentAt} onChange={(e) => setIncidentAt(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Location on site</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. North trench" maxLength={200} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Incident type *</Label>
              <Select value={incidentType} onValueChange={setIncidentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{incidentTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Severity *</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{severities.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">What happened? *</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="Describe the incident in detail" />
          </div>

          {(incidentType === "injury" || severity !== "none") && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Injured person</Label>
                  <Input value={injuredName} onChange={(e) => setInjuredName(e.target.value)} maxLength={100} />
                </div>
                <div>
                  <Label className="text-xs">Body part affected</Label>
                  <Input value={bodyPart} onChange={(e) => setBodyPart(e.target.value)} maxLength={100} placeholder="e.g. Left hand" />
                </div>
              </div>
            </>
          )}

          <div>
            <Label className="text-xs">Witnesses</Label>
            <Input value={witnesses} onChange={(e) => setWitnesses(e.target.value)} maxLength={300} placeholder="Names of anyone who saw it" />
          </div>

          <div>
            <Label className="text-xs">Immediate action taken</Label>
            <Textarea rows={2} value={immediateAction} onChange={(e) => setImmediateAction(e.target.value)} maxLength={1000} />
          </div>

          <div>
            <Label className="text-xs">Contributing factors</Label>
            <Textarea rows={2} value={contributing} onChange={(e) => setContributing(e.target.value)} maxLength={1000} placeholder="Weather, equipment, fatigue, etc." />
          </div>

          <div>
            <Label className="text-xs">Photos ({photos.length}/8)</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative h-16 w-16 rounded overflow-hidden border border-border">
                  <img src={URL.createObjectURL(p)} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                    className="absolute right-0 top-0 rounded-bl bg-destructive/90 p-0.5 text-destructive-foreground"
                  ><X className="h-3 w-3" /></button>
                </div>
              ))}
              {photos.length < 8 && (
                <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded border-2 border-dashed border-border text-muted-foreground hover:bg-muted">
                  <Camera className="h-5 w-5" />
                  <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handlePhotos} />
                </label>
              )}
            </div>
          </div>

          <div>
            <Label className="text-xs">Your signature</Label>
            <SignaturePad value={signature ?? undefined} onChange={setSignature} />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button variant="destructive" className="flex-1" onClick={submit} disabled={submitting}>
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</> : "Submit report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const AccidentReportButton = ({ presetJob, variant = "destructive", className = "" }: { presetJob?: { id: string; name: string; job_number: string | null } | null; variant?: "destructive" | "outline"; className?: string; }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} className={`w-full ${className}`} onClick={() => setOpen(true)}>
        <AlertTriangle className="mr-2 h-4 w-4" /> Report an accident
      </Button>
      <AccidentReportDialog open={open} onOpenChange={setOpen} presetJob={presetJob ?? null} />
    </>
  );
};
