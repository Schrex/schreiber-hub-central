import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Upload, Search, Pencil, Trash2, Phone, Mail, Globe, MapPin, Contact, Download, CheckSquare, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
import { downloadVCard } from "@/lib/vcard";
import { formatPhone } from "@/lib/phone";
import { getContactPickerUnavailableReason, isContactPickerSupported, pickContactsFromDevice } from "@/lib/contactPicker";

type Vendor = {
  id: string;
  name: string;
  category: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
};

const vendorSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  category: z.string().trim().max(100).optional().or(z.literal("")),
  contact_name: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  email: z.string().trim().max(255).email("Invalid email").optional().or(z.literal("")),
  website: z.string().trim().max(500).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

const emptyForm = {
  name: "",
  category: "",
  contact_name: "",
  phone: "",
  email: "",
  website: "",
  address: "",
  notes: "",
};

const HEADER_MAP: Record<string, keyof typeof emptyForm> = {
  name: "name",
  vendor: "name",
  "vendor name": "name",
  company: "name",
  category: "category",
  type: "category",
  contact: "contact_name",
  "contact name": "contact_name",
  "contact person": "contact_name",
  phone: "phone",
  "phone number": "phone",
  tel: "phone",
  telephone: "phone",
  email: "email",
  "email address": "email",
  website: "website",
  url: "website",
  web: "website",
  address: "address",
  location: "address",
  notes: "notes",
  note: "notes",
  comments: "notes",
};

// Decode RFC 6350 quoted-printable / escape sequences in vCard values
const decodeVCardValue = (val: string, encoding?: string) => {
  let v = val;
  if (encoding && encoding.toUpperCase() === "QUOTED-PRINTABLE") {
    v = v.replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
  return v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
};

type VCardContact = typeof emptyForm;

const parseVCards = (text: string): VCardContact[] => {
  // Unfold lines per RFC 6350 (lines starting with space/tab continue previous)
  const unfolded = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const cards: VCardContact[] = [];
  const blocks = unfolded.split(/BEGIN:VCARD/i).slice(1);

  for (const block of blocks) {
    const body = block.split(/END:VCARD/i)[0];
    if (!body) continue;
    const contact: VCardContact = { ...emptyForm };
    const phones: string[] = [];
    const emails: string[] = [];
    const urls: string[] = [];
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
        // N: Family;Given;Middle;Prefix;Suffix
        const [family = "", given = ""] = decoded.split(";");
        const full = [given, family].filter(Boolean).join(" ").trim();
        if (full) contact.name = full;
      } else if (prop === "ORG") {
        const org = decoded.split(";")[0].trim();
        if (org) {
          // If we already have a personal name, keep it as contact_name and use org as name
          if (contact.name && !contact.contact_name) contact.contact_name = contact.name;
          contact.name = org;
        }
      } else if (prop === "TITLE" && !contact.contact_name) {
        contact.contact_name = decoded;
      } else if (prop === "TEL") {
        phones.push(decoded);
      } else if (prop === "EMAIL") {
        emails.push(decoded);
      } else if (prop === "URL") {
        urls.push(decoded);
      } else if (prop === "ADR") {
        // ADR: PO;Ext;Street;City;Region;PostalCode;Country
        const [, , street = "", city = "", region = "", postal = "", country = ""] = decoded.split(";");
        const formatted = [street, [city, region].filter(Boolean).join(", "), postal, country]
          .filter((p) => p && p.trim())
          .join(", ");
        if (formatted) addresses.push(formatted);
      } else if (prop === "NOTE") {
        contact.notes = contact.notes ? `${contact.notes}\n${decoded}` : decoded;
      } else if (prop === "CATEGORIES" && !contact.category) {
        contact.category = decoded.split(",")[0].trim();
      }
    }

    contact.phone = phones[0] ?? "";
    contact.email = emails[0] ?? "";
    contact.website = urls[0] ?? "";
    contact.address = addresses[0] ?? "";

    if (contact.name.trim()) cards.push(contact);
  }
  return cards;
};

