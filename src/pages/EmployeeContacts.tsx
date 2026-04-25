import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Upload, Search, Pencil, Trash2, Phone, Mail, MapPin, Contact } from "lucide-react";
import * as XLSX from "xlsx";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { BottomNav } from "@/components/BottomNav";

type EmployeeContact = {
  id: string;
  name: string;
  job_title: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
};

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  job_title: z.string().trim().max(100).optional().or(z.literal("")),
  department: z.string().trim().max(100).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  email: z.string().trim().max(255).email("Invalid email").optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

const emptyForm = {
  name: "",
  job_title: "",
  department: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

const HEADER_MAP: Record<string, keyof typeof emptyForm> = {
  name: "name",
  "full name": "name",
  employee: "name",
  "employee name": "name",
  job_title: "job_title",
  "job title": "job_title",
  title: "job_title",
  position: "job_title",
  role: "job_title",
  department: "department",
  dept: "department",
  team: "department",
  crew: "department",
  phone: "phone",
  "phone number": "phone",
  tel: "phone",
  telephone: "phone",
  mobile: "phone",
  cell: "phone",
  email: "email",
  "email address": "email",
  address: "address",
  location: "address",
  notes: "notes",
  note: "notes",
  comments: "notes",
};

const decodeVCardValue = (val: string, encoding?: string) => {
  let v = val;
  if (encoding && encoding.toUpperCase() === "QUOTED-PRINTABLE") {
    v = v.replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
  return v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
};

type VCardContact = typeof emptyForm;

const parseVCards = (text: string): VCardContact[] => {
  const unfolded = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const cards: VCardContact[] = [];
  const blocks = unfolded.split(/BEGIN:VCARD/i).slice(1);

  for (const block of blocks) {
    const body = block.split(/END:VCARD/i)[0];
    if (!body) continue;
    const contact: VCardContact = { ...emptyForm };
    const phones: string[] = [];
    const emails: string[] = [];
    const addresses: string[] = [];

    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const left = line.slice(0, colonIdx);
      const value = line.slice(colonIdx + 1);
      const parts = left.split(";");
      const prop = parts[0].toUpperCase();
      const params = parts.slice(1);
      const encoding = params.find((p) => /^ENCODING=/i.test(p))?.split("=")[1];
      const decoded = decodeVCardValue(value, encoding);

      if (prop === "FN" && !contact.name) {
        contact.name = decoded;
      } else if (prop === "N" && !contact.name) {
        const [family = "", given = ""] = decoded.split(";");
        const full = [given, family].filter(Boolean).join(" ").trim();
        if (full) contact.name = full;
      } else if (prop === "ORG" && !contact.department) {
        const org = decoded.split(";")[0].trim();
        if (org) contact.department = org;
      } else if (prop === "TITLE" && !contact.job_title) {
        contact.job_title = decoded;
      } else if (prop === "TEL") {
        phones.push(decoded);
      } else if (prop === "EMAIL") {
        emails.push(decoded);
      } else if (prop === "ADR") {
        const [, , street = "", city = "", region = "", postal = "", country = ""] = decoded.split(";");
        const formatted = [street, [city, region].filter(Boolean).join(", "), postal, country]
          .filter((p) => p && p.trim())
          .join(", ");
        if (formatted) addresses.push(formatted);
      } else if (prop === "NOTE") {
        contact.notes = contact.notes ? `${contact.notes}\n${decoded}` : decoded;
      }
    }

    contact.phone = phones[0] ?? "";
    contact.email = emails[0] ?? "";
    contact.address = addresses[0] ?? "";

    if (contact.name.trim()) cards.push(contact);
  }
  return cards;
};

const EmployeeContacts = () => {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const canEdit = role === "foreman" || role === "office" || role === "admin";
  const canDelete = role === "office" || role === "admin";

  const [contacts, setContacts] = useState<EmployeeContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeContact | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const vcardInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("employee_contacts")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      toast({ title: "Couldn't load contacts", description: error.message, variant: "destructive" });
    } else {
      setContacts((data ?? []) as EmployeeContact[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const departments = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => c.department && set.add(c.department));
    return Array.from(set).sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (deptFilter !== "all" && (c.department ?? "") !== deptFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.department ?? "").toLowerCase().includes(q) ||
        (c.job_title ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [contacts, search, deptFilter]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: EmployeeContact) => {
    setEditing(c);
    setForm({
      name: c.name,
      job_title: c.job_title ?? "",
      department: c.department ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      address: c.address ?? "",
      notes: c.notes ?? "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Check the form", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: parsed.data.name,
      job_title: parsed.data.job_title || null,
      department: parsed.data.department || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
    };

    if (editing) {
      const { error } = await supabase.from("employee_contacts").update(payload).eq("id", editing.id);
      if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
      else {
        toast({ title: "Contact updated" });
        setDialogOpen(false);
        load();
      }
    } else {
      const { error } = await supabase
        .from("employee_contacts")
        .insert({ ...payload, created_by: user?.id ?? null });
      if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
      else {
        toast({ title: "Contact added" });
        setDialogOpen(false);
        load();
      }
    }
    setSaving(false);
  };

  const remove = async (c: EmployeeContact) => {
    if (!confirm(`Delete contact "${c.name}"?`)) return;
    const { error } = await supabase.from("employee_contacts").delete().eq("id", c.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Contact deleted" });
      load();
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const isVCard = /\.vcf$/i.test(file.name) || file.type === "text/vcard" || file.type === "text/x-vcard";
      let rows: Array<Record<string, unknown>>;

      if (isVCard) {
        const text = await file.text();
        const cards = parseVCards(text);
        if (cards.length === 0) {
          toast({ title: "No contacts found in vCard", variant: "destructive" });
          return;
        }
        rows = cards as unknown as Array<Record<string, unknown>>;
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        if (rows.length === 0) {
          toast({ title: "Empty spreadsheet", variant: "destructive" });
          return;
        }
      }

      const records: Array<Record<string, string | null>> = [];
      const errors: string[] = [];

      rows.forEach((row, idx) => {
        const mapped: Record<string, string> = { ...emptyForm };
        Object.keys(row).forEach((key) => {
          const norm = key.trim().toLowerCase();
          const field = HEADER_MAP[norm];
          if (field) mapped[field] = String(row[key] ?? "").trim();
        });
        const parsed = contactSchema.safeParse(mapped);
        if (!parsed.success) {
          errors.push(`Row ${idx + 2}: ${parsed.error.errors[0].message}`);
          return;
        }
        records.push({
          name: parsed.data.name,
          job_title: parsed.data.job_title || null,
          department: parsed.data.department || null,
          phone: parsed.data.phone || null,
          email: parsed.data.email || null,
          address: parsed.data.address || null,
          notes: parsed.data.notes || null,
          created_by: user?.id ?? null,
        });
      });

      if (records.length === 0) {
        toast({
          title: "Nothing to import",
          description: errors[0] ?? "No valid rows found",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from("employee_contacts").insert(records as never);
      if (error) {
        toast({ title: "Import failed", description: error.message, variant: "destructive" });
        return;
      }

      toast({
        title: `Imported ${records.length} contact${records.length === 1 ? "" : "s"}`,
        description: errors.length > 0 ? `${errors.length} row(s) skipped` : undefined,
      });
      load();
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Could not read file",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (vcardInputRef.current) vcardInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Employee Contacts</h1>
        <span className="ml-auto text-xs text-muted-foreground">{contacts.length}</span>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 px-3 pb-4 pt-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {departments.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setDeptFilter("all")}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
                deptFilter === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border"
              }`}
            >
              All
            </button>
            {departments.map((d) => (
              <button
                key={d}
                onClick={() => setDeptFilter(d)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
                  deptFilter === d ? "border-primary bg-primary text-primary-foreground" : "border-border"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        )}

        {canEdit && (
          <>
            <div className="flex gap-2">
              <Button onClick={openAdd} className="flex-1">
                <Plus className="mr-1 h-4 w-4" /> Add Contact
              </Button>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="flex-1"
              >
                <Upload className="mr-1 h-4 w-4" /> {importing ? "Importing…" : "Import"}
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => vcardInputRef.current?.click()}
              disabled={importing}
              className="w-full"
            >
              <Contact className="mr-1 h-4 w-4" /> Import Contact (vCard)
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
              }}
            />
            <input
              ref={vcardInputRef}
              type="file"
              accept=".vcf,text/vcard,text/x-vcard"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              Import a CSV/Excel sheet, or share a contact (.vcf) from your phone's Contacts app.
            </p>
          </>
        )}

        <div className="space-y-2">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {contacts.length === 0 ? "No contacts yet." : "No matches."}
            </p>
          ) : (
            filtered.map((c) => (
              <Card key={c.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-semibold">{c.name}</h3>
                      {c.department && (
                        <Badge variant="secondary" className="text-[10px]">
                          {c.department}
                        </Badge>
                      )}
                    </div>
                    {c.job_title && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{c.job_title}</p>
                    )}
                    <div className="mt-2 space-y-1 text-xs">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-foreground hover:text-primary">
                          <Phone className="h-3 w-3" /> {c.phone}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-foreground hover:text-primary">
                          <Mail className="h-3 w-3" /> {c.email}
                        </a>
                      )}
                      {c.address && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(c.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-1.5 text-foreground hover:text-primary"
                        >
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> <span>{c.address}</span>
                        </a>
                      )}
                      {c.notes && <p className="text-muted-foreground">{c.notes}</p>}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex flex-col gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <Button size="icon" variant="ghost" onClick={() => remove(c)} aria-label="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit contact" : "Add contact"}</DialogTitle>
            <DialogDescription>Quick info — only name is required.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label htmlFor="ec-name">Name *</Label>
              <Input id="ec-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="ec-title">Job title</Label>
                <Input
                  id="ec-title"
                  placeholder="Operator, Foreman…"
                  value={form.job_title}
                  onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="ec-dept">Department</Label>
                <Input
                  id="ec-dept"
                  placeholder="Field, Office…"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="ec-phone">Phone</Label>
                <Input id="ec-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ec-email">Email</Label>
                <Input id="ec-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="ec-addr">Address</Label>
              <Input id="ec-addr" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="ec-notes">Notes</Label>
              <Textarea id="ec-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default EmployeeContacts;
