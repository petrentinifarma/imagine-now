import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Video } from "lucide-react";
import { SectionLabel, SiteShell } from "@/components/site/site-shell";
import { bookSlot, listFreeSlots } from "@/lib/booking.functions";

export const Route = createFileRoute("/agendar")({
  head: () => ({
    meta: [
      { title: "Agende sua consulta | Dr. Pedro Trentini" },
      { name: "description", content: "Escolha um horário livre para sua consulta online com o farmacêutico clínico Dr. Pedro Trentini, pelo Google Meet." },
      { property: "og:title", content: "Agende sua consulta | Dr. Pedro Trentini" },
      { property: "og:description", content: "Horários livres para consulta online pelo Google Meet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Agendar,
});

const TZ = "America/Sao_Paulo";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "2-digit", month: "long" });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

function Agendar() {
  const fetchSlots = useServerFn(listFreeSlots);
  const book = useServerFn(bookSlot);
  const slotsQuery = useQuery(queryOptions({ queryKey: ["free-slots"], queryFn: () => fetchSlots() }));
  const [chosen, setChosen] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ start: string; meetUrl: string | null } | null>(null);

  const days = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of slotsQuery.data?.slots ?? []) {
      const k = dayKey(s);
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return [...map.entries()];
  }, [slotsQuery.data]);
  const [day, setDay] = useState<string | null>(null);
  const activeDay = day ?? days[0]?.[0] ?? null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chosen) return;
    setError("");
    if (form.name.trim().length < 3) return setError("Digite seu nome completo.");
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError("Confira seu e-mail: o convite chega nele.");
    setBusy(true);
    try {
      const r = await book({ data: { start: chosen, ...form } });
      if (r.ok) setDone({ start: r.start, meetUrl: r.meetUrl });
      else { setError(r.error); setChosen(null); void slotsQuery.refetch(); }
    } catch {
      setError("Não conseguimos concluir o agendamento agora. Tente novamente em instantes.");
    }
    setBusy(false);
  };

  const field = "mt-2 h-14 w-full rounded-xl border-2 border-stone-strong bg-card px-4 text-lg outline-none focus:border-primary";

  if (done) {
    return (
      <SiteShell>
        <section className="mx-auto max-w-xl px-5 pt-10">
          <div className="rounded-3xl bg-card p-7 text-center shadow-app">
            <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
            <SectionLabel>Consulta agendada</SectionLabel>
            <h1 className="mt-2 font-display text-3xl capitalize text-primary">{dayKey(done.start)}</h1>
            <p className="mt-1 text-2xl font-semibold text-ink">às {timeOf(done.start)} (horário de Brasília)</p>
            <p className="mt-4 text-lg text-muted-foreground">O convite foi enviado para <strong className="text-ink">{form.email}</strong>. Na hora marcada, é só entrar pelo link do Google Meet.</p>
            {done.meetUrl && (
              <a href={done.meetUrl} target="_blank" rel="noreferrer" className="mt-6 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-xl font-semibold text-primary-foreground">
                <Video className="h-6 w-6" /> Link do Google Meet
              </a>
            )}
          </div>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <section className="mx-auto max-w-3xl px-5 pt-10">
        <SectionLabel>Agendamento</SectionLabel>
        <h1 className="mt-3 font-display text-4xl leading-tight text-primary">Escolha o melhor horário para você.</h1>
        <p className="mt-3 text-lg text-muted-foreground">Consulta online de 1 hora pelo Google Meet. Horários de Brasília.</p>

        {slotsQuery.isLoading && <div className="flex justify-center py-16"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}
        {slotsQuery.isError && <p className="mt-8 text-lg font-semibold text-destructive">Não conseguimos carregar a agenda agora. Tente de novo em instantes.</p>}
        {slotsQuery.data && days.length === 0 && <p className="mt-8 text-lg">Não há horários livres nas próximas duas semanas. Fale com o Dr. Pedro pelo WhatsApp.</p>}

        {days.length > 0 && (
          <>
            <div className="-mx-5 mt-6 flex gap-3 overflow-x-auto px-5 pb-2">
              {days.map(([k]) => (
                <button key={k} type="button" onClick={() => { setDay(k); setChosen(null); }}
                  className={`shrink-0 rounded-2xl px-5 py-3 text-base font-semibold capitalize transition ${k === activeDay ? "bg-primary text-primary-foreground" : "bg-card text-primary shadow-app"}`}>
                  {k.replace(/-feira/, "")}
                </button>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {(days.find(([k]) => k === activeDay)?.[1] ?? []).map((s) => (
                <button key={s} type="button" aria-pressed={chosen === s} onClick={() => setChosen(s)}
                  className={`h-14 rounded-xl text-lg font-semibold transition ${chosen === s ? "bg-accent text-accent-foreground ring-2 ring-primary" : "bg-card text-ink shadow-app"}`}>
                  {timeOf(s)}
                </button>
              ))}
            </div>
          </>
        )}

        {chosen && (
          <form onSubmit={submit} className="mt-8 rounded-3xl bg-card p-6 shadow-app">
            <p className="text-lg font-semibold capitalize text-primary">{dayKey(chosen)} · {timeOf(chosen)}</p>
            <label className="mt-4 block text-base font-semibold">Nome completo<input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" /></label>
            <label className="mt-4 block text-base font-semibold">E-mail (o convite chega aqui)<input type="email" className={field} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></label>
            <label className="mt-4 block text-base font-semibold">WhatsApp (opcional)<input inputMode="tel" className={field} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" /></label>
            {error && <p role="alert" className="mt-4 text-base font-semibold text-destructive">{error}</p>}
            <button type="submit" disabled={busy} className="mt-6 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-xl font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null} Confirmar agendamento
            </button>
          </form>
        )}
        {!chosen && error && <p role="alert" className="mt-6 text-base font-semibold text-destructive">{error}</p>}
      </section>
    </SiteShell>
  );
}
