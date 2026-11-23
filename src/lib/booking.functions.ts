import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DAYS_AHEAD, SLOT_MINUTES, freeSlots } from "./booking-rules";

export const listFreeSlots = createServerFn({ method: "GET" }).handler(async () => {
  const { busyRanges } = await import("./calendar.server");
  const now = Date.now();
  const busy = await busyRanges(new Date(now).toISOString(), new Date(now + (DAYS_AHEAD + 1) * 86400000).toISOString());
  return { slots: freeSlots(now, busy).map((s) => new Date(s).toISOString()) };
});

const bookSchema = z.object({
  start: z.string().datetime(),
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(30).optional(),
});

export const bookSlot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => bookSchema.parse(input))
  .handler(async ({ data }) => {
    const { busyRanges, gcal } = await import("./calendar.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const start = Date.parse(data.start);
    const end = start + SLOT_MINUTES * 60000;
    const now = Date.now();
    const busy = await busyRanges(new Date(now).toISOString(), new Date(now + (DAYS_AHEAD + 1) * 86400000).toISOString());
    if (!freeSlots(now, busy).includes(start)) return { ok: false as const, error: "Esse horário acabou de ser ocupado. Escolha outro." };

    const { data: row, error } = await supabaseAdmin
      .from("appointments")
      .insert({ name: data.name, email: data.email, phone: data.phone || null, starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString() })
      .select("id")
      .single();
    if (error || !row) return { ok: false as const, error: "Esse horário acabou de ser ocupado. Escolha outro." };

    try {
      const ev = await gcal<any>("/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all", {
        method: "POST",
        body: {
          summary: `Consulta — ${data.name}`,
          description: `Consulta farmacêutica com Dr. Pedro Trentini.${data.phone ? `\nTelefone: ${data.phone}` : ""}`,
          start: { dateTime: new Date(start).toISOString(), timeZone: "America/Sao_Paulo" },
          end: { dateTime: new Date(end).toISOString(), timeZone: "America/Sao_Paulo" },
          attendees: [{ email: data.email, displayName: data.name }],
          conferenceData: { createRequest: { requestId: row.id, conferenceSolutionKey: { type: "hangoutsMeet" } } },
        },
      });
      const meetUrl: string | null = ev.hangoutLink ?? ev.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === "video")?.uri ?? null;
      await supabaseAdmin.from("appointments").update({ google_event_id: ev.id, meet_url: meetUrl }).eq("id", row.id);
      return { ok: true as const, start: new Date(start).toISOString(), meetUrl };
    } catch (e) {
      console.error(e);
      await supabaseAdmin.from("appointments").delete().eq("id", row.id);
      return { ok: false as const, error: "Não conseguimos concluir o agendamento agora. Tente novamente em instantes." };
    }
  });
