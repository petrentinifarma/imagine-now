import { describe, expect, it } from "vitest";
import { candidateSlots, freeSlots } from "@/lib/booking-rules";
import { PLANS, isValidCpf } from "@/lib/plans";

describe("booking rules", () => {
  // Monday 2026-11-23 06:00 Brasília = 09:00 UTC
  const now = Date.UTC(2026, 10, 23, 9, 0);
  it("offers no weekend slots", () => {
    for (const s of candidateSlots(now)) expect([0, 6]).not.toContain(new Date(s - 3 * 3600000).getUTCDay());
  });
  it("first slot respects 12h notice (Monday 18:00 is past hours, so Tuesday 09:00 Brasília)", () => {
    expect(new Date(candidateSlots(now)[0]!).toISOString()).toBe("2026-11-24T12:00:00.000Z");
  });
  it("removes a slot overlapping a busy event", () => {
    const busy = [{ start: Date.UTC(2026, 10, 24, 12, 30), end: Date.UTC(2026, 10, 24, 13, 0) }];
    expect(freeSlots(now, busy)).not.toContain(Date.UTC(2026, 10, 24, 12, 0));
  });
});

describe("plans", () => {
  it("all prices are at least R$ 5", () => PLANS.forEach((p) => expect(p.amountCents).toBeGreaterThanOrEqual(500)));
  it("validates CPF check digits", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
  });
});
