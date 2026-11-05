import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/access";
import { todayInNewYork } from "@/lib/jobs";
import { lookaheadUploadPayload, parseMspdi, type ParsedLookahead } from "@/lib/mspdiLookahead";
import { Button } from "@/components/ui/button";
import { LookaheadWeeks } from "@/components/jobs/lookahead/LookaheadWeeks";

export function LookaheadUpload({
  jobId,
  onPublished,
}: {
  jobId: string;
  onPublished: () => void;
}) {
  const { can } = useAccess();
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedLookahead | null>(null);
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);
  const allowed = can("lookahead.upload");

  if (!allowed) return null;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast.error("Choose a Microsoft Project XML file (.xml).");
      return;
    }
    if (file.size > 2_000_000) {
      toast.error("That file is too large.");
      return;
    }
    try {
      const xml = await file.text();
      const next = parseMspdi(xml, todayInNewYork());
      setParsed(next);
      setFilename(file.name);
    } catch (error) {
      setParsed(null);
      toast.error(error instanceof Error ? error.message : "Couldn't read that file.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const publish = async () => {
    if (!parsed) return;
    setBusy(true);
    const { error } = await supabase.rpc("publish_lookahead_upload", {
      p_job_id: jobId,
      p_payload: lookaheadUploadPayload(parsed, filename),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Couldn't publish the look-ahead.");
      return;
    }
    setParsed(null);
    toast.success("Look-ahead published.");
    onPublished();
  };

  const holidayMap = new Map((parsed?.holidays ?? []).map((holiday) => [holiday.date, holiday.label]));

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Upload look-ahead
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Microsoft Project XML export. Publishing replaces the live grid.
          </p>
        </div>
        <Button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
          Upload look-ahead
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xml,text/xml,application/xml"
          className="sr-only"
          aria-label="Look-ahead XML file"
          onChange={(event) => void onFile(event.target.files?.[0])}
        />
      </div>

      {parsed && (
        <div className="space-y-3" data-testid="lookahead-preview">
          <p className="text-sm">
            {parsed.rows.length} task{parsed.rows.length === 1 ? "" : "s"}
            {parsed.skippedPlaceholders.length > 0 ? `, ${parsed.skippedPlaceholders.length} placeholders skipped` : ""}
            {parsed.holidays.length > 0 ? `, ${parsed.holidays.length} holiday${parsed.holidays.length === 1 ? "" : "s"}` : ""}
            .
          </p>
          {parsed.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing in this week or the next 3 weeks.</p>
          ) : (
            <LookaheadWeeks
              tasks={parsed.rows.map((row) => ({
                id: String(row.mppUniqueId ?? row.sortOrder),
                name: row.name,
                groupName: row.groupName,
                contractorName: row.contractorName,
                days: row.days,
              }))}
              holidays={holidayMap}
            />
          )}
          <div className="flex gap-2">
            <Button type="button" onClick={() => void publish()} disabled={busy || parsed.rows.length === 0}>
              {busy ? "Publishing…" : "Publish"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setParsed(null)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
