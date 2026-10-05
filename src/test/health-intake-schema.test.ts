import { describe, expect, it } from "vitest";

import {
  PRIVACY_NOTICE_VERSION,
  draftSchema,
  healthIntakeSubmissionSchema,
  type HealthIntakeFormData,
} from "@/lib/health-intake-schema";

const validIntake: HealthIntakeFormData = {
  name: "Maria de Fátima",
  age: "58",
  weight: "72,5",
  profession: "Professora",
  phone: "(11) 99999-9999",
  complaint: "Fadiga há dois meses.",
  complaintDetails: "",
  complaintScore: 4,
  expectations: "Ter mais disposição.",
  improvements: {
    skin: { detail: "", score: 6, skipped: false },
    memory: { detail: "", score: null, skipped: true },
    energy: { detail: "", score: 4, skipped: false },
    menopause: { detail: "", score: null, skipped: true },
    mobility: { detail: "", score: null, skipped: true },
    weight: { detail: "", score: null, skipped: true },
    exercise: { detail: "", score: null, skipped: true },
  },
  additionalOne: "",
  additionalTwo: "",
};

describe("health intake validation", () => {
  it("accepts a complete, bounded submission", () => {
    const result = healthIntakeSubmissionSchema.safeParse({
      intake: validIntake,
      privacyAcknowledged: true,
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      requestId: "9f0a78d2-38b1-44c4-88c5-da8eed595d19",
      turnstileToken: "",
      website: "",
    });

    expect(result.success).toBe(true);
  });

  it("rejects oversized health text", () => {
    const result = healthIntakeSubmissionSchema.safeParse({
      intake: { ...validIntake, complaint: "x".repeat(3001) },
      privacyAcknowledged: true,
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      requestId: "9f0a78d2-38b1-44c4-88c5-da8eed595d19",
      turnstileToken: "",
      website: "",
    });

    expect(result.success).toBe(false);
  });

  it("requires acknowledgement of the current privacy notice", () => {
    const result = healthIntakeSubmissionSchema.safeParse({
      intake: validIntake,
      privacyAcknowledged: false,
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      requestId: "9f0a78d2-38b1-44c4-88c5-da8eed595d19",
      turnstileToken: "",
      website: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an improvement without a score or explicit skip", () => {
    const result = healthIntakeSubmissionSchema.safeParse({
      intake: {
        ...validIntake,
        improvements: {
          ...validIntake.improvements,
          skin: { detail: "", score: null, skipped: false },
        },
      },
      privacyAcknowledged: true,
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      requestId: "9f0a78d2-38b1-44c4-88c5-da8eed595d19",
      turnstileToken: "",
      website: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an expired or malformed browser draft", () => {
    const result = draftSchema.safeParse({
      version: 2,
      savedAt: Date.now(),
      expiresAt: Date.now() - 1,
      step: 40,
      data: validIntake,
    });

    expect(result.success).toBe(false);
  });
});
