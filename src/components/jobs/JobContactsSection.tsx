import { useEffect, useMemo, useState } from "react";
import { Phone, Mail, MapPin, Plus, Pencil, Trash2, Download, Building2, ContactRound, ChevronDown, ChevronRight, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatPhone } from "@/lib/phone";

export interface JobContact {
  id: string;
  job_id: string;
  name: string | null;
  title: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  manager: string | null;
  notes: string | null;
  sort_order: number;
  category: string | null;
  role_label: string | null;
  material: string | null;
  vendor_id: string | null;
  employee_contact_id: string | null;
  is_template_slot: boolean;
}

interface Vendor {
  id: string; name: string; category: string | null; contact_name: string | null;
  phone: string | null; email: string | null; address: string | null;
}

interface EmployeeContact {
  id: string; name: string; job_title: string | null; phone: string | null;
  email: string | null; work_email: string | null;
}

interface Props { jobId: string; jobName: string; foremanId: string | null; }

const CATEGORIES = ["GC", "Schreiber", "External Partners", "Inspectors", "Suppliers", "Subcontractors", "Other"];

const escapeVCard = (v: string) => v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

const toVCard = (c: JobContact, jobName: string): string => {
  const name = c.name || c.role_label || "Contact";
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${escapeVCard(name)}`];
  const parts = name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts.slice(-1)[0] : "";
  const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : name;
  lines.push(`N:${escapeVCard(last)};${escapeVCard(first)};;;`);
  if (c.company) lines.push(`ORG:${escapeVCard(c.company)}`);
  if (c.title || c.role_label) lines.push(`TITLE:${escapeVCard(c.title || c.role_label || "")}`);
  if (c.phone) lines.push(`TEL;TYPE=CELL,VOICE:${c.phone}`);
  if (c.email) lines.push(`EMAIL;TYPE=INTERNET:${c.email}`);
  if (c.address) lines.push(`ADR;TYPE=WORK:;;${escapeVCard(c.address)};;;;`);
  const noteParts = [`Job: ${jobName}`];
  if (c.material) noteParts.push(`Material: ${c.material}`);
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
  a.href = url; a.download = filename.replace(/[^a-z0-9._-]+/gi, "_") + ".vcf";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const isFilled = (c: JobContact) => !!(c.name?.trim() || c.phone || c.email || c.company || c.address);

export const JobContactsSection = ({ jobId, jobName, foremanId }: Props) => {
  const { user, role: realRole, effectiveRole } = useAuth();
  const role = effectiveRole ?? realRole;
  const canEdit = role === "office" || role === "admin" || (role === "foreman" && user?.id === foremanId);

  const [contacts, setContacts] = useState<JobContact[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [employees, setEmployees] = useState<EmployeeContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<JobContact> | null>(null);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showEmpty, setShowEmpty] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [c, v, e] = await Promise.all([
      supabase.from("job_contacts").select("*").eq("job_id", jobId).order("sort_order").order("created_at"),
      supabase.from("vendors").select("id,name,category,contact_name,phone,email,address").eq("is_active", true).order("name"),
      supabase.rpc("list_employee_directory"),
    ]);
    setContacts((c.data as JobContact[] | null) ?? []);
    setVendors((v.data as Vendor[] | null) ?? []);
    const empRows = ((e.data as { id: string; name: string; job_title: string | null; phone: string | null; email: string | null; work_email: string | null; is_active: boolean }[] | null) ?? [])
      .filter((r) => r.is_active)
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    setEmployees(empRows as unknown as EmployeeContact[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [jobId]);

  const grouped = useMemo(() => {
    const g: Record<string, JobContact[]> = {};
    for (const c of contacts) {
      const cat = c.category || "Other";
      (g[cat] ??= []).push(c);
    }
    return g;
  }, [contacts]);

  const orderedCats = CATEGORIES.filter(c => grouped[c]?.length);

  const save = async () => {
    if (!editing) return;
    if (!editing.name?.trim() && !editing.is_template_slot) { toast.error("Name is required"); return; }
    setSaving(true);
    const payload: any = {
      job_id: jobId,
      name: editing.name?.trim() || "",
      title: editing.title?.trim() || null,
      company: editing.company?.trim() || null,
      phone: editing.phone?.trim() || null,
      email: editing.email?.trim() || null,
      address: editing.address?.trim() || null,
      manager: editing.manager?.trim() || null,
      notes: editing.notes?.trim() || null,
      category: editing.category || "Other",
      role_label: editing.role_label?.trim() || null,
      material: editing.material?.trim() || null,
      vendor_id: editing.vendor_id || null,
      employee_contact_id: editing.employee_contact_id || null,
    };
    if (!editing.id) payload.created_by = user?.id ?? null;
    const { error } = editing.id
      ? await supabase.from("job_contacts").update(payload).eq("id", editing.id)
      : await supabase.from("job_contacts").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setEditing(null);
    toast.success("Saved");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this contact?")) return;
    const { error } = await supabase.from("job_contacts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); load();
  };

  const linkVendor = (vendorId: string) => {
    if (!editing) return;
    if (vendorId === "__none__") { setEditing({ ...editing, vendor_id: null }); return; }
    const v = vendors.find(x => x.id === vendorId);
    if (!v) return;
    setEditing({
      ...editing,
      vendor_id: v.id,
      name: editing.name || v.contact_name || v.name,
      company: v.name,
      phone: editing.phone || v.phone || "",
      email: editing.email || v.email || "",
      address: editing.address || v.address || "",
    });
  };

  const linkEmployee = (empId: string) => {
    if (!editing) return;
    if (empId === "__none__") { setEditing({ ...editing, employee_contact_id: null }); return; }
    const e = employees.find(x => x.id === empId);
    if (!e) return;
    setEditing({
      ...editing,
      employee_contact_id: e.id,
      name: e.name,
      title: editing.title || e.job_title || "",
      phone: editing.phone || e.phone || "",
      email: editing.email || e.email || e.work_email || "",
    });
  };

  const downloadAll = () => {
    const filled = contacts.filter(isFilled);
    if (!filled.length) return;
    downloadVCard(filled.map(c => toVCard(c, jobName)).join("\r\n"), `${jobName}-contacts`);
  };

  const filledCount = contacts.filter(isFilled).length;

  return (
    <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex flex-1 items-center gap-1.5 font-display text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <ContactRound className="h-3.5 w-3.5" /> Job contacts
          <span className="text-muted-foreground/60 normal-case tracking-normal">({filledCount})</span>
        </button>
        <div className="flex items-center gap-1">
          {open && filledCount > 1 && (
            <Button size="sm" variant="ghost" onClick={downloadAll} title="Save all to phone">
              <Download className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Save all</span>
            </Button>
          )}
          {open && canEdit && (
            <Button size="sm" variant="outline" onClick={() => setEditing({ job_id: jobId, category: "Other" })}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          )}
        </div>
      </div>

      {open && (
        <>
          {canEdit && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} className="h-3 w-3" />
              Show empty template slots
            </label>
          )}

          {loading ? (
            <p className="py-3 text-center text-xs text-muted-foreground">Loading…</p>
          ) : orderedCats.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">No contacts yet.</p>
          ) : (
            orderedCats.map(cat => {
              const items = grouped[cat].filter(c => showEmpty || isFilled(c));
              if (!items.length) return null;
              const isCollapsed = collapsed[cat];
              return (
                <div key={cat} className="space-y-1.5">
                  <button
                    onClick={() => setCollapsed({ ...collapsed, [cat]: !isCollapsed })}
                    className="flex w-full items-center gap-1 pt-2 text-[10px] uppercase font-bold tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {cat} <span className="text-muted-foreground/60">({items.filter(isFilled).length}/{items.length})</span>
                  </button>
                  {!isCollapsed && (
                    <ul className="space-y-1.5">
                      {items.map((c) => (
                        <ContactRow key={c.id} c={c} canEdit={canEdit} jobName={jobName}
                          onEdit={() => setEditing(c)} onDelete={() => remove(c.id)} />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? (editing.is_template_slot ? `Fill: ${editing.role_label}` : "Edit contact") : "Add contact"}
              {editing?.material && <span className="block text-xs font-normal text-muted-foreground mt-0.5">{editing.material}</span>}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              {!editing.is_template_slot && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Category</Label>
                    <Select value={editing.category || "Other"} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Field label="Role" value={editing.role_label ?? ""} onChange={(v) => setEditing({ ...editing, role_label: v })} />
                </div>
              )}

              {(editing.category === "Suppliers" || editing.material) && (
                <Field label="Material / Service" value={editing.material ?? ""} onChange={(v) => setEditing({ ...editing, material: v })} />
              )}

              <div>
                <Label className="text-xs flex items-center gap-1"><Link2 className="h-3 w-3" /> Link from vendor list</Label>
                <Select value={editing.vendor_id || "__none__"} onValueChange={linkVendor}>
                  <SelectTrigger><SelectValue placeholder="Choose vendor…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}{v.category ? ` (${v.category})` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs flex items-center gap-1"><Link2 className="h-3 w-3" /> Link from employees</Label>
                <Select value={editing.employee_contact_id || "__none__"} onValueChange={linkEmployee}>
                  <SelectTrigger><SelectValue placeholder="Choose employee…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}{e.job_title ? ` — ${e.job_title}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Field label="Name" value={editing.name ?? ""} onChange={(v) => setEditing({ ...editing, name: v })} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Title" value={editing.title ?? ""} onChange={(v) => setEditing({ ...editing, title: v })} />
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

const ContactRow = ({ c, canEdit, jobName, onEdit, onDelete }: {
  c: JobContact; canEdit: boolean; jobName: string; onEdit: () => void; onDelete: () => void;
}) => {
  const filled = isFilled(c);
  const downloadOne = () => downloadVCard(toVCard(c, jobName), `${c.name || c.role_label}-${jobName}`);
  const label = c.role_label || c.title;
  const subLabel = c.material;

  if (!filled) {
    return (
      <li className={`rounded-lg border border-dashed border-border/60 bg-background/50 p-2 ${canEdit ? "cursor-pointer hover:border-primary/50" : ""}`}
          onClick={canEdit ? onEdit : undefined}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground/80">{label || "Contact"}</p>
            {subLabel && <p className="text-[10px] text-muted-foreground/60">{subLabel}</p>}
          </div>
          {canEdit && <Plus className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-border bg-background p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {c.company && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
              <Building2 className="h-3 w-3 shrink-0" /> {c.company}
            </p>
          )}
          {c.name && <p className="font-semibold text-sm truncate">{c.name}</p>}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={downloadOne} title="Save to phone">
            <Download className="h-3.5 w-3.5" />
          </Button>
          {canEdit && (
            <>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit} title="Edit">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {!c.is_template_slot && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} title="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline"><Phone className="h-3 w-3" /> {formatPhone(c.phone)}</a>}
        {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-primary hover:underline truncate max-w-full"><Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{c.email}</span></a>}
      </div>
    </li>
  );
};

const Field = ({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) => (
  <div>
    <Label className="text-xs">{label}</Label>
    <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} maxLength={255} />
  </div>
);
