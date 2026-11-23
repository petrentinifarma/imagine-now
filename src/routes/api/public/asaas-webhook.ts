import { createFileRoute } from "@tanstack/react-router";

function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["ASAAS_CONNECTION_WEBHOOK_TOKEN"];
        const token = request.headers.get("asaas-access-token") ?? "";
        if (!expected || !token || !safeEqual(token, expected)) return new Response("unauthorized", { status: 401 });

        const body = (await request.json().catch(() => null)) as { id?: string; event?: string; payment?: { id?: string } } | null;
        if (!body?.id || !body.event?.startsWith("PAYMENT_") || !body.payment?.id) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: seen } = await supabaseAdmin.from("asaas_events").select("id").eq("id", body.id).maybeSingle();
        if (seen) return new Response("ok");
        try {
          const { confirmPayment } = await import("@/lib/asaas.server");
          await confirmPayment(body.payment.id);
          await supabaseAdmin.from("asaas_events").insert({ id: body.id });
          return new Response("ok");
        } catch (e) {
          console.error("asaas webhook failed", e);
          return new Response("retry", { status: 500 });
        }
      },
    },
  },
});
