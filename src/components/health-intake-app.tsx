import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
  Trash2,
} from "lucide-react";

import logoAsset from "@/assets/logo-dr-pedro-trentini.png.asset.json";
import jornadaCriativa from "@/assets/jornada-criativa.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { cn } from "@/lib/utils";
import { submitHealthIntake } from "@/lib/health-intake.functions";
import {
  DRAFT_STORAGE_KEY,
  DRAFT_TTL_MS,
  PRIVACY_NOTICE_VERSION,
  draftSchema,
  healthIntakeFormSchema,
  type HealthIntakeFormData,
  type ImprovementAnswer,
  type ImprovementKey,
} from "@/lib/health-intake-schema";

const improvementItems: Array<{ key: ImprovementKey; title: string; prompt: string }> = [
  {
    key: "skin",
    title: "Cuidado com a pele",
    prompt: "O que você gostaria de melhorar na saúde e aparência da sua pele?",
  },
  {
    key: "memory",
    title: "Memória e raciocínio",
    prompt: "Conte sobre esquecimentos, concentração ou agilidade de pensamento.",
  },
  {
    key: "energy",
    title: "Disposição e bem-estar",
    prompt: "Como você gostaria de se sentir em relação à energia e vitalidade?",
  },
  {
    key: "menopause",
    title: "Menopausa e sintomas",
    prompt: "Quais sintomas mais interferem no seu bem-estar hoje?",
  },
  {
    key: "mobility",
    title: "Mobilidade física",
    prompt: "Há movimentos, dores ou limitações que você deseja melhorar?",
  },
  {
    key: "weight",
    title: "Manejo do peso",
    prompt: "Seu objetivo é eliminar peso, ganhar massa muscular ou manter-se?",
  },
  {
    key: "exercise",
    title: "Desempenho físico",
    prompt: "O que você busca melhorar em força, resistência ou recuperação?",
  },
];

const emptyImprovement = (): ImprovementAnswer => ({ detail: "", score: null, skipped: false });

const initialData: HealthIntakeFormData = {
  name: "",
  age: "",
  weight: "",
  profession: "",
  phone: "",
  complaint: "",
  complaintDetails: "",
  complaintScore: null,
  expectations: "",
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

const totalQuestions = 5 + 4 + improvementItems.length + 2;
const turnstileSiteKey = import.meta.env["VITE_TURNSTILE_SITE_KEY"] ?? "";
const privacyContact =
  import.meta.env["VITE_PRIVACY_CONTACT"] ??
  "o canal de atendimento pelo qual você recebeu este link";

function removeStoredDraft() {
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // A blocked storage API must not prevent navigation or a successful submit.
  }
}

function ScorePicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number) => void;
}) {
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
  const submitHealthIntakeFn = useServerFn(submitHealthIntake);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<HealthIntakeFormData>(initialData);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [saveDraft, setSaveDraft] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftChecked, setDraftChecked] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const [website, setWebsite] = useState("");
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!stored) return;

      const saved = draftSchema.safeParse(JSON.parse(stored));
      if (!saved.success || saved.data.expiresAt <= Date.now()) {
        removeStoredDraft();
        return;
      }
      setData(saved.data.data);
      setStep(saved.data.step);
      setSaveDraft(true);
      setHasDraft(true);
    } catch {
      removeStoredDraft();
    } finally {
      setDraftChecked(true);
    }
  }, []);

  useEffect(() => {
    if (!draftChecked) return;
    if (!saveDraft) {
      removeStoredDraft();
      setHasDraft(false);
      return;
    }
    if (!started || complete) return;

    const savedAt = Date.now();
    try {
      window.localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          version: 3,
          savedAt,
          expiresAt: savedAt + DRAFT_TTL_MS,
          data,
          step,
        }),
      );
      setHasDraft(true);
    } catch {
      setSaveDraft(false);
      setHasDraft(false);
      setError("Este navegador não permitiu salvar o rascunho. Mantenha a página aberta.");
    }
  }, [data, step, started, complete, saveDraft, draftChecked]);

  const screens = useMemo(() => {
    const identification = [
      {
        title: "Qual é o seu nome completo?",
        eyebrow: "Identificação",
        hint: "Digite como você gosta de ser chamado.",
        key: "name" as const,
        type: "text",
        placeholder: "Ex.: Maria de Fátima",
      },
      {
        title: "Qual é a sua idade?",
        eyebrow: "Identificação",
        hint: "Informe sua idade em anos.",
        key: "age" as const,
        type: "number",
        placeholder: "Ex.: 58",
      },
      {
        title: "Qual é o seu peso atual?",
        eyebrow: "Identificação",
        hint: "Uma estimativa já é suficiente.",
        key: "weight" as const,
        type: "number",
        placeholder: "Ex.: 72,5",
      },
      {
        title: "Qual é a sua profissão?",
        eyebrow: "Identificação",
        hint: "Pode informar sua ocupação atual ou anterior.",
        key: "profession" as const,
        type: "text",
        placeholder: "Ex.: Professora",
      },
      {
        title: "Qual é o seu telefone?",
        eyebrow: "Identificação",
        hint: "Use um número em que possamos falar com você.",
        key: "phone" as const,
        type: "tel",
        placeholder: "(00) 00000-0000",
      },
    ];
    return identification;
  }, []);

  const questionNumber = Math.min(step + 1 - (step > 9 ? 1 : 0), totalQuestions);
  const progress = Math.round((questionNumber / totalQuestions) * 100);

  function update<K extends keyof HealthIntakeFormData>(key: K, value: HealthIntakeFormData[K]) {
    setData((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function begin() {
    if (!privacyAcknowledged) {
      setError("Confirme que leu o aviso de privacidade para continuar.");
      return;
    }
    setError("");
    setStarted(true);
  }

  function clearDraft() {
    removeStoredDraft();
    requestIdRef.current = null;
    setData(initialData);
    setStep(0);
    setStarted(false);
    setSaveDraft(false);
    setHasDraft(false);
    setTurnstileToken("");
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
    if (step === 0 && data.name.trim().length < 2) return "Por favor, informe seu nome.";
    if (step === 0 && data.name.trim().length > 120)
      return "O nome deve ter no máximo 120 caracteres.";
    if (step === 1 && (!data.age || Number(data.age) < 18 || Number(data.age) > 120))
      return "Informe uma idade válida entre 18 e 120 anos.";
    if (
      step === 2 &&
      data.weight &&
      (Number(data.weight.replace(",", ".")) <= 0 || Number(data.weight.replace(",", ".")) > 400)
    )
      return "Confira o peso informado.";
    if (step === 3 && data.profession.trim().length > 120)
      return "A profissão deve ter no máximo 120 caracteres.";
    if (step === 4 && data.phone.replace(/\D/g, "").length < 8)
      return "Informe um telefone válido.";
    if (step === 4 && data.phone.trim().length > 24)
      return "O telefone deve ter no máximo 24 caracteres.";
    if (step === 5 && data.complaint.trim().length < 3)
      return "Conte brevemente o que está incomodando você.";
    if (step === 5 && data.complaint.trim().length > 3000)
      return "Resuma a queixa em até 3.000 caracteres.";
    if (step === 6 && data.complaintDetails.trim().length > 3000)
      return "Resuma os detalhes em até 3.000 caracteres.";
    if (step === 7 && data.expectations.trim().length > 3000)
      return "Resuma suas expectativas em até 3.000 caracteres.";
    if (step === 8 && data.complaintScore === null) return "Escolha uma nota de 0 a 10.";
    const improvementIndex = step - 10;
    if (improvementIndex >= 0 && improvementIndex < improvementItems.length) {
      const item = improvementItems[improvementIndex];
      if (!item) return "";
      const answer = data.improvements[item.key];
      if (!answer.skipped && answer.score === null)
        return "Escolha uma nota ou marque “Não se aplica”.";
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
    setError("");
    const validation = healthIntakeFormSchema.safeParse(data);
    if (!validation.success) {
      setError("Revise as respostas antes de enviar. Há um campo inválido ou muito longo.");
      return;
    }

    if (turnstileSiteKey && !turnstileToken) {
      setError("Conclua a verificação de segurança antes de enviar.");
      return;
    }

    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();
    setSubmitting(true);

    try {
      const result = await submitHealthIntakeFn({
        data: {
          intake: validation.data,
          privacyAcknowledged: true,
          privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
          requestId: requestIdRef.current,
          turnstileToken,
          website,
        },
      });

      if (!result.ok) {
        const messages = {
          invalid: "Não foi possível validar as respostas. Revise os campos e tente novamente.",
          rate_limited: "Houve muitas tentativas recentes. Aguarde 15 minutos e tente novamente.",
          captcha: "A verificação de segurança expirou. Faça-a novamente.",
          unavailable: "Não foi possível enviar agora. Tente novamente em alguns minutos.",
        } as const;
        setError(
          saveDraft
            ? `${messages[result.code]} Seu rascunho permanece salvo neste aparelho.`
            : `${messages[result.code]} Mantenha esta página aberta para não perder as respostas.`,
        );
        setTurnstileResetSignal((current) => current + 1);
        return;
      }

      removeStoredDraft();
      setHasDraft(false);
      setComplete(true);
    } catch (submissionError) {
      console.error(submissionError);
      setError(
        saveDraft
          ? "Não foi possível enviar agora. Seu rascunho permanece salvo neste aparelho. Tente novamente."
          : "Não foi possível enviar agora. Mantenha esta página aberta e tente novamente.",
      );
      setTurnstileResetSignal((current) => current + 1);
    } finally {
      setSubmitting(false);
    }
  }

  if (!started) {
    return (
      <main className="min-h-dvh bg-background px-4 py-4 sm:px-8 sm:py-10">
        <div className="mx-auto flex max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-app sm:min-h-[calc(100dvh-5rem)] sm:grid sm:grid-cols-[1.05fr_.95fr]">
          <div className="relative h-36 overflow-hidden bg-brand-soft p-4 sm:h-auto sm:min-h-full sm:p-10">
            <div className="absolute inset-x-0 bottom-0 h-24 bg-leaf-pattern opacity-40" />
            <img
              src={logoAsset.url}
              alt="Dr. Pedro Trentini — Farmacêutico Clínico"
              className="relative mx-auto h-full max-h-[31rem] w-full object-contain"
            />
          </div>
          <div className="flex flex-col justify-center p-5 sm:p-12 lg:p-16">
            <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-bold uppercase text-secondary-foreground sm:mb-7">
              <HeartPulse className="h-4 w-4" /> Anamnese inicial
            </div>
            <h1 className="font-display text-3xl leading-tight text-foreground sm:text-5xl">
              VAMOS NOS CONHECER MELHOR.
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:mt-5 sm:text-lg">
              Este questionário prepara sua pré-avaliação e ajuda a entender suas expectativas antes
              do atendimento.
            </p>
            <div className="mt-4 grid gap-2 text-sm font-medium text-foreground sm:mt-8 sm:gap-3 sm:text-base">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 shrink-0 text-primary" /> Acesso restrito à equipe
                responsável
              </div>
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 shrink-0 text-primary" /> Cerca de 5 minutos
              </div>
            </div>

            <details className="mt-4 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground sm:mt-6">
              <summary className="cursor-pointer font-bold text-foreground">
                Aviso de privacidade
              </summary>
              <div className="mt-3 space-y-2 leading-relaxed">
                <p>
                  <strong>Responsável:</strong> Dr. Pedro Trentini — Farmacêutico Clínico.
                </p>
                <p>
                  <strong>Finalidade:</strong> preparar a pré-avaliação, organizar o atendimento e
                  permitir contato sobre este cuidado. O questionário não produz diagnóstico
                  automático.
                </p>
                <p>
                  <strong>Dados e fornecedores:</strong> coletamos identificação, contato e
                  respostas de saúde. O armazenamento utiliza Lovable Cloud/Supabase, com leitura
                  pública bloqueada. Quando ativada, a proteção antiabuso utiliza Cloudflare
                  Turnstile.
                </p>
                <p>
                  <strong>Prazo:</strong> os dados são mantidos somente enquanto necessários ao
                  atendimento e às obrigações legais ou regulatórias aplicáveis; depois, são
                  eliminados ou anonimizados.
                </p>
                <p>
                  <strong>Seus direitos:</strong> você pode pedir confirmação, acesso, correção e,
                  quando aplicável, eliminação ou informações sobre o tratamento pelo{" "}
                  {privacyContact}.
                </p>
              </div>
            </details>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm leading-relaxed text-foreground">
              <input
                type="checkbox"
                checked={privacyAcknowledged}
                onChange={(event) => {
                  setPrivacyAcknowledged(event.target.checked);
                  setError("");
                }}
                aria-label="Confirmo que li o aviso de privacidade"
                className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
              />
              <span>
                Li o aviso de privacidade e entendi como minhas respostas serão utilizadas.
              </span>
            </label>

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive"
              >
                {error}
              </p>
            )}

            <Button
              onClick={begin}
              className="mt-4 h-14 w-full rounded-xl text-lg font-bold sm:mt-8 sm:w-fit sm:px-8"
            >
              {hasDraft ? "Continuar anamnese" : "Começar agora"} <ArrowRight className="h-5 w-5" />
            </Button>
            {hasDraft && (
              <Button
                type="button"
                variant="ghost"
                onClick={clearDraft}
                className="mt-2 w-full text-muted-foreground sm:w-fit"
              >
                <Trash2 className="h-4 w-4" /> Apagar rascunho deste aparelho
              </Button>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (complete) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-5 py-10">
        <section className="w-full max-w-xl text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-app">
            <Check className="h-10 w-10" />
          </div>
          <p className="mt-8 text-sm font-bold uppercase text-accent">Anamnese enviada</p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-foreground">
            Obrigado, {data.name.split(" ")[0]}.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
            Suas respostas foram recebidas e encaminhadas para análise antes do seu atendimento.
          </p>
          <div className="mt-8 flex items-start gap-3 rounded-xl border border-border bg-card p-5 text-left">
            <Leaf className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <p className="text-base leading-relaxed text-foreground">
              Este questionário não substitui uma avaliação clínica. As próximas orientações serão
              definidas de forma individualizada.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const reviewStep = 10 + improvementItems.length + 2;
  const isReview = step === reviewStep;
  const isTransition = step === 9;
  const improvementIndex = step - 10;
  const currentImprovement =
    improvementIndex >= 0 && improvementIndex < improvementItems.length
      ? improvementItems[improvementIndex]
      : null;
  const currentIdentification = step < screens.length ? screens[step] : null;

  return (
    <main className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <Leaf className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">Dr. Pedro Trentini</p>
                <p className="truncate text-xs text-muted-foreground">Anamnese inicial</p>
              </div>
            </div>
            <span className="text-sm font-bold text-primary">
              {isReview
                ? "Revisão"
                : isTransition
                  ? "Pausa criativa"
                  : `${questionNumber} de ${totalQuestions}`}
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${isReview ? 100 : progress}%` }}
            />
          </div>
          {(saveDraft || hasDraft) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearDraft}
              className="mt-1 h-8 px-2 text-xs text-muted-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" /> Apagar rascunho
            </Button>
          )}
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100dvh-97px)] max-w-3xl flex-col px-5 py-8 sm:px-8 sm:py-12">
        <section key={step} className="animate-fade-in flex flex-1 flex-col">
          {currentIdentification && (
            <>
              <QuestionHeading
                eyebrow={currentIdentification.eyebrow}
                title={currentIdentification.title}
                hint={currentIdentification.hint}
              />
              <Input
                autoFocus
                inputMode={
                  currentIdentification.key === "age"
                    ? "numeric"
                    : currentIdentification.key === "weight"
                      ? "decimal"
                      : currentIdentification.type === "tel"
                        ? "tel"
                        : "text"
                }
                type={currentIdentification.key === "weight" ? "text" : currentIdentification.type}
                min={currentIdentification.key === "age" ? 18 : undefined}
                max={currentIdentification.key === "age" ? 120 : undefined}
                maxLength={
                  currentIdentification.key === "name" || currentIdentification.key === "profession"
                    ? 120
                    : currentIdentification.key === "phone"
                      ? 24
                      : currentIdentification.key === "weight"
                        ? 10
                        : undefined
                }
                placeholder={currentIdentification.placeholder}
                value={data[currentIdentification.key]}
                onChange={(event) => update(currentIdentification.key, event.target.value)}
                className="h-16 rounded-xl border-2 px-5 text-xl shadow-none placeholder:text-base md:text-xl"
              />
            </>
          )}

          {step === 5 && (
            <>
              <QuestionHeading
                eyebrow="Queixa principal"
                title="O que está incomodando você hoje?"
                hint="Descreva com suas palavras o principal motivo para buscar acompanhamento."
              />
              <Textarea
                autoFocus
                maxLength={3000}
                value={data.complaint}
                onChange={(event) => update("complaint", event.target.value)}
                placeholder="Ex.: Sinto fadiga e falta de disposição há cerca de dois meses..."
                className="min-h-52 rounded-xl border-2 p-5 text-xl leading-relaxed shadow-none md:text-xl"
              />
            </>
          )}
          {step === 6 && (
            <>
              <QuestionHeading
                eyebrow="Queixa principal"
                title="Gostaria de acrescentar algum detalhe?"
                hint="Conte quando começou, o que piora ou melhora e como isso afeta sua rotina."
              />
              <Textarea
                autoFocus
                maxLength={3000}
                value={data.complaintDetails}
                onChange={(event) => update("complaintDetails", event.target.value)}
                placeholder="Escreva aqui. Se preferir, pode deixar em branco."
                className="min-h-52 rounded-xl border-2 p-5 text-xl leading-relaxed shadow-none md:text-xl"
              />
            </>
          )}
          {step === 7 && (
            <>
              <QuestionHeading
                eyebrow="Expectativas"
                title="O que você espera nesse tratamento? Quais são suas expectativas?"
                hint="Detalhe o máximo possível (resultado, tempo, mudança de, perder peso, etc.) por gentileza, com sinceridade pois aqui não tem julgamento."
              />
              <Textarea
                autoFocus
                maxLength={3000}
                value={data.expectations}
                onChange={(event) => update("expectations", event.target.value)}
                placeholder="Escreva aqui, com sinceridade..."
                className="min-h-52 rounded-xl border-2 p-5 text-xl leading-relaxed shadow-none md:text-xl"
              />
            </>
          )}
          {step === 8 && (
            <>
              <QuestionHeading
                eyebrow="Como você se sente"
                title="Que nota representa seu estado atual?"
                hint="Pense no conjunto das dores e queixas que descreveu."
              />
              <ScorePicker
                value={data.complaintScore}
                onChange={(score) => update("complaintScore", score)}
              />
            </>
          )}

          {isTransition && (
            <div className="overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-app">
              <div className="relative h-28 overflow-hidden sm:h-64">
                <img
                  src={jornadaCriativa}
                  alt="Ilustração de uma pessoa de olhos fechados imaginando algo bom"
                  loading="lazy"
                  width={1024}
                  height={1280}
                  className="h-full w-full origin-center animate-drift object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
                <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-background/85 px-3 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-primary backdrop-blur">
                  <Sparkles className="h-3.5 w-3.5" /> Modo criativo ativado
                </span>
              </div>
              <div className="px-5 pb-0 pt-0 sm:px-9">
                <p className="font-display text-xl leading-snug text-foreground sm:text-[1.75rem]">
                  Eu quero que você me conte o que você busca de melhoria na sua vida.
                </p>
                <p className="mt-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
                  <Eye className="h-4 w-4 shrink-0" /> Feche o olho por um segundo e pense:
                </p>
                <div className="mt-2 rounded-2xl border-2 border-dashed border-accent bg-accent/10 p-3 sm:p-6">
                  <p className="font-display text-2xl leading-tight text-foreground sm:text-4xl">
                    EU SERIA MAIS FELIZ SE:
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    <span className="flex gap-1.5">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:300ms]" />
                    </span>{" "}
                    complete só na sua cabeça
                  </p>
                </div>
                <p className="mt-4 text-base leading-normal text-muted-foreground">
                  Reflita alguns momentos nisso depois é só passar que colocamos alguns dos
                  principais pontos para te ajudar a lembrar (nenhuma das próximas é obrigatória, se
                  não fizer sentido para você, só pular no botão na parte mais baixa), mas você terá
                  como inserir novos:
                </p>
                <p className="mt-4 font-display text-xl leading-snug text-primary sm:text-4xl">
                  Vamos para a jornada da saúde?!
                </p>
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Para seguir clique abaixo
                </p>
              </div>
            </div>
          )}

          {currentImprovement &&
            (() => {
              const answer = data.improvements[currentImprovement.key];
              return (
                <>
                  <QuestionHeading
                    eyebrow="Melhorias que busco"
                    title={currentImprovement.title}
                    hint={currentImprovement.prompt}
                  />
                  <Textarea
                    maxLength={1000}
                    value={answer.detail}
                    disabled={answer.skipped}
                    onChange={(event) =>
                      updateImprovement(currentImprovement.key, { detail: event.target.value })
                    }
                    placeholder="Conte um pouco mais, se desejar..."
                    className="mb-7 min-h-28 rounded-xl border-2 p-4 text-lg shadow-none md:text-lg"
                  />
                  <p className="mb-3 text-base font-bold text-foreground">
                    Como você avalia esse aspecto hoje?
                  </p>
                  <ScorePicker
                    value={answer.score}
                    onChange={(score) =>
                      updateImprovement(currentImprovement.key, { score, skipped: false })
                    }
                  />
                  <SkipButton
                    selected={answer.skipped}
                    onClick={() =>
                      updateImprovement(currentImprovement.key, {
                        skipped: !answer.skipped,
                        score: null,
                        detail: answer.skipped ? answer.detail : "",
                      })
                    }
                  />
                </>
              );
            })()}

          {step === 17 && (
            <>
              <QuestionHeading
                eyebrow="Para completar"
                title="Existe outra melhoria que você busca?"
                hint="Este espaço é seu. Conte o que ainda não apareceu nas perguntas."
              />
              <Textarea
                autoFocus
                maxLength={2000}
                value={data.additionalOne}
                onChange={(event) => update("additionalOne", event.target.value)}
                placeholder="Escreva aqui, se desejar..."
                className="min-h-52 rounded-xl border-2 p-5 text-xl leading-relaxed shadow-none md:text-xl"
              />
            </>
          )}
          {step === 18 && (
            <>
              <QuestionHeading
                eyebrow="Última pergunta"
                title="Há algo mais que gostaria de acrescentar?"
                hint="Inclua qualquer informação que considere importante para seu cuidado."
              />
              <Textarea
                autoFocus
                maxLength={2000}
                value={data.additionalTwo}
                onChange={(event) => update("additionalTwo", event.target.value)}
                placeholder="Escreva aqui, se desejar..."
                className="min-h-52 rounded-xl border-2 p-5 text-xl leading-relaxed shadow-none md:text-xl"
              />
            </>
          )}

          {isReview && <Review data={data} onEdit={setStep} />}

          {isReview && turnstileSiteKey && (
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              onToken={setTurnstileToken}
              resetSignal={turnstileResetSignal}
            />
          )}

          <label
            className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
            aria-hidden="true"
          >
            Website
            <input
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </label>

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-lg bg-destructive/10 px-4 py-3 text-base font-semibold text-destructive"
            >
              {error}
            </p>
          )}
        </section>
        <div
          className={cn(
            "mt-auto flex items-center gap-3 pt-10",
            isTransition &&
              "sticky bottom-0 -mx-5 border-t border-border/70 bg-background/92 px-5 pb-5 pt-4 backdrop-blur sm:-mx-8 sm:px-8",
          )}
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => (step === 0 ? setStarted(false) : setStep((current) => current - 1))}
            className="h-14 w-14 shrink-0 rounded-xl p-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            onClick={isReview ? submit : next}
            disabled={submitting}
            className={cn(
              "h-14 flex-1 rounded-xl text-lg font-bold",
              isTransition && "bg-accent text-accent-foreground hover:bg-accent/90",
            )}
          >
            {submitting
              ? "Enviando..."
              : isReview
                ? "Enviar anamnese"
                : isTransition
                  ? "SEGUIR"
                  : "Salvar e continuar"}
            {!submitting &&
              (isReview ? <Check className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />)}
          </Button>
        </div>
      </div>
    </main>
  );
}

function QuestionHeading({
  eyebrow,
  title,
  hint,
}: {
  eyebrow: string;
  title: string;
  hint: string;
}) {
  return (
    <div className="mb-8">
      <p className="text-sm font-bold uppercase text-accent">{eyebrow}</p>
      <h1 className="mt-3 font-display text-3xl leading-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

function SkipButton({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn(
        "mt-5 h-12 w-full rounded-xl border-2 text-base shadow-none",
        selected && "border-primary bg-secondary text-primary",
      )}
    >
      {selected && <Check className="h-5 w-5" />}
      {selected ? "Marcado: não se aplica" : "Não se aplica"}
    </Button>
  );
}

function Review({ data, onEdit }: { data: HealthIntakeFormData; onEdit: (step: number) => void }) {
  const scored = improvementItems.filter((item) => data.improvements[item.key].score !== null);
  const average = scored.length
    ? (
        scored.reduce((sum, item) => sum + Number(data.improvements[item.key].score), 0) /
        scored.length
      ).toFixed(1)
    : "—";
  return (
    <div>
      <QuestionHeading
        eyebrow="Quase pronto"
        title="Revise suas respostas"
        hint="Confira os dados abaixo. Você pode voltar e corrigir antes de enviar."
      />
      <div className="space-y-3">
        <ReviewBlock
          title="Identificação"
          value={`${data.name} · ${data.age} anos${data.weight ? ` · ${data.weight} kg` : ""}\n${data.profession || "Profissão não informada"} · ${data.phone}`}
          onClick={() => onEdit(0)}
        />
        <ReviewBlock
          title="Queixa principal"
          value={`${data.complaint}${data.complaintDetails ? `\n${data.complaintDetails}` : ""}\nNota: ${data.complaintScore}`}
          onClick={() => onEdit(5)}
        />
        {data.expectations && (
          <ReviewBlock title="Expectativas" value={data.expectations} onClick={() => onEdit(7)} />
        )}
        <ReviewBlock
          title="Melhorias buscadas"
          value={`${scored.length} aspectos avaliados · média ${average}\n${
            improvementItems
              .filter((item) => data.improvements[item.key].detail)
              .map((item) => item.title)
              .join(" · ") || "Sem observações adicionais"
          }`}
          onClick={() => onEdit(10)}
        />
        {(data.additionalOne || data.additionalTwo) && (
          <ReviewBlock
            title="Observações finais"
            value={[data.additionalOne, data.additionalTwo].filter(Boolean).join("\n")}
            onClick={() => onEdit(17)}
          />
        )}
      </div>
      <div className="mt-6 flex items-start gap-3 rounded-xl bg-secondary p-4">
        <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm leading-relaxed text-secondary-foreground">
          Ao enviar, suas respostas ficarão disponíveis somente para a equipe responsável pela
          análise profissional.
        </p>
      </div>
    </div>
  );
}

function ReviewBlock({
  title,
  value,
  onClick,
}: {
  title: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 rounded-xl border border-border bg-card p-5">
      <div className="min-w-0">
        <p className="font-bold text-foreground">{title}</p>
        <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-muted-foreground">
          {value}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        aria-label={`Editar ${title}`}
        className="shrink-0"
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  );
}
