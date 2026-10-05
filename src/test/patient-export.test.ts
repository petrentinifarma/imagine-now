import { describe, expect, it } from "vitest";

import { normalizePatientPhone, patientWorkbookFilename } from "@/lib/patient-export";

describe("normalizePatientPhone", () => {
  it("recognizes the same Brazilian phone with different formatting", () => {
    expect(normalizePatientPhone("+55 (11) 99999-0000")).toBe("11999990000");
    expect(normalizePatientPhone("11 99999-0000")).toBe("11999990000");
  });
});

describe("patientWorkbookFilename", () => {
  it("uses the patient name as the Excel filename", () => {
    expect(patientWorkbookFilename("Maria da Silva")).toBe("Maria da Silva.xlsx");
  });

  it("keeps accents and removes only unsafe filename characters", () => {
    expect(patientWorkbookFilename("  João: Pedro / Trentini?  ")).toBe("João Pedro Trentini.xlsx");
  });

  it("uses a safe fallback for blank or reserved names", () => {
    expect(patientWorkbookFilename("  ")).toBe("Paciente.xlsx");
    expect(patientWorkbookFilename("CON")).toBe("Paciente.xlsx");
  });
});
