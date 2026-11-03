import { errorMessage } from "../_shared/errorMessage.ts";
// Extract a foreman-facing briefing from an uploaded job contract using the configured AI provider (see _shared/ai.ts).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { AI_NOT_CONFIGURED, aiChatCompletion, aiSettings } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { jobId, save = true } = await req.json();
    if (!jobId) return json(400, { error: "jobId required" });

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const ai = aiSettings();
    if (!ai) return json(503, { error: AI_NOT_CONFIGURED });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json(401, { error: "unauthorized" });

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: roles } = await admin
      .from("user_roles").select("role").eq("user_id", userData.user.id);
    const roleSet = new Set((roles ?? []).map((r: { role: string }) => r.role));
    if (!(roleSet.has("office") || roleSet.has("admin"))) return json(403, { error: "forbidden" });

    const { data: job, error: jobErr } = await admin
      .from("jobs")
      .select("id, contract_file_path, contract_file_name")
      .eq("id", jobId)
      .maybeSingle();
    if (jobErr) return json(500, { error: jobErr.message });
    if (!job?.contract_file_path) return json(400, { error: "No contract uploaded" });

    const { data: blob, error: dlErr } = await admin.storage
      .from("job-contracts")
      .download(job.contract_file_path);
    if (dlErr || !blob) return json(500, { error: dlErr?.message ?? "download failed" });

    const buf = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    const mime = (job.contract_file_name?.toLowerCase().endsWith(".pdf") ? "application/pdf" : (blob.type || "application/pdf"));

    const aiResp = await aiChatCompletion(ai, {
      messages: [
        {
          role: "system",
          content:
            "You are preparing a concise field briefing for the foreman running this job. Read the contract and pull out ONLY what the foreman needs on site. INCLUDE: special requirements, site rules, hours of work, access/staging restrictions, safety/PPE requirements, inspections & notifications required, schedule milestones & deadlines, GC/owner contacts, materials specified, exclusions that matter on site, liquidated damages or penalties tied to the foreman's actions. EXCLUDE: contract value, line-item pricing, bid totals, payment terms, insurance limits, indemnification, legal boilerplate, signatures. Format as short markdown sections with bolded headings and bullet points. Be terse — this is read on a phone in the field.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Produce the foreman briefing from this contract." },
            { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
          ],
        },
      ],
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      if (aiResp.status === 429) return json(429, { error: "Rate limit, try again shortly" });
      if (aiResp.status === 402) return json(402, { error: "AI credits exhausted" });
      return json(500, { error: `AI error: ${txt.slice(0, 500)}` });
    }

    const aiData = await aiResp.json();
    const brief = String(aiData?.choices?.[0]?.message?.content ?? "").trim();
    if (!brief) return json(500, { error: "Empty briefing" });

    if (save) {
      const { error: upErr } = await admin.from("jobs").update({ foreman_brief: brief }).eq("id", jobId);
      if (upErr) return json(500, { error: upErr.message });
    }

    return json(200, { brief });
  } catch (err: unknown) {
    return json(500, { error: errorMessage(err, "unknown error") });
  }
});
