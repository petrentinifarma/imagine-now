import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ClipboardList, HeartPulse, ShieldCheck, Sparkles } from "lucide-react";
import { DriveVideo, SectionLabel, SiteShell, VideoPlaceholder } from "@/components/site/site-shell";

export const Route = createFileRoute("/inicio")({
  head: () => ({
    meta: [
      { title: "Dr. Pedro Trentini | Cuidado farmacêutico 50+" },
      { name: "description", content: "Tratamento 100% personalizado para saúde, vitalidade e bem-estar após os 50, com o farmacêutico clínico Dr. Pedro Trentini." },
      { property: "og:title", content: "Dr. Pedro Trentini | Cuidado farmacêutico 50+" },
      { property: "og:description", content: "Conheça o método de cuidado personalizado e escolha o tratamento ideal para sua rotina." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Inicio,
});

function PrimaryCta() {
  return (
    <Link
      to="/pacotes"
      className="flex w-full flex-col items-center justify-center rounded-2xl bg-primary px-6 py-5 text-center text-primary-foreground shadow-app transition hover:brightness-110"
    >
      <span className="text-sm font-bold uppercase tracking-[0.2em] text-accent">Eu vou me cuidar</span>
      <span className="mt-1 flex items-center gap-2 text-xl font-semibold sm:text-2xl">
        Quero conhecer as opções de tratamento <ArrowRight className="h-6 w-6" />
      </span>
    </Link>
  );
}

function Inicio() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl px-5 pt-10">
        <SectionLabel>Boas-vindas</SectionLabel>
        <h1 className="mt-3 font-display text-4xl leading-tight text-primary sm:text-5xl">
          Que bom que você está aqui.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Isso é sinal de que você quer cuidar da sua saúde, autoestima e bem-estar. Vamos começar essa jornada fascinante de autocuidado!
        </p>
        <div className="mt-8">
          <VideoPlaceholder label="Vídeo de boas-vindas do Dr. Pedro (em breve)" />
        </div>
        <div className="mt-8">
          <PrimaryCta />
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-5xl px-5">
        <div className="rounded-3xl bg-card p-6 shadow-app sm:p-10">
          <SectionLabel>Como funciona</SectionLabel>
          <h2 className="mt-3 font-display text-3xl text-primary">Um método feito para a sua rotina</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Se por acaso ainda não entendeu como funciona o tratamento proposto pelo Dr. Pedro, assista ao vídeo breve abaixo. Nele, ele explica passo a passo o método que criou cuidadosamente para cuidar de você de forma 100% personalizada, gerando junto com você um tratamento prático, feito para a sua rotina.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { icon: ClipboardList, t: "Escuta completa", d: "Histórico, exames, sono, intestino, rotina e objetivos." },
              { icon: HeartPulse, t: "Plano individual", d: "Fórmulas e orientações pensadas só para você." },
              { icon: ShieldCheck, t: "Acompanhamento", d: "Retornos para ajustar e ver sua evolução." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="rounded-2xl bg-stone p-5">
                <Icon className="h-7 w-7 text-accent" />
                <p className="mt-3 text-lg font-semibold text-primary">{t}</p>
                <p className="mt-1 text-base text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <VideoPlaceholder label="Vídeo explicando o método (em breve)" />
          </div>
          <div className="mt-6">
            <PrimaryCta />
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-5xl px-5">
        <SectionLabel>Depoimentos</SectionLabel>
        <h2 className="mt-3 font-display text-3xl text-primary">Veja quem já se cuidou</h2>
        <p className="mt-3 text-lg text-muted-foreground">
          Se ainda não se convenceu da oportunidade que você está tendo de se cuidar, veja os depoimentos de quem já se cuidou e as melhoras que tiveram.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <figure>
            <DriveVideo id="1ErjiVH-Np7YC3jOZdw6RX4dPsJczWCsP" title="Depoimento da Gilmara" />
            <figcaption className="mt-2 text-base font-semibold text-primary">Gilmara</figcaption>
          </figure>
          <figure>
            <DriveVideo id="1cRkLAtyu03IVWdQBCHg3RRbktIx13D9E" title="Depoimento da Lica" />
            <figcaption className="mt-2 text-base font-semibold text-primary">Lica</figcaption>
          </figure>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-5xl px-5">
        <div className="rounded-3xl border-2 border-accent bg-card p-6 sm:p-10">
          <div className="flex items-center gap-2 text-accent">
            <Sparkles className="h-6 w-6" />
            <SectionLabel>Proposta especial</SectionLabel>
          </div>
          <h2 className="mt-3 font-display text-3xl text-primary">Ainda com alguma dúvida?</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Se ainda te resta uma dúvida de que essa é uma opção excelente para tratar dores e queixas com foco na saúde a longo prazo — e o melhor, com ótimo custo-benefício —, temos uma proposta especial: responda em menos de 5 minutos a um questionário com perguntas básicas sobre a sua saúde. O próprio Dr. Pedro entrará em contato para bater um papo e explicar como pode te ajudar.
          </p>
          <Link
            to="/"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-5 text-center text-lg font-bold uppercase tracking-wide text-accent-foreground transition hover:brightness-105"
          >
            Não perca essa avaliação gratuita <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
