import { errorMessage } from "@/lib/errorMessage";
import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, Loader2, X, Camera, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { SignaturePad } from "@/components/safety/SignaturePad";
import { toast } from "sonner";

interface JobOpt { id: string; name: string; job_number: string | null; }
interface EmpOpt { id: string; name: string; department: string | null; }

type Discipline = "verbal" | "written" | "suspension" | "termination";

interface ViolationRow {
  rule: string;
  description: string;
  corrective_codes: number[];
  corrective_other: string;
}

const CODES: { code: number; label: string }[] = [
  { code: 1, label: "1 — Cease operation until corrected" },
  { code: 2, label: "2 — Warn & instruct on procedures" },
  { code: 3, label: "3 — Provide proper equipment" },
  { code: 4, label: "4 — Change procedure/work method" },
  { code: 5, label: "5 — Initiate & complete corrective action" },
  { code: 6, label: "6 — Other (specify)" },
];

const DISCIPLINES: { value: Discipline; label: string }[] = [
  { value: "verbal", label: "Verbal reprimand" },
  { value: "written", label: "Written reprimand (last chance)" },
  { value: "suspension", label: "Suspension" },
  { value: "termination", label: "Termination" },
];

const todayIso = () => new Date().toISOString().slice(0, 10);
const newRow = (): ViolationRow => ({ rule: "", description: "", corrective_codes: [], corrective_other: "" });

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  presetJob?: { id: string; name: string; job_number: string | null } | null;
}

