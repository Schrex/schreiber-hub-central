import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Check, AlertCircle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const UnsubscribePage = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"loading" | "valid" | "already" | "invalid" | "done" | "error">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const data = await res.json();
        if (data.valid) setState("valid");
        else if (data.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  const confirm = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
    setBusy(false);
    if (error) setState("error");
    else if (data?.success) setState("done");
    else if (data?.reason === "already_unsubscribed") setState("already");
    else setState("error");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center">
        {state === "loading" && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking link…
          </div>
        )}
        {state === "valid" && (
          <>
            <h1 className="font-display text-2xl uppercase tracking-wide">Unsubscribe</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Click below to stop receiving emails from Schreiber Hub at this address.
            </p>
            <Button className="mt-4 w-full" onClick={confirm} disabled={busy}>
              {busy ? "Working…" : "Confirm unsubscribe"}
            </Button>
          </>
        )}
        {state === "done" && (
          <div>
            <Check className="mx-auto h-8 w-8 text-emerald-500" />
            <h1 className="mt-2 font-display text-xl uppercase tracking-wide">Unsubscribed</h1>
            <p className="mt-2 text-sm text-muted-foreground">You will no longer receive these emails.</p>
          </div>
        )}
        {state === "already" && (
          <div>
            <Check className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">This address is already unsubscribed.</p>
          </div>
        )}
        {(state === "invalid" || state === "error") && (
          <div>
            <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm text-muted-foreground">
              {state === "invalid" ? "Invalid or expired link." : "Something went wrong. Please try again later."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnsubscribePage;
