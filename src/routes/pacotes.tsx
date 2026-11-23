import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowRight, Check, Loader2, Smartphone } from "lucide-react";
import { PLANS, findPlan, formatBRL, isValidCpf } from "@/lib/plans";
import { createCheckout } from "@/lib/payments.functions";
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


function Pacotes() {
  const [selected, setSelected] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
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
        {PLANS.map((p) => {
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
              <p className="mt-6 border-t border-stone-strong pt-4 text-sm text-muted-foreground">Investimento <span className="block font-display text-2xl text-ink">{formatBRL(p.amountCents)}</span></p>
            </div>
          );
        })}
      </section>

      <div className="sticky bottom-0 z-20 mt-8 border-t border-stone-strong bg-stone/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            disabled={!selected}
            onClick={() => {
              setShowForm(true);
              setTimeout(() => document.getElementById("dados-pagamento")?.scrollIntoView({ behavior: "smooth" }), 50);
            }}
            className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-xl font-semibold text-primary-foreground disabled:opacity-40"
          >
            Continuar para o pagamento <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {showForm && selected && <CheckoutForm planId={selected} />}

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

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function CheckoutForm({ planId }: { planId: string }) {
  const plan = findPlan(planId);
  const checkout = useServerFn(createCheckout);
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", cpf: "", phone: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!plan) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.name.trim().length < 3) return setError("Digite seu nome completo.");
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError("Confira seu e-mail.");
    if (!isValidCpf(form.cpf)) return setError("Confira seu CPF: ele é necessário para emitir a cobrança.");
    setBusy(true);
    const tab = window.open("", "_blank");
    try {
      const r = await checkout({ data: { planId, ...form } });
      if (tab) tab.location.href = r.invoiceUrl;
      navigate({ to: "/pagamento/$orderId", params: { orderId: r.orderId } });
    } catch {
      tab?.close();
      setError("Não conseguimos gerar o pagamento agora. Tente novamente em instantes.");
      setBusy(false);
    }
  };

  const field = "mt-2 h-14 w-full rounded-xl border-2 border-stone-strong bg-card px-4 text-lg outline-none focus:border-primary";
  return (
    <section id="dados-pagamento" className="mx-auto mt-10 max-w-5xl scroll-mt-24 px-5">
      <form onSubmit={submit} className="rounded-3xl bg-card p-6 shadow-app sm:p-10">
        <SectionLabel>Seus dados</SectionLabel>
        <h2 className="mt-2 font-display text-3xl text-primary">{plan.name} · {formatBRL(plan.amountCents)}</h2>
        <p className="mt-2 text-base text-muted-foreground">Na próxima etapa você escolhe pagar por Pix, boleto ou cartão, numa página segura do Asaas.</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="text-base font-semibold">Nome completo<input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" /></label>
          <label className="text-base font-semibold">E-mail<input type="email" className={field} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></label>
          <label className="text-base font-semibold">CPF<input inputMode="numeric" className={field} value={form.cpf} onChange={(e) => setForm({ ...form, cpf: maskCpf(e.target.value) })} /></label>
          <label className="text-base font-semibold">WhatsApp (opcional)<input inputMode="tel" className={field} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" /></label>
        </div>
        {error && <p role="alert" className="mt-4 text-base font-semibold text-destructive">{error}</p>}
        <button type="submit" disabled={busy} className="mt-6 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-xl font-bold text-accent-foreground disabled:opacity-60">
          {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> Gerando pagamento…</> : <>Ir para o pagamento seguro <ArrowRight className="h-5 w-5" /></>}
        </button>
      </form>
    </section>
  );
}
