import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PasswordRecovery({ update = false }: { update?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [code, setCode] = useState("");
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const settingPassword = update || ready;
  useEffect(() => {
    if (!update) return;
    let active = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has("error") || new URLSearchParams(window.location.search).has("error")) {
      setError("This reset link is invalid or expired. Request a new link.");
      return;
    }
    // The SDK processes the recovery URL before getUser resolves. Never log tokens.
    supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active) return;
      setReady(!authError && Boolean(data.user));
      if (authError || !data.user) setError("Open the link in your reset email, or request a new link.");
    }).catch(() => {
      if (active) setError("Unable to verify your session. Request a new link.");
    });
    return () => { active = false; };
  }, [update]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (settingPassword && (!ready || password.length < 12 || password !== repeat)) {
      setError("Use matching passwords of at least 12 characters and a valid session.");
      return;
    }
    setBusy(true);
    try {
      if (settingPassword) {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setPassword(""); setRepeat("");
        setDone(true);
      } else if (requested) {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          email: email.trim(), token: code.trim(), type: "recovery",
        });
        if (verifyError || !data.session) throw new Error("Invalid recovery code");
        setCode(""); setReady(true);
      } else {
        const { error: sendError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (sendError) throw sendError;
        setRequested(true);
      }
    } catch {
      setError(settingPassword ? "Password could not be updated. Check the password requirements or request a new link." : requested ? "Code is invalid or expired. Check the newest email or request a new code." : "Unable to request a reset email. Please try again later.");
    } finally { setBusy(false); }
  }
  return <main className="min-h-screen flex items-center justify-center bg-background p-6">
    <section className="w-full max-w-sm space-y-5">
      <h1 className="text-2xl font-semibold">{settingPassword ? "Set your password" : "Reset your password"}</h1>
      {import.meta.env.VITE_REHEARSAL_BACKEND === "true" && <p>Schreiber Hub Rehearsal — this affects your rehearsal account only.</p>}
      {requested && !ready && <p role="status">If an account exists for this email, you will receive a recovery code. Enter it below.</p>}
      {done ? <p role="status">Password updated. You can continue to the app.</p> : <form onSubmit={submit} className="space-y-4">
        {settingPassword ? <>
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} disabled={!ready || busy} />
          <Label htmlFor="repeat-password">Repeat password</Label>
          <Input id="repeat-password" type="password" autoComplete="new-password" minLength={12} required value={repeat} onChange={e => setRepeat(e.target.value)} disabled={!ready || busy} />
        </> : requested ? <><Label htmlFor="recovery-code">Recovery code</Label><Input id="recovery-code" autoComplete="one-time-code" inputMode="numeric" required value={code} onChange={e => setCode(e.target.value)} disabled={busy} /></> : <><Label htmlFor="recovery-email">Email</Label><Input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></>}
        <Button type="submit" disabled={busy || (settingPassword && !ready)}>{busy ? "Please wait…" : settingPassword ? "Update password" : requested ? "Verify code" : "Send reset email"}</Button>
      </form>}
      {error && <p role="alert">{error}</p>}
      {requested && !ready && <Button variant="link" onClick={() => { setRequested(false); setCode(""); setError(""); }}>Request a new code</Button>}
      {update && !done && <Link className="block underline" to="/forgot-password">Request a new reset link</Link>}
      <Link className="block underline" to={settingPassword && done ? "/" : "/auth"}>{settingPassword && done ? "Continue to app" : "Back to sign in"}</Link>
    </section>
  </main>;
}
