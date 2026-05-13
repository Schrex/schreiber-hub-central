// Auto-categorize an uploaded document (submittal, permit, swppp, estimate, contract)
// using Lovable AI. Returns suggested metadata so the client can prefill or save instantly.
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

type Kind = "submittal" | "permit" | "swppp" | "estimate" | "contract";

const SUBMITTAL_CATEGORIES = [
  "Concrete", "Rebar / Reinforcing Steel", "Asphalt", "Aggregate / Stone",
  "Pipe", "Precast Structures", "Castings (Frames & Grates)",
  "Erosion Control", "Geotextile", "Pavement Markings", "Signage",
  "Guide Rail", "Electrical", "Landscaping", "Other",
];

const PERMIT_TYPES = [
  "Building", "Right of Way", "Highway Work", "DOT",
  "Stormwater (SWPPP)", "Wetlands", "Demolition", "Electrical", "Other",
];

const schemaFor = (kind: Kind) => {
  if (kind === "submittal") {
    return {
      name: "categorize_submittal",
      description: "Classify a construction submittal document.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Concise, human title (e.g. 'Class A Concrete Mix Design')" },
          category: { type: "string", enum: SUBMITTAL_CATEGORIES },
          confidence: { type: "number", description: "0-1" },
        },
        required: ["title", "category", "confidence"],
        additionalProperties: false,
      },
    };
  }
  if (kind === "permit") {
    return {
      name: "categorize_permit",
      description: "Extract permit metadata.",
      parameters: {
        type: "object",
        properties: {
          permit_type: { type: "string", enum: PERMIT_TYPES },
          permit_number: { type: "string" },
          issuing_agency: { type: "string" },
          issue_date: { type: "string", description: "YYYY-MM-DD if known" },
          expiration_date: { type: "string", description: "YYYY-MM-DD if known" },
          confidence: { type: "number" },
        },
        required: ["permit_type", "confidence"],
        additionalProperties: false,
      },
    };
  }
  if (kind === "swppp") {
    return {
      name: "categorize_swppp",
      description: "Extract SWPPP weekly inspection report metadata.",
      parameters: {
        type: "object",
        properties: {
          week_of: { type: "string", description: "Monday of inspection week, YYYY-MM-DD" },
          title: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["confidence"],
        additionalProperties: false,
      },
    };
  }
  if (kind === "estimate") {
    return {
      name: "categorize_estimate",
      description: "Extract estimate metadata.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["title", "confidence"],
        additionalProperties: false,
      },
    };
  }
  return {
    name: "categorize_contract",
    description: "Extract contract title.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        confidence: { type: "number" },
      },
      required: ["title", "confidence"],
      additionalProperties: false,
    },
  };
};

const SYSTEM = (kind: Kind) => `You categorize construction documents for a heavy-civil contractor.
Document kind: ${kind}.
Look at the provided file (and the original filename) and call the function with the best fields.
Be concise. If unsure, set confidence below 0.6 and pick the closest category. Never invent permit numbers or dates.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { kind, bucket, path, fileName } = await req.json() as {
      kind: Kind; bucket: string; path: string; fileName?: string;
    };
    if (!kind || !bucket || !path) return json(400, { error: "kind, bucket, path required" });

    // Only allow categorization for buckets tied to a specific document kind.
    // This prevents using this endpoint as a service-role read proxy for
    // unrelated private buckets like onboarding-signed, shop-waivers, etc.
    const ALLOWED_BUCKETS_BY_KIND: Record<Kind, string[]> = {
      submittal: ["job-submittals"],
      permit: ["permits"],
      swppp: ["swpppp-reports"],
      estimate: ["job-estimates"],
      contract: ["job-contracts"],
    };
    const allowed = ALLOWED_BUCKETS_BY_KIND[kind] ?? [];
    if (!allowed.includes(bucket)) {
      return json(403, { error: "bucket not allowed for this kind" });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json(500, { error: "LOVABLE_API_KEY not configured" });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json(401, { error: "unauthorized" });

    // Verify the caller can actually read this object under their own RLS
    // before falling back to the service role to fetch the bytes for the AI.
    const { error: probeErr } = await userClient.storage.from(bucket).download(path);
    if (probeErr) return json(403, { error: "no access to file" });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(path);
    if (dlErr || !blob) return json(500, { error: dlErr?.message ?? "download failed" });

    // Cap at ~8MB to keep AI calls fast/cheap
    if (blob.size > 8 * 1024 * 1024) {
      return json(200, { skipped: true, reason: "file too large for fast categorization" });
    }

    const buf = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    const base64 = btoa(binary);
    const lower = (fileName || path).toLowerCase();
    const isPdf = lower.endsWith(".pdf") || blob.type === "application/pdf";
    const isImage = (blob.type || "").startsWith("image/") ||
      /\.(png|jpe?g|webp|gif|heic)$/.test(lower);
    if (!isPdf && !isImage) {
      return json(200, { skipped: true, reason: "unsupported file type for vision" });
    }
    const mime = isPdf ? "application/pdf" : (blob.type || "image/jpeg");

    const tool = schemaFor(kind);
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM(kind) },
          {
            role: "user",
            content: [
              { type: "text", text: `Filename: ${fileName ?? path}\nClassify this document.` },
              { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
            ],
          },
        ],
        tools: [{ type: "function", function: tool }],
        tool_choice: { type: "function", function: { name: tool.name } },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      if (aiResp.status === 429) return json(429, { error: "Rate limit, try again shortly" });
      if (aiResp.status === 402) return json(402, { error: "AI credits exhausted" });
      return json(500, { error: `AI error: ${txt.slice(0, 400)}` });
    }
    const aiData = await aiResp.json();
    const call = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return json(200, { skipped: true, reason: "no tool call" });
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(call.function.arguments || "{}"); } catch { args = {}; }

    return json(200, { ok: true, kind, fields: args });
  } catch (err) {
    return json(500, { error: (err as Error)?.message ?? "unknown error" });
  }
});
