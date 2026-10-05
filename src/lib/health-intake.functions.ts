import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

import {
  healthIntakeSubmissionSchema,
  improvementKeys,
  parseWeight,
} from "@/lib/health-intake-schema";

type SubmissionResult =
  | { ok: true }
  | {
      ok: false;
      code: "invalid" | "rate_limited" | "captcha" | "unavailable";
    };

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyTurnstile(token: string, remoteIp?: string): Promise<boolean> {
  const secret = process.env["TURNSTILE_SECRET_KEY"];

  // The database-backed rate limit and honeypot remain active without Turnstile.
  // Configure both VITE_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY in Lovable
  // Cloud to enable the additional challenge.
  if (!secret) return true;
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return false;

    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch (error) {
    console.error("Turnstile verification failed", error);
    return false;
  }
}

export const submitHealthIntake = createServerFn({ method: "POST" })
  .validator((input: unknown) => healthIntakeSubmissionSchema.parse(input))
  .handler(async ({ data }): Promise<SubmissionResult> => {
    // This field is visually hidden. Bots that autofill it are rejected without
    // revealing why, while people never interact with it.
    if (data.website !== "") return { ok: false, code: "invalid" };

    const remoteIp = getRequestIP({ xForwardedFor: true });
    const userAgent = getRequestHeader("user-agent")?.slice(0, 200) ?? "unknown";
    const dayBucket = new Date().toISOString().slice(0, 10);
    const fingerprintSecret =
      process.env["RATE_LIMIT_HASH_SECRET"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!fingerprintSecret) return { ok: false, code: "unavailable" };
    const fingerprint = await sha256(
      `${fingerprintSecret}|${remoteIp ?? "unknown"}|${userAgent}|${dayBucket}`,
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: attemptAllowed, error: attemptError } = await supabaseAdmin.rpc(
      "register_health_intake_attempt",
      { p_ip_hash: fingerprint },
    );

    if (attemptError) {
      console.error("Health intake rate-limit check failed", attemptError);
      return { ok: false, code: "unavailable" };
    }

    if (!attemptAllowed) return { ok: false, code: "rate_limited" };

    if (!(await verifyTurnstile(data.turnstileToken, remoteIp))) {
      return { ok: false, code: "captcha" };
    }

    const scores = improvementKeys
      .map((key) => data.intake.improvements[key].score)
      .filter((score): score is number => score !== null);
    const healthAverage = scores.length
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : null;

    const { error: submitError } = await supabaseAdmin.from("health_intakes").insert({
      request_id: data.requestId,
      patient_name: data.intake.name.trim(),
      age: Number(data.intake.age),
      weight_kg: parseWeight(data.intake.weight),
      profession: data.intake.profession.trim() || null,
      phone: data.intake.phone.trim(),
      main_complaint: data.intake.complaint.trim(),
      complaint_details: data.intake.complaintDetails.trim() || null,
      complaint_score: data.intake.complaintScore,
      improvement_answers: {
        goals: data.intake.improvements,
        expectations: data.intake.expectations.trim() || null,
        additional_notes: [data.intake.additionalOne, data.intake.additionalTwo]
          .map((note) => note.trim())
          .filter(Boolean),
      },
      pain_average: null,
      health_average: healthAverage,
      privacy_notice_version: data.privacyNoticeVersion,
      privacy_acknowledged_at: new Date().toISOString(),
    });

    // Retrying the same request after a network interruption must not create a
    // duplicate patient record.
    if (submitError?.code === "23505") return { ok: true };

    if (submitError) {
      console.error("Health intake submission failed", submitError);
      return { ok: false, code: "unavailable" };
    }

    return { ok: true };
  });
