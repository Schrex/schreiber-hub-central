import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface PositionRow {
  id: string;
  title: string;
  min_pay_rate: number;
  max_pay_rate: number;
  is_active: boolean;
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const schema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(100),
  last_name: z.string().trim().min(1, "Last name is required").max(100),
  middle_initial: z.string().trim().max(1, "Middle initial must be a single letter").optional().or(z.literal("")),
  email: z.string().trim().max(255).email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  department: z.string().trim().max(100).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  date_of_birth: z.string().trim().optional().or(z.literal("")),
  hire_date: z.string().trim().optional().or(z.literal("")),
});

const emptyForm = {
  first_name: "",
  last_name: "",
  middle_initial: "",
  email: "",
  phone: "",
  address: "",
  department: "",
  notes: "",
  date_of_birth: "",
  hire_date: "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whether the current user can create logins + assign positions (admin only) */
  canCreateLogin: boolean;
  onCreated: () => void;
}

export function AddEmployeeWizard({ open, onOpenChange, canCreateLogin, onCreated }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [createLogin, setCreateLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"employee" | "foreman" | "office" | "admin">("employee");
  const [assignPosition, setAssignPosition] = useState(false);
  const [positionId, setPositionId] = useState("");
  const [payRate, setPayRate] = useState("");
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Reset whenever opened
    setForm(emptyForm);
    setCreateLogin(false);
    setLoginEmail("");
    setPassword("");
    setRole("employee");
    setAssignPosition(false);
    setPositionId("");
    setPayRate("");
    if (canCreateLogin) {
      supabase
        .from("positions")
        .select("id, title, min_pay_rate, max_pay_rate, is_active")
        .eq("is_active", true)
        .order("sort_order")
        .order("title")
        .then(({ data }) => setPositions((data ?? []) as PositionRow[]));
    }
  }, [open, canCreateLogin]);

  // Mirror contact email into login email until user manually changes it
  useEffect(() => {
    if (createLogin && !loginEmail && form.email) setLoginEmail(form.email);
  }, [createLogin, form.email, loginEmail]);

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Check the form", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (createLogin) {
      if (!loginEmail.trim()) {
        toast({ title: "Login email required", variant: "destructive" });
        return;
      }
      if (password.length < 8) {
        toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
        return;
      }
    }
    if (assignPosition) {
      if (!createLogin) {
        toast({ title: "Position requires a login", description: "Enable 'Create app login' first.", variant: "destructive" });
        return;
      }
      if (!positionId) {
        toast({ title: "Choose a position", variant: "destructive" });
        return;
      }
      const r = parseFloat(payRate);
      if (isNaN(r) || r < 0) {
        toast({ title: "Enter a valid pay rate", variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    const fullName = [parsed.data.first_name, parsed.data.last_name].filter(Boolean).join(" ").trim();
    const payload: Record<string, unknown> = {
      name: fullName,
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      middle_initial: parsed.data.middle_initial ? parsed.data.middle_initial.toUpperCase() : null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      department: parsed.data.department || null,
      notes: parsed.data.notes || null,
      date_of_birth: parsed.data.date_of_birth || null,
      hire_date: parsed.data.hire_date || null,
    };
    if (createLogin) {
      payload.createLogin = true;
      payload.loginEmail = loginEmail.trim();
      payload.password = password;
      payload.role = role;
    }
    if (assignPosition) {
      payload.positionId = positionId;
      payload.payRate = parseFloat(payRate);
    }

    const { data, error } = await supabase.functions.invoke("create-employee", { body: payload });
    setSaving(false);

    const errMsg = (data as { error?: string } | null)?.error ?? error?.message;
    if (errMsg) {
      toast({ title: "Couldn't create employee", description: errMsg, variant: "destructive" });
      return;
    }
    const warning = (data as { warning?: string } | null)?.warning;
    toast({
      title: "Employee created",
      description: warning ?? (createLogin ? "Login is ready." : "Contact added."),
      variant: warning ? "destructive" : undefined,
    });
    onOpenChange(false);
    onCreated();
  };

  const selectedPos = positions.find((p) => p.id === positionId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
          <DialogDescription>
            One form for everything: contact info, optional app login, and starting position.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Identity */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identity</h3>
            <div className="grid grid-cols-[1fr_70px_1fr] gap-2">
              <div>
                <Label htmlFor="ae-first">First name *</Label>
                <Input
                  id="ae-first"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="ae-mi">M.I.</Label>
                <Input
                  id="ae-mi"
                  maxLength={1}
                  value={form.middle_initial}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      middle_initial: e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase(),
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="ae-last">Last name *</Label>
                <Input
                  id="ae-last"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="ae-phone">Phone</Label>
                <Input id="ae-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ae-email">Email</Label>
                <Input id="ae-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="ae-addr">Address</Label>
              <Input id="ae-addr" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="ae-dept">Department</Label>
              <Input id="ae-dept" placeholder="Field, Office…" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="ae-notes">Notes</Label>
              <Textarea id="ae-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </section>

          {/* Login */}
          {canCreateLogin && (
            <section className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">App login</h3>
                  <p className="text-[11px] text-muted-foreground">Create an account so this person can sign in.</p>
                </div>
                <Switch checked={createLogin} onCheckedChange={setCreateLogin} />
              </div>
              {createLogin && (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="ae-login-email">Login email *</Label>
                    <Input id="ae-login-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="ae-pwd">Default password *</Label>
                    <Input id="ae-pwd" type="text" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <p className="mt-1 text-[11px] text-muted-foreground">Share this with the employee — they should change it on first sign-in.</p>
                  </div>
                  <div>
                    <Label htmlFor="ae-role">Role</Label>
                    <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                      <SelectTrigger id="ae-role"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="foreman">Foreman</SelectItem>
                        <SelectItem value="office">Office</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Position */}
          {canCreateLogin && (
            <section className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Starting position & pay</h3>
                  <p className="text-[11px] text-muted-foreground">Assign their job title and hourly rate. Requires a login.</p>
                </div>
                <Switch checked={assignPosition} onCheckedChange={setAssignPosition} disabled={!createLogin} />
              </div>
              {assignPosition && createLogin && (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="ae-pos">Position *</Label>
                    <Select
                      value={positionId}
                      onValueChange={(v) => {
                        setPositionId(v);
                        const p = positions.find((x) => x.id === v);
                        if (p && !payRate) setPayRate(String(p.min_pay_rate));
                      }}
                    >
                      <SelectTrigger id="ae-pos"><SelectValue placeholder="Select position" /></SelectTrigger>
                      <SelectContent>
                        {positions.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.title} ({fmtMoney(p.min_pay_rate)}–{fmtMoney(p.max_pay_rate)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="ae-rate">Pay rate ($/hr) *</Label>
                    <Input id="ae-rate" type="number" step="0.01" value={payRate} onChange={(e) => setPayRate(e.target.value)} />
                    {selectedPos && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Range: {fmtMoney(selectedPos.min_pay_rate)} – {fmtMoney(selectedPos.max_pay_rate)}/hr
                      </p>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create employee"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