const Vendors = () => {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const canEdit = role === "foreman" || role === "office" || role === "admin";
  const canDelete = role === "office" || role === "admin";

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const vcardInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  // vCard review queue: contacts parsed but not yet saved
  const [reviewQueue, setReviewQueue] = useState<typeof emptyForm[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      toast({ title: "Couldn't load vendors", description: error.message, variant: "destructive" });
    } else {
      setVendors((data ?? []) as Vendor[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    vendors.forEach((v) => v.category && set.add(v.category));
    return Array.from(set).sort();
  }, [vendors]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter((v) => {
      if (categoryFilter !== "all" && (v.category ?? "") !== categoryFilter) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        (v.category ?? "").toLowerCase().includes(q) ||
        (v.contact_name ?? "").toLowerCase().includes(q) ||
        (v.phone ?? "").toLowerCase().includes(q) ||
        (v.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [vendors, search, categoryFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Vendor[]>();
    filtered.forEach((v) => {
      const key = v.category?.trim() || "Uncategorized";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    });
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "Uncategorized") return 1;
      if (b === "Uncategorized") return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((v) => selectedIds.has(v.id));
  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((v) => v.id)));
    }
  };
  const toggleGroup = (items: Vendor[]) => {
    const allSel = items.every((v) => selectedIds.has(v.id));
    setSelectedIds((s) => {
      const next = new Set(s);
      items.forEach((v) => (allSel ? next.delete(v.id) : next.add(v.id)));
      return next;
    });
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (v: Vendor) => {
    setEditing(v);
    setForm({
      name: v.name,
      category: v.category ?? "",
      contact_name: v.contact_name ?? "",
      phone: v.phone ?? "",
      email: v.email ?? "",
      website: v.website ?? "",
      address: v.address ?? "",
      notes: v.notes ?? "",
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const parsed = vendorSchema.safeParse(form);
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      toast({ title: "Check the form", description: first.message, variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      name: parsed.data.name,
      category: parsed.data.category || null,
      contact_name: parsed.data.contact_name || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      website: parsed.data.website || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
    };

    if (editing) {
      const { error } = await supabase.from("vendors").update(payload).eq("id", editing.id);
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Vendor updated" });
        setDialogOpen(false);
        load();
      }
    } else {
      const { error } = await supabase
        .from("vendors")
        .insert({ ...payload, created_by: user?.id ?? null });
      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Vendor added" });
        load();
        // If we're reviewing imported vCards, advance to next instead of closing
        if (reviewQueue.length > 0) {
          const more = advanceReview();
          if (!more) {
            setDialogOpen(false);
            toast({ title: "All contacts imported" });
          }
        } else {
          setDialogOpen(false);
        }
      }
    }
    setSaving(false);
  };

  const remove = async (v: Vendor) => {
    if (!confirm(`Delete vendor "${v.name}"?`)) return;
    const { error } = await supabase.from("vendors").delete().eq("id", v.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Vendor deleted" });
      load();
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} vendor${ids.length === 1 ? "" : "s"}?`)) return;
    const { error } = await supabase.from("vendors").delete().in("id", ids);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Deleted ${ids.length} vendor${ids.length === 1 ? "" : "s"}` });
      exitSelectMode();
      load();
    }
  };

  const bulkApplyCategory = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const cat = bulkCategory.trim() || null;
    const { error } = await supabase.from("vendors").update({ category: cat }).in("id", ids);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Updated ${ids.length} vendor${ids.length === 1 ? "" : "s"}` });
      setBulkCategoryOpen(false);
      setBulkCategory("");
      exitSelectMode();
      load();
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const isVCard = /\.vcf$/i.test(file.name) || file.type === "text/vcard" || file.type === "text/x-vcard";

      if (isVCard) {
        const text = await file.text();
        const contacts = parseVCards(text);
        if (contacts.length === 0) {
          toast({ title: "No contacts found in vCard", variant: "destructive" });
          return;
        }
        // Push to review queue and open dialog with first contact pre-filled
        setReviewQueue(contacts);
        setReviewIndex(0);
        setEditing(null);
        setForm(contacts[0]);
        setDialogOpen(true);
        toast({
          title: contacts.length === 1 ? "Review contact" : `Review ${contacts.length} contacts`,
          description: "Edit the info, then Save. You can skip any you don't want.",
        });
        return;
      }

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (rows.length === 0) {
        toast({ title: "Empty spreadsheet", variant: "destructive" });
        return;
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
        const parsed = vendorSchema.safeParse(mapped);
        if (!parsed.success) {
          errors.push(`Row ${idx + 2}: ${parsed.error.errors[0].message}`);
          return;
        }
        records.push({
          name: parsed.data.name,
          category: parsed.data.category || null,
          contact_name: parsed.data.contact_name || null,
          phone: parsed.data.phone || null,
          email: parsed.data.email || null,
          website: parsed.data.website || null,
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

      const { error } = await supabase.from("vendors").insert(records as never);
      if (error) {
        toast({ title: "Import failed", description: error.message, variant: "destructive" });
        return;
      }

      toast({
        title: `Imported ${records.length} vendor${records.length === 1 ? "" : "s"}`,
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

  // Advance to next vCard in the review queue, or close dialog when done.
  const advanceReview = () => {
    if (reviewQueue.length === 0) return false;
    const next = reviewIndex + 1;
    if (next < reviewQueue.length) {
      setReviewIndex(next);
      setForm(reviewQueue[next]);
      return true;
    }
    setReviewQueue([]);
    setReviewIndex(0);
    return false;
  };

  const skipReview = () => {
    const more = advanceReview();
    if (!more) {
      setDialogOpen(false);
      toast({ title: "Review complete" });
    }
  };

  const importFromContacts = async () => {
    if (!isContactPickerSupported()) {
      toast({
        title: "Contacts app can't open here",
        description: getContactPickerUnavailableReason() ?? "Use Android Chrome and open the app directly, outside the preview frame.",
        variant: "destructive",
      });
      return;
    }
    setImporting(true);
    try {
      const { contacts: picked, cancelled } = await pickContactsFromDevice(true);
      if (cancelled || picked.length === 0) {
        toast({ title: "No contact selected", description: "Nothing was imported." });
        return;
      }
      const queue = picked.map((p) => ({
        ...emptyForm,
        name: p.name, // vendor name defaults to person's name; user can edit in review
        contact_name: p.name,
        phone: p.phone,
        email: p.email,
        address: p.address,
      }));
      setReviewQueue(queue);
      setReviewIndex(0);
      setEditing(null);
      setForm(queue[0]);
      setDialogOpen(true);
      toast({
        title: queue.length === 1 ? "Review vendor" : `Review ${queue.length} vendors`,
        description: "Edit the info, then Save. You can skip any you don't want.",
      });
    } catch (err) {
      toast({
        title: "Couldn't open Contacts",
        description: err instanceof Error ? `${err.message} Try importing a .vcf contact file instead.` : "Try importing a .vcf contact file instead.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadVendorContact = (v: Vendor) => {
    downloadVCard({
      fullName: v.contact_name || v.name,
      organization: v.contact_name ? v.name : undefined,
      title: v.category ?? undefined,
      phone: v.phone ?? undefined,
      email: v.email ?? undefined,
      website: v.website ?? undefined,
      address: v.address ?? undefined,
      notes: v.notes ?? undefined,
    }, v.name);
  };


  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Vendors</h1>
        <span className="ml-auto text-xs text-muted-foreground">{vendors.length}</span>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 px-3 pb-4 pt-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search vendors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {categories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setCategoryFilter("all")}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
                categoryFilter === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border"
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
                  categoryFilter === c ? "border-primary bg-primary text-primary-foreground" : "border-border"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {canEdit && !selectMode && (
          <>
            <div className="flex gap-2">
              <Button onClick={openAdd} className="flex-1">
                <Plus className="mr-1 h-4 w-4" /> Add Vendor
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
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={importFromContacts}
                disabled={importing}
                className="flex-1"
              >
                <Contact className="mr-1 h-4 w-4" /> From Contacts
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectMode(true)}
                disabled={vendors.length === 0}
                className="flex-1"
              >
                <CheckSquare className="mr-1 h-4 w-4" /> Select
              </Button>
            </div>
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
              Tap "From Contacts" to pick directly from your phone (Android Chrome). On iPhone or desktop it falls back to picking a .vcf file.
            </p>
          </>
        )}

        {selectMode && (
          <div className="sticky top-[57px] z-20 -mx-3 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur">
            <Button size="sm" variant="ghost" onClick={exitSelectMode} aria-label="Cancel selection">
              <X className="mr-1 h-4 w-4" /> Cancel
            </Button>
            <Button size="sm" variant="outline" onClick={toggleSelectAll}>
              {allFilteredSelected ? "Clear" : "All"}
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">{selectedIds.size} selected</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setBulkCategory(""); setBulkCategoryOpen(true); }}
              disabled={selectedIds.size === 0}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" /> Type
            </Button>
            {canDelete && (
              <Button
                size="sm"
                variant="destructive"
                onClick={bulkDelete}
                disabled={selectedIds.size === 0}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </Button>
            )}
          </div>
        )}

        <div className="space-y-2">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {vendors.length === 0 ? "No vendors yet." : "No matches."}
            </p>
          ) : (
            grouped.map(([cat, items]) => {
              const groupAllSelected = items.every((v) => selectedIds.has(v.id));
              return (
                <section key={cat} className="space-y-1.5">
                  <div className="sticky top-[57px] z-10 -mx-3 flex items-center gap-2 bg-background/95 px-3 py-1 backdrop-blur">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {cat}
                    </h2>
                    <span className="text-[11px] text-muted-foreground">· {items.length}</span>
                    {selectMode && (
                      <button
                        type="button"
                        onClick={() => toggleGroup(items)}
                        className="ml-auto text-[11px] font-medium text-primary"
                      >
                        {groupAllSelected ? "Clear group" : "Select group"}
                      </button>
                    )}
                  </div>
                  {items.map((v) => {
                    const isOpen = expandedId === v.id && !selectMode;
                    const isSelected = selectedIds.has(v.id);
                    return (
                      <Card
                        key={v.id}
                        className={`px-3 py-1.5 ${selectMode && isSelected ? "border-primary bg-primary/5" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          {selectMode && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelected(v.id)}
                              aria-label={`Select ${v.name}`}
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => selectMode ? toggleSelected(v.id) : setExpandedId(isOpen ? null : v.id)}
                            className="min-w-0 flex-1 text-left"
                            aria-expanded={isOpen}
                          >
                            <h3 className="truncate text-sm font-medium">{v.name}</h3>
                            {v.contact_name && (
                              <p className="truncate text-[11px] text-muted-foreground">{v.contact_name}</p>
                            )}
                          </button>
                          {!selectMode && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => downloadVendorContact(v)}
                                aria-label="Save to phone contacts"
                                title="Save to contacts"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                              {canEdit && (
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(v)} aria-label="Edit">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(v)} aria-label="Delete">
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                        {isOpen && (
                          <div className="mt-2 space-y-1 border-t border-border pt-2 text-xs">
                            {v.phone && (
                              <a href={`tel:${v.phone}`} className="flex items-center gap-1.5 text-foreground hover:text-primary">
                                <Phone className="h-3 w-3" /> {v.phone}
                              </a>
                            )}
                            {v.email && (
                              <a href={`mailto:${v.email}`} className="flex items-center gap-1.5 text-foreground hover:text-primary">
                                <Mail className="h-3 w-3" /> {v.email}
                              </a>
                            )}
                            {v.website && (
                              <a
                                href={v.website.startsWith("http") ? v.website : `https://${v.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-foreground hover:text-primary"
                              >
                                <Globe className="h-3 w-3" /> {v.website}
                              </a>
                            )}
                            {v.address && (
                              <a
                                href={`https://maps.google.com/?q=${encodeURIComponent(v.address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-start gap-1.5 text-foreground hover:text-primary"
                              >
                                <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> <span>{v.address}</span>
                              </a>
                            )}
                            {v.notes && <p className="text-muted-foreground">{v.notes}</p>}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </section>
              );
            })
          )}
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {reviewQueue.length > 0
                ? `Review imported contact ${reviewIndex + 1} of ${reviewQueue.length}`
                : editing
                  ? "Edit vendor"
                  : "Add vendor"}
            </DialogTitle>
            <DialogDescription>
              {reviewQueue.length > 0
                ? "Edit the info, then Save to add — or Skip if you don't want this one."
                : "Quick info — only name is required."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label htmlFor="v-name">Name *</Label>
              <Input id="v-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="v-cat">Category</Label>
              <Input
                id="v-cat"
                placeholder="Materials, Equipment, Subcontractor…"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="v-contact">Contact name</Label>
              <Input id="v-contact" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="v-phone">Phone</Label>
                <Input id="v-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="v-email">Email</Label>
                <Input id="v-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="v-web">Website</Label>
              <Input id="v-web" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="v-addr">Address</Label>
              <Input id="v-addr" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="v-notes">Notes</Label>
              <Textarea id="v-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            {reviewQueue.length > 0 ? (
              <>
                <Button variant="ghost" onClick={skipReview}>Skip</Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? "Saving…" : reviewIndex + 1 < reviewQueue.length ? "Save & next" : "Save & finish"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkCategoryOpen} onOpenChange={setBulkCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set type for {selectedIds.size} vendor{selectedIds.size === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>Leave blank to clear the type.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="bulk-cat">Type / category</Label>
            <Input
              id="bulk-cat"
              list="bulk-cat-list"
              placeholder="Materials, Equipment, Subcontractor…"
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
            />
            <datalist id="bulk-cat-list">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkCategoryOpen(false)}>Cancel</Button>
            <Button onClick={bulkApplyCategory}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default Vendors;
