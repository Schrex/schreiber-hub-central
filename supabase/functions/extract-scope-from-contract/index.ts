// Extract scope-of-work bullet items from an uploaded job contract using Lovable AI.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
    const { jobId, replace = false } = await req.json();
    if (!jobId) return json(400, { error: "jobId required" });

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json(500, { error: "LOVABLE_API_KEY not configured" });

    // Verify caller has access
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json(401, { error: "unauthorized" });

    const admin = createClient(supabaseUrl, serviceKey);

    // Only office/admin may read contracts and write job scope. Replace requires admin.
    const { data: roles } = await admin
      .from("user_roles").select("role").eq("user_id", userData.user.id);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isOffice = roleSet.has("office") || roleSet.has("admin");
    const isAdmin = roleSet.has("admin");
    if (!isOffice) return json(403, { error: "forbidden" });
    if (replace && !isAdmin) return json(403, { error: "replace requires admin" });

    const { data: job, error: jobErr } = await admin
      .from("jobs")
      .select("id, contract_file_path, contract_file_name")
      .eq("id", jobId)
      .maybeSingle();
    if (jobErr) return json(500, { error: jobErr.message });
    if (!job?.contract_file_path) return json(400, { error: "No contract uploaded" });

    // Download the contract
    const { data: blob, error: dlErr } = await admin.storage
      .from("job-contracts")
      .download(job.contract_file_path);
    if (dlErr || !blob) return json(500, { error: dlErr?.message ?? "download failed" });

    const buf = new Uint8Array(await blob.arrayBuffer());
    // Base64 encode
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    const mime = (job.contract_file_name?.toLowerCase().endsWith(".pdf") ? "application/pdf" : (blob.type || "application/pdf"));

    // Ask Lovable AI to extract scope items
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You extract the scope of work from construction contracts. Return ONLY a JSON object with a single key 'items' that is an array of concise scope bullet strings (each one a single deliverable or work item, no numbering, no leading dashes). Skip pricing, terms, signatures, and boilerplate.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract every scope-of-work item from this contract." },
              { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      if (aiResp.status === 429) return json(429, { error: "Rate limit, try again shortly" });
      if (aiResp.status === 402) return json(402, { error: "AI credits exhausted" });
      return json(500, { error: `AI error: ${txt.slice(0, 500)}` });
    }

    const aiData = await aiResp.json();
    const content = aiData?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { items?: string[] } = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    const items = (parsed.items ?? []).map((s) => String(s).trim()).filter(Boolean);

    if (!items.length) return json(200, { inserted: 0, items: [] });

    // Optionally clear existing
    if (replace) {
      await admin.from("job_scope_items").delete().eq("job_id", jobId);
    }
    const { data: existing } = await admin
      .from("job_scope_items")
      .select("sort_order")
      .eq("job_id", jobId)
      .order("sort_order", { ascending: false })
      .limit(1);
    let next = existing && existing[0] ? existing[0].sort_order + 1 : 0;

    const rows = items.map((body) => ({ job_id: jobId, body, sort_order: next++ }));
    const { error: insErr } = await admin.from("job_scope_items").insert(rows);
    if (insErr) return json(500, { error: insErr.message });

    return json(200, { inserted: rows.length, items });
  } catch (err: any) {
    return json(500, { error: err?.message ?? "unknown error" });
  }
});
