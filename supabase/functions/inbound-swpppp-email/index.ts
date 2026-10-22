import { errorMessage } from "../_shared/errorMessage.ts";
// Public webhook to receive forwarded SWPPP emails.
// Compatible with common inbound email providers (CloudMailin, Postmark, SendGrid Inbound Parse).
// It tries to extract a job number from the subject line and attaches the first PDF/image attachment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHARED_SECRET = Deno.env.get("SWPPPP_INBOUND_SECRET"); // optional; set to require ?secret=

interface Attachment {
  name: string;
  contentType?: string;
  contentBase64?: string; // base64 of file bytes
}

interface Parsed {
  subject: string;
  from: string;
  text?: string;
  html?: string;
  attachments: Attachment[];
}

function isoMondayOf(d: Date): string {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

function extractJobNumber(subject: string): string | null {
  // Match patterns like "Job 1234", "#1234", "[1234]", "job-1234", "1234-name"
  const patterns = [
    /\bjob[\s#:_-]*([0-9]{2,8})\b/i,
    /[#[]\s*([0-9]{2,8})\s*[\]]?/,
    /\b([0-9]{4,8})\b/,
  ];
  for (const p of patterns) {
    const m = subject.match(p);
    if (m) return m[1];
  }
  return null;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function parseRequest(req: Request): Promise<Parsed> {
  const ct = req.headers.get("content-type") || "";
  // CloudMailin / SendGrid Inbound Parse style: multipart/form-data
  if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
    const fd = await req.formData();
    const subject = String(fd.get("subject") || fd.get("headers[Subject]") || "");
    const from = String(fd.get("from") || fd.get("envelope[from]") || "");
    const text = String(fd.get("plain") || fd.get("text") || "");
    const html = String(fd.get("html") || "");
    const attachments: Attachment[] = [];
    for (const [k, v] of fd.entries()) {
      if (v instanceof File) {
        const buf = new Uint8Array(await v.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        attachments.push({ name: v.name || k, contentType: v.type, contentBase64: btoa(bin) });
      }
    }
    return { subject, from, text, html, attachments };
  }
  // JSON style: Postmark, custom
  const body = await req.json().catch(() => ({}));
  const subject: string = body.Subject || body.subject || body.headers?.Subject || "";
  const from: string = body.From || body.from || body.FromFull?.Email || "";
  const text: string = body.TextBody || body.text || body.plain || "";
  const html: string = body.HtmlBody || body.html || "";
  const rawAtt = body.Attachments || body.attachments || [];
  const attachments: Attachment[] = (rawAtt as { Name?: string; name?: string; filename?: string; ContentType?: string; contentType?: string; type?: string; Content?: string; content?: string; contentBase64?: string }[]).map((a) => ({
    name: a.Name || a.name || a.filename || "attachment",
    contentType: a.ContentType || a.contentType || a.type,
    contentBase64: a.Content || a.content || a.contentBase64,
  })).filter((a) => a.contentBase64);
  return { subject, from, text, html, attachments };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Mandatory shared-secret authentication. Reject if not configured or mismatched.
  if (!SHARED_SECRET) {
    console.error("SWPPPP_INBOUND_SECRET not configured");
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const provided = req.headers.get("x-webhook-secret")
    || new URL(req.url).searchParams.get("secret");
  if (provided !== SHARED_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const parsed = await parseRequest(req);
    if (!parsed.subject) {
      return new Response(JSON.stringify({ error: "Missing subject" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const jobNum = extractJobNumber(parsed.subject);
    if (!jobNum) {
      return new Response(JSON.stringify({ error: "Could not find job number in subject", subject: parsed.subject }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job, error: jobErr } = await supabase
      .from("jobs").select("id, name, job_number")
      .eq("job_number", jobNum).maybeSingle();
    if (jobErr) throw jobErr;
    if (!job) {
      return new Response(JSON.stringify({ error: `No job with number ${jobNum}` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const weekOf = isoMondayOf(new Date());
    let file_path: string | null = null;
    let file_name: string | null = null;
    let file_size: number | null = null;
    let mime_type: string | null = null;

    // Take the first PDF or image attachment, or fall back to the first attachment.
    const att = parsed.attachments.find((a) => /pdf|image\//i.test(a.contentType || "") || /\.pdf$/i.test(a.name))
      ?? parsed.attachments[0];
    if (att?.contentBase64) {
      const bytes = b64ToBytes(att.contentBase64);
      const safeName = (att.name || "report.pdf").replace(/[^\w.-]+/g, "_");
      const path = `${job.id}/${weekOf}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("swpppp-reports").upload(path, bytes, {
        contentType: att.contentType || "application/octet-stream",
      });
      if (upErr) throw upErr;
      file_path = path;
      file_name = safeName;
      file_size = bytes.byteLength;
      mime_type = att.contentType || null;
    }

    const { data: report, error: insErr } = await supabase.from("swpppp_reports").insert({
      job_id: job.id,
      week_of: weekOf,
      report_date: weekOf,
      title: parsed.subject.slice(0, 200),
      email_subject: parsed.subject,
      email_from: parsed.from,
      email_received_at: new Date().toISOString(),
      notes: parsed.text ? parsed.text.slice(0, 4000) : null,
      file_path, file_name, file_size, mime_type,
      source: "email",
      uploaded_by_name: parsed.from || "Email",
    }).select("id").single();
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ ok: true, report_id: report.id, job_id: job.id, job_number: jobNum }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("inbound-swpppp-email error", e);
    return new Response(JSON.stringify({ error: errorMessage(e, "Internal error") }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
