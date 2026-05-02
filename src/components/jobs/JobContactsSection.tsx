import { useEffect, useState } from "react";
import { Phone, Mail, MapPin, User as UserIcon, Plus, Pencil, Trash2, Download, Building2, ContactRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export interface JobContact {
  id: string;
  job_id: string;
  name: string;
  title: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  manager: string | null;
  notes: string | null;
  sort_order: number;
}

interface Props {
  jobId: string;
  jobName: string;
  foremanId: string | null;
}

const empty = (jobId: string): Partial<JobContact> => ({
  job_id: jobId, name: "", title: "", company: "", phone: "", email: "", address: "", manager: "", notes: "",
});

const escapeVCard = (v: string) => v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

const toVCard = (c: JobContact, jobName: string): string => {
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  lines.push(`FN:${escapeVCard(c.name)}`);
  const parts = c.name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts.slice(-1)[0] : "";
  const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : c.name;
  lines.push(`N:${escapeVCard(last)};${escapeVCard(first)};;;`);
  if (c.company) lines.push(`ORG:${escapeVCard(c.company)}`);
  if (c.title) lines.push(`TITLE:${escapeVCard(c.title)}`);
  if (c.phone) lines.push(`TEL;TYPE=CELL,VOICE:${c.phone}`);
  if (c.email) lines.push(`EMAIL;TYPE=INTERNET:${c.email}`);
  if (c.address) lines.push(`ADR;TYPE=WORK:;;${escapeVCard(c.address)};;;;`);
  const noteParts: string[] = [`Job: ${jobName}`];
  if (c.manager) noteParts.push(`Manager: ${c.manager}`);
  if (c.notes) noteParts.push(c.notes);
  lines.push(`NOTE:${escapeVCard(noteParts.join(" — "))}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
};

const downloadVCard = (vcard: string, filename: string) => {
  const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[^a-z0-9._-]+/gi, "_") + ".vcf";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const JobContactsSection = ({ jobId, jobName, foremanId }: Props) => {
  const { user, role: realRole, effectiveRole } = useAuth();
  const role = effectiveRole ?? realRole;
  const canEdit = role === "office" || role === "admin" || (role === "foreman" && user?.id === foremanId);

  const [contacts, setContacts] = useState<JobContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<JobContact> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("job_contacts")
      .select("*")
      .eq("job_id", jobId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setContacts((data as JobContact[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [jobId]);

  const save = async () => {
    if (!editing?.name?.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const payload = {
      job_id: jobId,
      name: editing.name!.trim(),
      title: editing.title?.trim() || null,
      company: editing.company?.trim() || null,
      phone: editing.phone?.trim() || null,
      email: editing.email?.trim() || null,
      address: editing.address?.trim() || null,
      manager: editing.manager?.trim() || null,
      notes: editing.notes?.trim() || null,
      created_by: user?.id ?? null,
    };
    const { error } = editing.id
      ? await supabase.from("job_contacts").update(payload).eq("id", editing.id)
      : await supabase.from("job_contacts").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setEditing(null);
    toast.success(editing.id ? "Contact updated" : "Contact added");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    const { error } = await supabase.from("job_contacts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Contact deleted");
    load();
  };

  const downloadOne = (c: JobContact) => {
    downloadVCard(toVCard(c, jobName), `${c.name}-${jobName}`);
  };

  const downloadAll = () => {
    if (contacts.length === 0) return;
    const all = contacts.map(c => toVCard(c, jobName)).join("\r\n");
    downloadVCard(all, `${jobName}-contacts`);
  };

  return (
    <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground flex items-center gap-1.5">
          <ContactRound className="h-3.5 w-3.5" /> Job contacts
        </h2>
        <div className="flex items-center gap-1">
          {contacts.length > 1 && (
            <Button size="sm" variant="ghost" onClick={downloadAll} title="Save all to phone">
              <Download className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Save all</span>
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setEditing(empty(jobId))}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="py-3 text-center text-xs text-muted-foreground">Loading…</p>
      ) : contacts.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">
          No contacts yet{canEdit ? " — tap Add to create one." : "."}
        </p>
      ) : (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li key={c.id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{c.name}</p>
                  {c.title && <p className="text-xs text-muted-foreground truncate">{c.title}</p>}
                  {c.company && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                      <Building2 className="h-3 w-3 shrink-0" /> {c.company}
                    </p>
                  )}
                  {c.manager && (
                    <p className="text-xs text-muted-foreground truncate">
                      Manager: <span className="text-primary">{c.manager}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => downloadOne(c)} title="Save to phone">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {canEdit && (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(c)} title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => remove(c.id)} title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <Phone className="h-3 w-3" /> {c.phone}
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-primary hover:underline truncate max-w-full">
                    <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{c.email}</span>
                  </a>
                )}
                {c.address && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline truncate max-w-full"
                  >
                    <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{c.address}</span>
                  </a>
                )}
              </div>
              {c.notes && <p className="mt-1.5 text-xs text-muted-foreground whitespace-pre-wrap">{c.notes}</p>}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit contact" : "Add contact"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Field label="Name *" value={editing.name ?? ""} onChange={(v) => setEditing({ ...editing, name: v })} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Title / Role" value={editing.title ?? ""} onChange={(v) => setEditing({ ...editing, title: v })} />
                <Field label="Company" value={editing.company ?? ""} onChange={(v) => setEditing({ ...editing, company: v })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Phone" type="tel" value={editing.phone ?? ""} onChange={(v) => setEditing({ ...editing, phone: v })} />
                <Field label="Email" type="email" value={editing.email ?? ""} onChange={(v) => setEditing({ ...editing, email: v })} />
              </div>
              <Field label="Address" value={editing.address ?? ""} onChange={(v) => setEditing({ ...editing, address: v })} />
              <Field label="Manager" value={editing.manager ?? ""} onChange={(v) => setEditing({ ...editing, manager: v })} />
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

const Field = ({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) => (
  <div>
    <Label className="text-xs">{label}</Label>
    <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} maxLength={255} />
  </div>
);
