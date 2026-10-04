import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  HeartPulse,
  Leaf,
  LockKeyhole,
  Pencil,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import logoAsset from "@/assets/logo-dr-pedro-trentini.png.asset.json";
import jornadaCriativa from "@/assets/jornada-criativa.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type ImprovementKey =
  | "skin"
  | "memory"
  | "energy"
  | "menopause"
  | "mobility"
  | "weight"
  | "exercise";

type ImprovementAnswer = { detail: string; score: number | null; skipped: boolean };

type FormData = {
  name: string;
  age: string;
  weight: string;
  profession: string;
  phone: string;
  complaint: string;
  complaintDetails: string;
  complaintScore: number | null;
  improvements: Record<ImprovementKey, ImprovementAnswer>;
  additionalOne: string;
  additionalTwo: string;
};

const improvementItems: Array<{ key: ImprovementKey; title: string; prompt: string }> = [
  { key: "skin", title: "Cuidado com a pele", prompt: "O que você gostaria de melhorar na saúde e aparência da sua pele?" },
  { key: "memory", title: "Memória e raciocínio", prompt: "Conte sobre esquecimentos, concentração ou agilidade de pensamento." },
  { key: "energy", title: "Disposição e bem-estar", prompt: "Como você gostaria de se sentir em relação à energia e vitalidade?" },
  { key: "menopause", title: "Menopausa e sintomas", prompt: "Quais sintomas mais interferem no seu bem-estar hoje?" },
  { key: "mobility", title: "Mobilidade física", prompt: "Há movimentos, dores ou limitações que você deseja melhorar?" },
  { key: "weight", title: "Manejo do peso", prompt: "Seu objetivo é eliminar peso, ganhar massa muscular ou manter-se?" },
  { key: "exercise", title: "Desempenho físico", prompt: "O que você busca melhorar em força, resistência ou recuperação?" },
];

const emptyImprovement = (): ImprovementAnswer => ({ detail: "", score: null, skipped: false });

const initialData: FormData = {
  name: "",
  age: "",
  weight: "",
  profession: "",
  phone: "",
  complaint: "",
  complaintDetails: "",
  complaintScore: null,
  improvements: {
    skin: emptyImprovement(),
    memory: emptyImprovement(),
    energy: emptyImprovement(),
    menopause: emptyImprovement(),
    mobility: emptyImprovement(),
    weight: emptyImprovement(),
    exercise: emptyImprovement(),
  },
  additionalOne: "",
  additionalTwo: "",
};

const STORAGE_KEY = "anamnese-pedro-trentini-v1";
const totalQuestions = 5 + 3 + improvementItems.length + 2;

