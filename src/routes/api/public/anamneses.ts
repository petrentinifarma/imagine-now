import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Private read-only feed for an external integration (Zapier, n8n, CRM).
// Callers must send `Authorization: Bearer <INTEGRATION_API_TOKEN>`.
const querySchema = z.object({
  since: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) {
    diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  }
  return diff === 0;
}

export const Route = createFileRoute("/api/public/anamneses")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const expected = process.env["INTEGRATION_API_TOKEN"];
        if (!expected || expected.length < 24) {
          return Response.json({ error: "not_configured" }, { status: 503 });
        }
        const header = request.headers.get("authorization") ?? "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : "";
        if (!token || !safeEqual(token, expected)) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) {
          return Response.json({ error: "invalid_query" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let query = supabaseAdmin
          .from("health_intakes")
          .select(
            "id, created_at, patient_name, age, weight_kg, profession, phone, main_complaint, complaint_details, complaint_score, health_average, improvement_answers",
          )
          .order("created_at", { ascending: true })
          .limit(parsed.data.limit);
        if (parsed.data.since) query = query.gt("created_at", parsed.data.since);

        const { data, error } = await query;
        if (error) {
          console.error("Integration feed failed", error);
          return Response.json({ error: "unavailable" }, { status: 500 });
        }
        return Response.json(
          { data },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
