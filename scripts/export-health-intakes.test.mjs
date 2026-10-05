import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExportData,
  buildWorkbookModel,
  createWorkbookBuffer,
  normalizeBrazilianPhone,
} from "./export-health-intakes.mjs";

function assessment(overrides = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    request_id: "00000000-0000-4000-8000-000000000011",
    created_at: "2026-01-10T12:00:00.000Z",
    patient_name: "Maria da Silva",
    age: 58,
    weight_kg: 72.5,
    profession: "Professora",
    phone: "+55 (11) 99999-0000",
    main_complaint: "Cansaço",
    complaint_details: "Mais intenso à tarde",
    complaint_score: 8,
    pain_average: null,
    health_average: 5,
    improvement_answers: {
      goals: {
        skin: { detail: "Ressecamento", score: 4, skipped: false },
        memory: { detail: "Esquecimentos", score: 5, skipped: false },
        energy: { detail: "Pouca energia", score: 3, skipped: false },
        menopause: { detail: "", score: null, skipped: true },
        mobility: { detail: "", score: 7, skipped: false },
        weight: { detail: "", score: 4, skipped: false },
        exercise: { detail: "", score: 2, skipped: false },
      },
      expectations: "Ter mais disposição",
      additional_notes: ["Dormindo melhor"],
    },
    privacy_notice_version: "2026-10-04",
    privacy_acknowledged_at: "2026-01-10T11:59:00.000Z",
    ...overrides,
  };
}

function storedZipEntries(buffer) {
  const entries = new Map();
  let offset = 0;
  while (offset + 4 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    entries.set(name, buffer.subarray(dataStart, dataStart + compressedSize).toString("utf8"));
    offset = dataStart + compressedSize;
  }
  return entries;
}

test("normaliza telefone brasileiro com ou sem código do país", () => {
  assert.equal(normalizeBrazilianPhone("+55 (11) 99999-0000"), "11999990000");
  assert.equal(normalizeBrazilianPhone("11 99999-0000"), "11999990000");
});

test("agrupa avaliações do mesmo paciente e calcula evolução", () => {
  const first = assessment();
  const second = assessment({
    id: "00000000-0000-4000-8000-000000000002",
    request_id: "00000000-0000-4000-8000-000000000012",
    created_at: "2026-03-10T12:00:00.000Z",
    phone: "11 99999-0000",
    complaint_score: 5,
    health_average: 7,
    weight_kg: 70,
  });
  const anotherPatient = assessment({
    id: "00000000-0000-4000-8000-000000000003",
    request_id: "00000000-0000-4000-8000-000000000013",
    patient_name: "Ana Souza",
    phone: "11 98888-0000",
  });

  const data = buildExportData([second, anotherPatient, first]);
  assert.equal(data.summaries.length, 2);
  const maria = data.summaries.find((row) => row.patient_name === "Maria da Silva");
  assert.equal(maria.evaluations, 2);
  assert.equal(maria.months_with_evaluation, 2);
  assert.equal(maria.complaint_change, -3);
  assert.equal(maria.health_change, 2);
  assert.equal(maria.weight_change, -2.5);

  const mariaEvolution = data.evolution.filter((row) => row.patient_code === maria.patient_code);
  assert.deepEqual(
    mariaEvolution.map((row) => row.evaluation_number),
    [1, 2],
  );
  assert.equal(mariaEvolution[1].complaint_delta, -3);
  assert.equal(mariaEvolution[1].health_delta, 2);

  const patientSheet = buildWorkbookModel([first, second], new Date("2026-03-10T15:00:00.000Z"))[0];
  assert.equal(
    patientSheet.rows.find((row) => row.field === "Número de avaliações reunidas").value,
    2,
  );
  assert.equal(
    patientSheet.rows.find((row) => row.field === "Nota atual da queixa (0–10)").value,
    5,
  );
});

test("gera um XLSX editável com ficha vertical e texto do paciente sem fórmula", () => {
  const formulaLikeText = '=HYPERLINK("https://example.invalid","abrir")';
  const record = assessment({ main_complaint: formulaLikeText });
  const generatedAt = new Date("2026-10-04T15:30:00.000Z");
  const workbook = createWorkbookBuffer([record], generatedAt);
  assert.equal(workbook.subarray(0, 2).toString("ascii"), "PK");

  const entries = storedZipEntries(workbook);
  assert.ok(entries.has("[Content_Types].xml"));
  assert.ok(entries.has("xl/styles.xml"));
  assert.equal([...entries.keys()].filter((name) => name.startsWith("xl/worksheets/")).length, 5);
  assert.match(entries.get("xl/workbook.xml"), /name="Ficha"/);
  assert.match(entries.get("xl/workbook.xml"), /name="Resumo"/);
  assert.match(entries.get("xl/workbook.xml"), /name="Evolução"/);
  assert.match(entries.get("xl/workbook.xml"), /name="Avaliações"/);
  assert.match(entries.get("xl/workbook.xml"), /name="Leia-me"/);

  const mobileSheet = entries.get("xl/worksheets/sheet1.xml");
  assert.ok(mobileSheet.includes("Ficha atual do paciente"));
  assert.ok(mobileSheet.includes("Ter mais disposição"));
  assert.ok(mobileSheet.includes('activeCell="A5"'));

  const rawSheet = entries.get("xl/worksheets/sheet4.xml");
  assert.ok(rawSheet.includes("=HYPERLINK("));
  assert.ok(!rawSheet.includes("<f>HYPERLINK("));
  assert.ok(rawSheet.includes('t="inlineStr"'));

  const model = buildWorkbookModel([record], generatedAt);
  assert.equal(
    model[4].rows
      .find((row) => row.topic === "Acesso do paciente")
      .guidance.includes("não fica disponível"),
    true,
  );
  assert.equal(model[0].name, "Ficha");
  assert.equal(
    model[0].rows.find((row) => row.field === "Queixa principal").value,
    formulaLikeText,
  );
});
