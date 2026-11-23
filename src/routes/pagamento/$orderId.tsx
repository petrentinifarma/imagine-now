import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, Clock, ExternalLink, Loader2 } from "lucide-react";
import { SectionLabel, SiteShell } from "@/components/site/site-shell";
import { getOrderStatus } from "@/lib/payments.functions";
import { formatBRL } from "@/lib/plans";

export const Route = createFileRoute("/pagamento/$orderId")({
  head: () => ({
    meta: [
      { title: "Confirmação da contratação | Dr. Pedro Trentini" },
      { name: "description", content: "Acompanhe a confirmação do pagamento do seu pacote de cuidado farmacêutico." },
      { property: "og:title", content: "Confirmação da contratação | Dr. Pedro Trentini" },
      { property: "og:description", content: "Status do pagamento do seu pacote." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Pagamento,
});

type Order = Awaited<ReturnType<typeof getOrderStatus>>;

function Pagamento() {
  const { orderId } = Route.useParams();
  const fetchStatus = useServerFn(getOrderStatus);
  const [order, setOrder] = useState<Order | undefined>(undefined);
  const [checking, setChecking] = useState(false);
  const [expired, setExpired] = useState(false);
  const started = useRef(Date.now());

  const load = async (check: boolean) => {
    try {
      setOrder(await fetchStatus({ data: { orderId, check } }));
    } catch {
      /* keep last state */
    }
  };

  useEffect(() => {
    void load(false);
    const t = setInterval(() => {
      if (Date.now() - started.current > 10 * 60000) {
        setExpired(true);
        clearInterval(t);
        return;
      }
      void load(true);
    }, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (order === undefined) {
    return <SiteShell><div className="flex justify-center py-24"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div></SiteShell>;
  }
  if (order === null) {
    return <SiteShell><section className="mx-auto max-w-xl px-5 py-16 text-center"><h1 className="font-display text-3xl text-primary">Pedido não encontrado</h1><Link to="/pacotes" className="mt-6 inline-block text-lg font-semibold text-primary underline">Ver os pacotes</Link></section></SiteShell>;
  }

  const paid = order.status === "paid";
  return (
    <SiteShell>
      <section className="mx-auto max-w-xl px-5 pt-10">
        {paid ? (
          <div className="rounded-3xl bg-card p-7 text-center shadow-app">
            <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
            <SectionLabel>Contratação confirmada</SectionLabel>
            <h1 className="mt-2 font-display text-3xl text-primary">Tudo certo, {order.firstName}!</h1>
            <p className="mt-3 text-lg text-muted-foreground">Recebemos o pagamento do pacote <strong className="text-ink">{order.planName}</strong> ({formatBRL(order.amountCents)}). O recibo foi enviado pelo Asaas.</p>
            <div className="mt-6 rounded-2xl bg-stone p-5 text-left text-base">
              <p className="font-bold text-ink">Próximo passo</p>
              <p className="mt-1 text-muted-foreground">Escolha o melhor dia e horário para a sua consulta inicial. O convite chega no seu e-mail com o link do Google Meet.</p>
            </div>
            <Link to="/agendar" className="mt-6 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-xl font-semibold text-primary-foreground">
              <CalendarDays className="h-6 w-6" /> Agendar minha consulta
            </Link>
          </div>
        ) : (
          <div className="rounded-3xl bg-card p-7 text-center shadow-app">
            <Clock className="mx-auto h-14 w-14 text-accent" />
            <SectionLabel>Aguardando pagamento</SectionLabel>
            <h1 className="mt-2 font-display text-3xl text-primary">Quase lá, {order.firstName}!</h1>
            <p className="mt-3 text-lg text-muted-foreground">Conclua o pagamento do pacote <strong className="text-ink">{order.planName}</strong> ({formatBRL(order.amountCents)}) na página segura do Asaas. Esta tela se atualiza sozinha quando ele for confirmado.</p>
            {order.invoiceUrl && order.status === "pending" && (
              <a href={order.invoiceUrl} target="_blank" rel="noreferrer" className="mt-6 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-xl font-bold text-accent-foreground">
                Abrir página de pagamento <ExternalLink className="h-5 w-5" />
              </a>
            )}
            {order.status !== "pending" && <p className="mt-4 text-base font-semibold text-destructive">Este pagamento foi cancelado ou estornado. Fale com o Dr. Pedro pelo WhatsApp.</p>}
            <button
              type="button"
              disabled={checking}
              onClick={async () => { setChecking(true); await load(true); setChecking(false); }}
              className={`mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary text-lg font-semibold text-primary ${expired ? "" : "opacity-90"}`}
            >
              {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : null} Já paguei, verificar
            </button>
            <p className="mt-4 text-sm text-muted-foreground">Pix confirma em segundos. Boleto pode levar até 3 dias úteis — você pode fechar esta página e voltar pelo mesmo link.</p>
          </div>
        )}
      </section>
    </SiteShell>
  );
}
