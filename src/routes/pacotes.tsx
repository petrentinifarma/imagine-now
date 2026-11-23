import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, Smartphone } from "lucide-react";
import { SectionLabel, SiteShell } from "@/components/site/site-shell";

export const Route = createFileRoute("/pacotes")({
  head: () => ({
    meta: [
      { title: "Escolha seu tratamento | Dr. Pedro Trentini" },
      { name: "description", content: "Compare os três pacotes de acompanhamento farmacêutico do Dr. Pedro Trentini e escolha o ideal para você." },
      { property: "og:title", content: "Escolha seu tratamento | Dr. Pedro Trentini" },
      { property: "og:description", content: "Três opções de cuidado personalizado, com retornos e acompanhamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pacotes,
});

const plans = [
  { id: "essencial", name: "Saúde em Dia", tag: "Essencial", items: ["Consulta inicial completa", "Plano personalizado", "1 retorno"], price: "R$ —" },
  { id: "alta", name: "Saúde em Alta", tag: "Mais escolhido", items: ["Consulta inicial completa", "Plano personalizado", "Retornos mensais", "Ajustes no tratamento"], price: "R$ —" },
  { id: "longevidade", name: "Longevidade", tag: "Integral", items: ["Consulta inicial completa", "Plano personalizado", "Retornos frequentes", "Acompanhamento próximo"], price: "R$ —" },
];

function Pacotes() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl px-5 pt-10">
        <SectionLabel>Parabéns</SectionLabel>
        <h1 className="mt-3 font-display text-4xl leading-tight text-primary">Você decidiu se cuidar.</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Agora precisamos definir só alguns detalhes. Dos três pacotes que oferecemos, qual se encaixa melhor na sua necessidade de tratamento neste momento? Atente para a frequência dos retornos.
        </p>
      </section>

      <section className="mx-auto mt-8 grid max-w-5xl gap-5 px-5 md:grid-cols-3">
        {plans.map((p) => {
          const on = selected === p.id;
          return (
            <div key={p.id} className={`flex flex-col rounded-3xl bg-card p-6 shadow-app ring-2 transition ${on ? "ring-primary" : "ring-transparent"}`}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">{p.tag}</p>
              <h2 className="mt-1 font-display text-2xl text-primary">{p.name}</h2>
              <button
                type="button"
                onClick={() => setSelected(p.id)}
                aria-pressed={on}
                className={`mt-4 flex h-14 items-center justify-center gap-2 rounded-xl text-lg font-semibold transition ${on ? "bg-primary text-primary-foreground" : "bg-stone text-primary hover:bg-stone-strong"}`}
              >
                {on ? <><Check className="h-5 w-5" /> Selecionado</> : "Selecionar este"}
              </button>
              <ul className="mt-5 flex-1 space-y-2 text-base">
                {p.items.map((i) => (
                  <li key={i} className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-accent" />{i}</li>
                ))}
              </ul>
              <p className="mt-6 border-t border-stone-strong pt-4 text-sm text-muted-foreground">Investimento <span className="block font-display text-2xl text-ink">{p.price}</span></p>
            </div>
          );
        })}
      </section>

      <div className="sticky bottom-0 z-20 mt-8 border-t border-stone-strong bg-stone/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            disabled={!selected}
            onClick={() => alert("O pagamento será conectado em breve.")}
            className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-xl font-semibold text-primary-foreground disabled:opacity-40"
          >
            Continuar para o pagamento <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <section className="mx-auto mt-12 max-w-5xl px-5">
        <div className="rounded-3xl border-2 border-accent bg-card p-6 sm:p-10">
          <SectionLabel>Ajuda para decidir</SectionLabel>
          <h2 className="mt-3 font-display text-3xl text-primary">Ainda não conseguiu se decidir sozinho?</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            O Dr. Pedro vai te ajudar. Responda a um questionário rápido — não demora 5 minutos — com perguntas básicas sobre a sua saúde. Com isso ele te sugere o melhor pacote. Lembrando: é uma sugestão, a escolha é 100% sua.
          </p>
          <Link to="/" className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-5 text-lg font-bold text-accent-foreground">
            Responder o questionário <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-5xl px-5">
        <div className="flex gap-4 rounded-3xl bg-primary p-6 text-primary-foreground">
          <Smartphone className="h-10 w-10 shrink-0 text-accent" />
          <p className="text-lg">
            Depois do pagamento, já começamos seu agendamento e você recebe acesso ao seu aplicativo exclusivo: tratamento, evolução e, se quiser, lembretes de horários e conteúdos de saúde.
          </p>
        </div>
      </section>
    </SiteShell>
  );
}
