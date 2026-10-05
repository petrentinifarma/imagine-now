import { z } from "zod";

export const PRIVACY_NOTICE_VERSION = "2026-10-04";
export const DRAFT_STORAGE_KEY = "anamnese-pedro-trentini-v3";
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export const improvementKeys = [
  "skin",
  "memory",
  "energy",
  "menopause",
  "mobility",
  "weight",
  "exercise",
] as const;

export type ImprovementKey = (typeof improvementKeys)[number];
export type ImprovementAnswer = {
  detail: string;
  score: number | null;
  skipped: boolean;
};

export type HealthIntakeFormData = {
  name: string;
  age: string;
  weight: string;
  profession: string;
  phone: string;
  complaint: string;
  complaintDetails: string;
  complaintScore: number | null;
  expectations: string;
  improvements: Record<ImprovementKey, ImprovementAnswer>;
  additionalOne: string;
  additionalTwo: string;
};

const scoreSchema = z.number().int().min(0).max(10).nullable();

const improvementAnswerSchema = z
  .object({
    detail: z.string().trim().max(1000),
    score: scoreSchema,
    skipped: z.boolean(),
  })
  .superRefine((answer, context) => {
    if (!answer.skipped && answer.score === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Escolha uma nota ou marque “Não se aplica”.",
        path: ["score"],
      });
    }
  });

const draftImprovementAnswerSchema = z.object({
  detail: z.string().max(1000),
  score: scoreSchema,
  skipped: z.boolean(),
});

const improvementsSchema = z.object({
  skin: improvementAnswerSchema,
  memory: improvementAnswerSchema,
  energy: improvementAnswerSchema,
  menopause: improvementAnswerSchema,
  mobility: improvementAnswerSchema,
  weight: improvementAnswerSchema,
  exercise: improvementAnswerSchema,
});

const draftImprovementsSchema = z.object({
  skin: draftImprovementAnswerSchema,
  memory: draftImprovementAnswerSchema,
  energy: draftImprovementAnswerSchema,
  menopause: draftImprovementAnswerSchema,
  mobility: draftImprovementAnswerSchema,
  weight: draftImprovementAnswerSchema,
  exercise: draftImprovementAnswerSchema,
});

const localizedWeightSchema = z
  .string()
  .trim()
  .max(10)
  .refine((value) => value === "" || /^\d{1,3}(?:[.,]\d{1,2})?$/.test(value), {
    message: "Informe o peso usando apenas números, vírgula ou ponto.",
  })
  .refine((value) => {
    if (value === "") return true;
    const parsed = Number(value.replace(",", "."));
    return parsed > 0 && parsed <= 400;
  }, "Confira o peso informado.");

export const healthIntakeFormSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(120),
  age: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, "Informe a idade em anos.")
    .refine((value) => Number(value) >= 18 && Number(value) <= 120, {
      message: "Informe uma idade válida entre 18 e 120 anos.",
    }),
  weight: localizedWeightSchema,
  profession: z.string().trim().max(120),
  phone: z
    .string()
    .trim()
    .min(8)
    .max(24)
    .refine((value) => /^\d{8,15}$/.test(value.replace(/\D/g, "")), {
      message: "Informe um telefone válido.",
    }),
  complaint: z.string().trim().min(3).max(3000),
  complaintDetails: z.string().trim().max(3000),
  complaintScore: z.number().int().min(0).max(10),
  expectations: z.string().trim().max(3000),
  improvements: improvementsSchema,
  additionalOne: z.string().trim().max(2000),
  additionalTwo: z.string().trim().max(2000),
});

export const draftFormDataSchema = z.object({
  name: z.string().max(120),
  age: z.string().max(3),
  weight: z.string().max(10),
  profession: z.string().max(120),
  phone: z.string().max(24),
  complaint: z.string().max(3000),
  complaintDetails: z.string().max(3000),
  complaintScore: scoreSchema,
  expectations: z.string().max(3000),
  improvements: draftImprovementsSchema,
  additionalOne: z.string().max(2000),
  additionalTwo: z.string().max(2000),
});

export const healthIntakeSubmissionSchema = z.object({
  intake: healthIntakeFormSchema,
  privacyAcknowledged: z.literal(true),
  privacyNoticeVersion: z.literal(PRIVACY_NOTICE_VERSION),
  requestId: z.string().uuid(),
  turnstileToken: z.string().max(2048),
  website: z.string().max(200),
});

export type HealthIntakeSubmission = z.infer<typeof healthIntakeSubmissionSchema>;

export const draftSchema = z.object({
  version: z.literal(3),
  savedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  step: z.number().int().min(0).max(19),
  data: draftFormDataSchema,
});

export function parseWeight(value: string): number | null {
  return value.trim() ? Number(value.replace(",", ".")) : null;
}