function ScorePicker({ value, onChange }: { value: number | null; onChange: (value: number) => void }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm font-semibold text-muted-foreground">
        <span>0 · Péssimo</span>
        <span>10 · Excelente</span>
      </div>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
        {Array.from({ length: 11 }, (_, score) => (
          <Button
            key={score}
            type="button"
            variant={value === score ? "default" : "outline"}
            onClick={() => onChange(score)}
            aria-pressed={value === score}
            className="h-12 min-w-0 px-0 text-lg font-bold shadow-none"
          >
            {score}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function HealthIntakeApp() {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(initialData);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const saved = JSON.parse(stored) as { data?: FormData; step?: number; started?: boolean };
      if (saved.data) setData(saved.data);
      if (typeof saved.step === "number") setStep(saved.step);
      if (saved.started) setStarted(true);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!started || complete) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, step, started }));
  }, [data, step, started, complete]);

  const screens = useMemo(() => {
    const identification = [
      { title: "Qual é o seu nome completo?", eyebrow: "Identificação", hint: "Digite como você gosta de ser chamado.", key: "name" as const, type: "text", placeholder: "Ex.: Maria de Fátima" },
      { title: "Qual é a sua idade?", eyebrow: "Identificação", hint: "Informe sua idade em anos.", key: "age" as const, type: "number", placeholder: "Ex.: 58" },
      { title: "Qual é o seu peso atual?", eyebrow: "Identificação", hint: "Uma estimativa já é suficiente.", key: "weight" as const, type: "number", placeholder: "Ex.: 72,5" },
      { title: "Qual é a sua profissão?", eyebrow: "Identificação", hint: "Pode informar sua ocupação atual ou anterior.", key: "profession" as const, type: "text", placeholder: "Ex.: Professora" },
      { title: "Qual é o seu telefone?", eyebrow: "Identificação", hint: "Use um número em que possamos falar com você.", key: "phone" as const, type: "tel", placeholder: "(00) 00000-0000" },
    ];
    return identification;
  }, []);

  const questionNumber = Math.min(step + 1, totalQuestions);
  const progress = Math.round((questionNumber / totalQuestions) * 100);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function updateImprovement(key: ImprovementKey, patch: Partial<ImprovementAnswer>) {
    setData((current) => ({
      ...current,
      improvements: {
        ...current.improvements,
        [key]: { ...current.improvements[key], ...patch },
      },
    }));
    setError("");
  }

  function validateCurrent() {
    if (step === 0 && data.name.trim().length < 2) return "Por favor, informe seu nome completo.";
    if (step === 1 && (!data.age || Number(data.age) < 18 || Number(data.age) > 120)) return "Informe uma idade válida entre 18 e 120 anos.";
    if (step === 2 && data.weight && (Number(data.weight.replace(",", ".")) <= 0 || Number(data.weight.replace(",", ".")) > 400)) return "Confira o peso informado.";
    if (step === 4 && data.phone.replace(/\D/g, "").length < 8) return "Informe um telefone válido.";
    if (step === 5 && data.complaint.trim().length < 3) return "Conte brevemente o que está incomodando você.";
    if (step === 7 && data.complaintScore === null) return "Escolha uma nota de 0 a 10.";
    const improvementIndex = step - 9;
    if (improvementIndex >= 0 && improvementIndex < improvementItems.length) {
      const item = improvementItems[improvementIndex];
      if (!item) return "";
      const answer = data.improvements[item.key];
      if (!answer.skipped && answer.score === null) return "Escolha uma nota ou marque “Não se aplica”.";
    }
    return "";
  }

  function next() {
    const message = validateCurrent();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStep((current) => current + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    const scores = improvementItems
      .map((item) => data.improvements[item.key].score)
      .filter((score): score is number => score !== null);
    const healthAverage = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
    const { error: submitError } = await supabase.from("health_intakes").insert({
      patient_name: data.name.trim(),
      age: Number(data.age),
      weight_kg: data.weight ? Number(data.weight.replace(",", ".")) : null,
      profession: data.profession.trim() || null,
      phone: data.phone.trim(),
      main_complaint: data.complaint.trim(),
      complaint_details: data.complaintDetails.trim() || null,
      complaint_score: data.complaintScore,
      improvement_answers: {
        goals: data.improvements,
        additional_notes: [data.additionalOne, data.additionalTwo].filter(Boolean),
      },
      pain_average: data.complaintScore,
      health_average: healthAverage,
    });
    setSubmitting(false);
    if (submitError) {
      setError("Não foi possível enviar agora. Suas respostas continuam salvas neste aparelho. Tente novamente.");
      return;
    }
    window.localStorage.removeItem(STORAGE_KEY);
    setComplete(true);
  }

  if (!started) {
    return (
      <main className="min-h-dvh bg-background px-5 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-app sm:min-h-[calc(100dvh-5rem)] sm:grid sm:grid-cols-[1.05fr_.95fr]">
          <div className="relative min-h-64 overflow-hidden bg-brand-soft p-6 sm:min-h-full sm:p-10">
            <div className="absolute inset-x-0 bottom-0 h-24 bg-leaf-pattern opacity-40" />
            <img src={logoAsset.url} alt="Dr. Pedro Trentini — Farmacêutico Clínico" className="relative mx-auto h-full max-h-[31rem] w-full object-contain" />
          </div>
          <div className="flex flex-col justify-center p-7 sm:p-12 lg:p-16">
            <div className="mb-7 inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-bold uppercase text-secondary-foreground">
              <HeartPulse className="h-4 w-4" /> Anamnese inicial
            </div>
            <h1 className="font-display text-4xl leading-tight text-foreground sm:text-5xl">Vamos conhecer você por inteiro.</h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">Suas respostas ajudam a tornar o cuidado mais individualizado, seguro e alinhado ao que importa na sua vida.</p>
            <div className="mt-8 grid gap-3 text-base font-medium text-foreground">
              <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> Uma pergunta de cada vez</div>
              <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" /> Informações tratadas com cuidado</div>
              <div className="flex items-center gap-3"><Sparkles className="h-5 w-5 shrink-0 text-primary" /> Cerca de 8 minutos</div>
            </div>
            <Button onClick={() => setStarted(true)} className="mt-10 h-14 w-full rounded-xl text-lg font-bold sm:w-fit sm:px-8">
              Começar agora <ArrowRight className="h-5 w-5" />
            </Button>
            <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><LockKeyhole className="h-4 w-4" /> Você pode sair e continuar depois neste aparelho.</p>
          </div>
        </div>
      </main>
    );
  }

  if (complete) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-5 py-10">
        <section className="w-full max-w-xl text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-app"><Check className="h-10 w-10" /></div>
          <p className="mt-8 text-sm font-bold uppercase text-accent">Anamnese enviada</p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-foreground">Obrigado, {data.name.split(" ")[0]}.</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">Suas respostas foram recebidas com segurança e serão analisadas antes do seu atendimento.</p>
          <div className="mt-8 flex items-start gap-3 rounded-xl border border-border bg-card p-5 text-left">
            <Leaf className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <p className="text-base leading-relaxed text-foreground">Este questionário não substitui uma avaliação clínica. As próximas orientações serão definidas de forma individualizada.</p>
          </div>
        </section>
      </main>
    );
  }

  const reviewStep = 9 + improvementItems.length + 2;
  const isReview = step === reviewStep;
  const isTransition = step === 8;
  const improvementIndex = step - 9;
  const currentImprovement = improvementIndex >= 0 && improvementIndex < improvementItems.length ? improvementItems[improvementIndex] : null;
  const currentIdentification = step < screens.length ? screens[step] : null;

  return (
    <main className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><Leaf className="h-5 w-5" /></div>
              <div className="min-w-0"><p className="truncate text-sm font-bold text-foreground">Dr. Pedro Trentini</p><p className="truncate text-xs text-muted-foreground">Anamnese inicial</p></div>
            </div>
            <span className="text-sm font-bold text-primary">{isReview ? "Revisão" : isTransition ? "Pausa criativa" : `${questionNumber} de ${totalQuestions}`}</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${isReview ? 100 : progress}%` }} /></div>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100dvh-97px)] max-w-3xl flex-col px-5 py-8 sm:px-8 sm:py-12">
        <section key={step} className="animate-fade-in flex flex-1 flex-col">
          {currentIdentification && <>
            <QuestionHeading eyebrow={currentIdentification.eyebrow} title={currentIdentification.title} hint={currentIdentification.hint} />
            <Input autoFocus inputMode={currentIdentification.type === "number" ? "decimal" : currentIdentification.type === "tel" ? "tel" : "text"} type={currentIdentification.type} placeholder={currentIdentification.placeholder} value={data[currentIdentification.key]} onChange={(event) => update(currentIdentification.key, event.target.value)} className="h-16 rounded-xl border-2 px-5 text-xl shadow-none placeholder:text-base md:text-xl" />
          </>}

          {step === 5 && <><QuestionHeading eyebrow="Queixa principal" title="O que está incomodando você hoje?" hint="Descreva com suas palavras o principal motivo para buscar acompanhamento." /><Textarea autoFocus value={data.complaint} onChange={(event) => update("complaint", event.target.value)} placeholder="Ex.: Sinto fadiga e falta de disposição há cerca de dois meses..." className="min-h-52 rounded-xl border-2 p-5 text-xl leading-relaxed shadow-none md:text-xl" /></>}
          {step === 6 && <><QuestionHeading eyebrow="Queixa principal" title="Gostaria de acrescentar algum detalhe?" hint="Conte quando começou, o que piora ou melhora e como isso afeta sua rotina." /><Textarea autoFocus value={data.complaintDetails} onChange={(event) => update("complaintDetails", event.target.value)} placeholder="Escreva aqui. Se preferir, pode deixar em branco." className="min-h-52 rounded-xl border-2 p-5 text-xl leading-relaxed shadow-none md:text-xl" /></>}
          {step === 7 && <><QuestionHeading eyebrow="Como você se sente" title="Que nota representa seu estado atual?" hint="Pense no conjunto das dores e queixas que descreveu." /><ScorePicker value={data.complaintScore} onChange={(score) => update("complaintScore", score)} /></>}

          {isTransition && (
            <div className="overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-app">
              <div className="relative h-40 overflow-hidden sm:h-72">
                <img src={jornadaCriativa} alt="Ilustração de uma pessoa de olhos fechados imaginando algo bom" loading="lazy" width={1024} height={1280} className="h-full w-full origin-center animate-drift object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-background/85 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-primary backdrop-blur"><Sparkles className="h-3.5 w-3.5" /> Modo criativo ativado</span>
              </div>
              <div className="px-5 pb-1 pt-1 sm:px-9">
                <p className="font-display text-xl leading-snug text-foreground sm:text-[1.75rem]">Eu quero que você me conte o que você busca de melhoria na sua vida.</p>
                <p className="mt-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary"><Eye className="h-4 w-4 shrink-0" /> Feche o olho por um segundo e pense:</p>
                <div className="mt-3 rounded-2xl border-2 border-dashed border-accent bg-accent/10 p-4 sm:p-6">
                  <p className="font-display text-2xl leading-tight text-foreground sm:text-4xl">EU SERIA MAIS FELIZ SE:</p>
                  <p className="mt-3 flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-muted-foreground"><span className="flex gap-1.5"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:150ms]" /><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:300ms]" /></span> complete só na sua cabeça</p>
                </div>
                <p className="mt-5 text-base leading-relaxed text-muted-foreground">Reflita alguns momentos nisso depois é só passar que colocamos alguns dos principais pontos para te ajudar a lembrar (nenhuma das próximas é obrigatória, se não fizer sentido para você, só pular no botão na parte mais baixa), mas você terá como inserir novos:</p>
                <p className="mt-5 font-display text-2xl leading-snug text-primary sm:text-4xl">Vamos para a jornada da saúde?!</p>
                <p className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Para seguir clique abaixo</p>
              </div>
            </div>
          )}

          {currentImprovement && (() => {
            const answer = data.improvements[currentImprovement.key];
            return <><QuestionHeading eyebrow="Melhorias que busco" title={currentImprovement.title} hint={currentImprovement.prompt} />
              <Textarea value={answer.detail} disabled={answer.skipped} onChange={(event) => updateImprovement(currentImprovement.key, { detail: event.target.value })} placeholder="Conte um pouco mais, se desejar..." className="mb-7 min-h-28 rounded-xl border-2 p-4 text-lg shadow-none md:text-lg" />
              <p className="mb-3 text-base font-bold text-foreground">Como você avalia esse aspecto hoje?</p>
              <ScorePicker value={answer.score} onChange={(score) => updateImprovement(currentImprovement.key, { score, skipped: false })} />
              <SkipButton selected={answer.skipped} onClick={() => updateImprovement(currentImprovement.key, { skipped: !answer.skipped, score: null, detail: answer.skipped ? answer.detail : "" })} />
            </>;
          })()}

          {step === 16 && <><QuestionHeading eyebrow="Para completar" title="Existe outra melhoria que você busca?" hint="Este espaço é seu. Conte o que ainda não apareceu nas perguntas." /><Textarea autoFocus value={data.additionalOne} onChange={(event) => update("additionalOne", event.target.value)} placeholder="Escreva aqui, se desejar..." className="min-h-52 rounded-xl border-2 p-5 text-xl leading-relaxed shadow-none md:text-xl" /></>}
          {step === 17 && <><QuestionHeading eyebrow="Última pergunta" title="Há algo mais que gostaria de acrescentar?" hint="Inclua qualquer informação que considere importante para seu cuidado." /><Textarea autoFocus value={data.additionalTwo} onChange={(event) => update("additionalTwo", event.target.value)} placeholder="Escreva aqui, se desejar..." className="min-h-52 rounded-xl border-2 p-5 text-xl leading-relaxed shadow-none md:text-xl" /></>}

          {isReview && <Review data={data} onEdit={setStep} />}

          {error && <p role="alert" className="mt-5 rounded-lg bg-destructive/10 px-4 py-3 text-base font-semibold text-destructive">{error}</p>}

        </section>
        <div className={cn("mt-auto flex items-center gap-3 pt-10", isTransition && "sticky bottom-0 -mx-5 border-t border-border/70 bg-background/92 px-5 pb-5 pt-4 backdrop-blur sm:-mx-8 sm:px-8")}>
          <Button type="button" variant="outline" onClick={() => step === 0 ? setStarted(false) : setStep((current) => current - 1)} className="h-14 w-14 shrink-0 rounded-xl p-0" aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Button>
          <Button type="button" onClick={isReview ? submit : next} disabled={submitting} className={cn("h-14 flex-1 rounded-xl text-lg font-bold", isTransition && "bg-accent text-accent-foreground hover:bg-accent/90")}>
            {submitting ? "Enviando..." : isReview ? "Enviar anamnese" : isTransition ? "SEGUIR" : "Salvar e continuar"}
            {!submitting && (isReview ? <Check className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />)}
          </Button>
        </div>
      </div>
    </main>
  );
}

function QuestionHeading({ eyebrow, title, hint }: { eyebrow: string; title: string; hint: string }) {
  return <div className="mb-8"><p className="text-sm font-bold uppercase text-accent">{eyebrow}</p><h1 className="mt-3 font-display text-3xl leading-tight text-foreground sm:text-4xl">{title}</h1><p className="mt-4 text-lg leading-relaxed text-muted-foreground">{hint}</p></div>;
}

function SkipButton({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  return <Button type="button" variant="outline" onClick={onClick} className={cn("mt-5 h-12 w-full rounded-xl border-2 text-base shadow-none", selected && "border-primary bg-secondary text-primary")}>{selected && <Check className="h-5 w-5" />}{selected ? "Marcado: não se aplica" : "Não se aplica"}</Button>;
}

function Review({ data, onEdit }: { data: FormData; onEdit: (step: number) => void }) {
  const scored = improvementItems.filter((item) => data.improvements[item.key].score !== null);
  const average = scored.length ? (scored.reduce((sum, item) => sum + Number(data.improvements[item.key].score), 0) / scored.length).toFixed(1) : "—";
  return <div><QuestionHeading eyebrow="Quase pronto" title="Revise suas respostas" hint="Confira os dados abaixo. Você pode voltar e corrigir antes de enviar." />
    <div className="space-y-3">
      <ReviewBlock title="Identificação" value={`${data.name} · ${data.age} anos${data.weight ? ` · ${data.weight} kg` : ""}\n${data.profession || "Profissão não informada"} · ${data.phone}`} onClick={() => onEdit(0)} />
      <ReviewBlock title="Queixa principal" value={`${data.complaint}${data.complaintDetails ? `\n${data.complaintDetails}` : ""}\nNota: ${data.complaintScore}`} onClick={() => onEdit(5)} />
      <ReviewBlock title="Melhorias buscadas" value={`${scored.length} aspectos avaliados · média ${average}\n${improvementItems.filter((item) => data.improvements[item.key].detail).map((item) => item.title).join(" · ") || "Sem observações adicionais"}`} onClick={() => onEdit(9)} />
      {(data.additionalOne || data.additionalTwo) && <ReviewBlock title="Observações finais" value={[data.additionalOne, data.additionalTwo].filter(Boolean).join("\n")} onClick={() => onEdit(16)} />}
    </div>
    <div className="mt-6 flex items-start gap-3 rounded-xl bg-secondary p-4"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p className="text-sm leading-relaxed text-secondary-foreground">Ao enviar, suas respostas ficarão disponíveis com segurança para análise profissional.</p></div>
  </div>;
}

function ReviewBlock({ title, value, onClick }: { title: string; value: string; onClick: () => void }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 rounded-xl border border-border bg-card p-5"><div className="min-w-0"><p className="font-bold text-foreground">{title}</p><p className="mt-2 whitespace-pre-line text-base leading-relaxed text-muted-foreground">{value}</p></div><Button variant="ghost" size="icon" onClick={onClick} aria-label={`Editar ${title}`} className="shrink-0"><Pencil className="h-4 w-4" /></Button></div>;
}