export const SafetyViolationDialog = ({ open, onOpenChange, presetJob }: Props) => {
  const { user, displayName } = useAuth();
  const [jobs, setJobs] = useState<JobOpt[]>([]);
  const [employees, setEmployees] = useState<EmpOpt[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [jobId, setJobId] = useState<string>(presetJob?.id ?? "");
  const [empContactId, setEmpContactId] = useState<string>("");
  const [department, setDepartment] = useState("");
  const [violationDate, setViolationDate] = useState(todayIso());
  const [violations, setViolations] = useState<ViolationRow[]>([newRow()]);
  const [comments, setComments] = useState("");
  const [discipline, setDiscipline] = useState<Discipline>("verbal");
  const [suspFrom, setSuspFrom] = useState("");
  const [suspTo, setSuspTo] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [supervisorSig, setSupervisorSig] = useState<string | null>(null);
  const [employeeSig, setEmployeeSig] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!presetJob) {
      supabase.from("jobs").select("id, name, job_number").eq("status", "active").order("name")
        .then(({ data }) => setJobs((data as JobOpt[]) ?? []));
    }
    supabase.rpc("list_employee_directory")
      .then(({ data }) => {
        const rows = ((data as { id: string; name: string; department: string | null; is_active: boolean }[] | null) ?? [])
          .filter((r) => r.is_active)
          .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
        setEmployees(rows.map((r) => ({ id: r.id, name: r.name, department: r.department })) as EmpOpt[]);
      });
    setJobId(presetJob?.id ?? "");
  }, [open, presetJob]);

  const selectedEmp = useMemo(() => employees.find(e => e.id === empContactId), [employees, empContactId]);
  useEffect(() => {
    if (selectedEmp?.department && !department) setDepartment(selectedEmp.department);
  }, [selectedEmp]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    setJobId(presetJob?.id ?? "");
    setEmpContactId("");
    setDepartment("");
    setViolationDate(todayIso());
    setViolations([newRow()]);
    setComments("");
    setDiscipline("verbal");
    setSuspFrom(""); setSuspTo("");
    setPhotos([]);
    setSupervisorSig(null);
    setEmployeeSig(null);
  };

  const handlePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setPhotos((cur) => [...cur, ...files].slice(0, 8));
    e.target.value = "";
  };

  const updateRow = (idx: number, patch: Partial<ViolationRow>) => {
    setViolations((rows) => rows.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };
  const toggleCode = (idx: number, code: number) => {
    setViolations((rows) => rows.map((r, i) => {
      if (i !== idx) return r;
      const has = r.corrective_codes.includes(code);
      return { ...r, corrective_codes: has ? r.corrective_codes.filter(c => c !== code) : [...r.corrective_codes, code].sort() };
    }));
  };

  const submit = async () => {
    if (!user) { toast.error("Not signed in"); return; }
    if (!selectedEmp) { toast.error("Select the employee being cited"); return; }
    if (!violationDate) { toast.error("Violation date is required"); return; }
    const cleanRows = violations
      .map(r => ({ ...r, rule: r.rule.trim(), description: r.description.trim(), corrective_other: r.corrective_other.trim() }))
      .filter(r => r.rule || r.description);
    if (cleanRows.length === 0) { toast.error("Add at least one violation"); return; }
    if (discipline === "suspension" && (!suspFrom || !suspTo)) {
      toast.error("Suspension dates required");
      return;
    }

    setSubmitting(true);
    try {
      const selectedJob = presetJob ?? jobs.find(j => j.id === jobId);

      // Upload photos
      const photoPaths: string[] = [];
      for (const file of photos) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("safety-violation-photos").upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        photoPaths.push(path);
      }

      // Upload signatures as data-URL files
      const uploadSig = async (dataUrl: string | null, kind: string): Promise<string | null> => {
        if (!dataUrl) return null;
        const blob = await (await fetch(dataUrl)).blob();
        const path = `${user.id}/${Date.now()}-${kind}.png`;
        const { error } = await supabase.storage.from("safety-violation-photos").upload(path, blob, { contentType: "image/png" });
        if (error) throw error;
        return path;
      };
      const supSigPath = await uploadSig(supervisorSig, "supervisor-sig");
      const empSigPath = await uploadSig(employeeSig, "employee-sig");

      const { data: row, error } = await supabase.from("safety_violations").insert({
        job_id: selectedJob?.id ?? null,
        job_name_snapshot: selectedJob?.name ?? null,
        job_number_snapshot: selectedJob?.job_number ?? null,
        employee_contact_id: selectedEmp.id,
        employee_name: selectedEmp.name,
        department: department.trim() || null,
        violation_date: violationDate,
        violations: cleanRows,
        comments: comments.trim() || null,
        disciplinary_action: discipline,
        suspension_from: discipline === "suspension" ? suspFrom : null,
        suspension_to: discipline === "suspension" ? suspTo : null,
        photo_paths: photoPaths,
        supervisor_signature_path: supSigPath,
        employee_signature_path: empSigPath,
        employee_acknowledged: !!employeeSig,
        filed_by: user.id,
        filed_by_name: displayName ?? user.email ?? "Unknown",
      }).select("id").single();

      if (error) throw error;

      supabase.functions.invoke("submit-safety-violation", { body: { violationId: row.id } })
        .catch((e) => console.error("email dispatch failed", e));

      toast.success("Violation notice filed. Office has been notified.");
      reset();
      onOpenChange(false);
    } catch (e: unknown) {
      console.error(e);
      toast.error(errorMessage(e, "Failed to file notice"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!submitting) { if (!o) reset(); onOpenChange(o); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <ShieldAlert className="h-5 w-5" /> Safety violation notice
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

          <div>
            <Label className="text-xs">Employee *</Label>
            <Select value={empContactId} onValueChange={setEmpContactId}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Department</Label>
              <Input value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={100} />
            </div>
            <div>
              <Label className="text-xs">Violation date *</Label>
              <Input type="date" value={violationDate} onChange={(e) => setViolationDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Violations *</Label>
            {violations.map((row, idx) => (
              <div key={idx} className="rounded-md border border-border bg-surface p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Violation {idx + 1}</span>
                  {violations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setViolations(violations.filter((_, i) => i !== idx))}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <Input
                  placeholder="Rule violated (e.g. PPE, Fall Protection)"
                  value={row.rule}
                  onChange={(e) => updateRow(idx, { rule: e.target.value })}
                />
                <Textarea
                  rows={2}
                  placeholder="Description"
                  value={row.description}
                  onChange={(e) => updateRow(idx, { description: e.target.value })}
                />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Corrective action required</p>
                  <div className="grid grid-cols-1 gap-1">
                    {CODES.map(c => (
                      <label key={c.code} className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={row.corrective_codes.includes(c.code)}
                          onCheckedChange={() => toggleCode(idx, c.code)}
                        />
                        <span>{c.label}</span>
                      </label>
                    ))}
                  </div>
                  {row.corrective_codes.includes(6) && (
                    <Input
                      className="mt-1"
                      placeholder="Specify other action"
                      value={row.corrective_other}
                      onChange={(e) => updateRow(idx, { corrective_other: e.target.value })}
                    />
                  )}
                </div>
              </div>
            ))}
            {violations.length < 3 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setViolations([...violations, newRow()])}>
                <Plus className="mr-1 h-3 w-3" /> Add another violation
              </Button>
            )}
          </div>

          <div>
            <Label className="text-xs">Comments</Label>
            <Textarea rows={2} value={comments} onChange={(e) => setComments(e.target.value)} maxLength={1000} />
          </div>

          <div>
            <Label className="text-xs">Disciplinary action *</Label>
            <Select value={discipline} onValueChange={(v) => setDiscipline(v as Discipline)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DISCIPLINES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {discipline === "suspension" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Suspension from *</Label>
                <Input type="date" value={suspFrom} onChange={(e) => setSuspFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Suspension to *</Label>
                <Input type="date" value={suspTo} onChange={(e) => setSuspTo(e.target.value)} />
              </div>
            </div>
          )}

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
            <Label className="text-xs">Supervisor signature *</Label>
            <SignaturePad onChange={setSupervisorSig} />
          </div>
          <div>
            <Label className="text-xs">Employee signature (acknowledgment)</Label>
            <SignaturePad onChange={setEmployeeSig} />
            <p className="mt-1 text-[10px] text-muted-foreground">Optional — employee can sign later if not present.</p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button className="flex-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={submit} disabled={submitting}>
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Filing…</> : "File notice"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const SafetyViolationButton = ({ presetJob, variant = "outline", className = "" }: { presetJob?: { id: string; name: string; job_number: string | null } | null; variant?: "default" | "outline"; className?: string; }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} className={`w-full ${className}`} onClick={() => setOpen(true)}>
        <ShieldAlert className="mr-2 h-4 w-4" /> Safety violation notice
      </Button>
      <SafetyViolationDialog open={open} onOpenChange={setOpen} presetJob={presetJob ?? null} />
    </>
  );
};
