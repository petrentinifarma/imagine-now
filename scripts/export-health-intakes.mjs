import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const IMPROVEMENT_FIELDS = [
  ["skin", "Pele"],
  ["memory", "Memória"],
  ["energy", "Energia"],
  ["menopause", "Menopausa"],
  ["mobility", "Mobilidade"],
  ["weight", "Controle de peso"],
  ["exercise", "Exercício físico"],
];

const textColumn = (header, key, width = 18) => ({ header, key, width, style: "text" });
const numberColumn = (header, key, width = 16, style = "decimal") => ({
  header,
  key,
  width,
  style,
});

function normalizeText(value) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeBrazilianPhone(value) {
  const digits = normalizeText(value).replace(/\D/g, "");
  return digits.startsWith("55") && (digits.length === 12 || digits.length === 13)
    ? digits.slice(2)
    : digits;
}

function normalizedName(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function patientIdentity(record) {
  const phone = normalizeBrazilianPhone(record.phone);
  const groupingKey = phone
    ? `phone:${phone}`
    : `fallback:${normalizedName(record.patient_name)}:${record.age ?? ""}`;
  const code = createHash("sha256").update(groupingKey).digest("hex").slice(0, 12).toUpperCase();
  return { code: `P-${code}`, groupingKey, phone };
}

function improvementAnswers(record) {
  const answers = record?.improvement_answers;
  return answers && typeof answers === "object" && !Array.isArray(answers) ? answers : {};
}

function goalAnswer(record, key) {
  const goals = improvementAnswers(record).goals;
  const answer = goals && typeof goals === "object" && !Array.isArray(goals) ? goals[key] : null;
  return answer && typeof answer === "object" && !Array.isArray(answer) ? answer : {};
}

function expectations(record) {
  return normalizeText(improvementAnswers(record).expectations);
}

function additionalNotes(record) {
  const notes = improvementAnswers(record).additional_notes;
  return Array.isArray(notes) ? notes.map(normalizeText).filter(Boolean) : [];
}

function delta(current, previous) {
  return current === null || previous === null ? null : current - previous;
}

function dateSortValue(record) {
  return validDate(record.created_at)?.getTime() ?? 0;
}

function monthKey(date) {
  if (!date) return "";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function daysBetween(current, first) {
  if (!current || !first) return null;
  return Math.floor((current.getTime() - first.getTime()) / 86_400_000);
}

function evaluationRow(record, patientCode, evaluationNumber, firstDate, previous) {
  const createdAt = validDate(record.created_at);
  const complaint = finiteNumber(record.complaint_score);
  const health = finiteNumber(record.health_average);
  const weight = finiteNumber(record.weight_kg);

  const row = {
    patient_code: patientCode,
    patient_name: normalizeText(record.patient_name),
    phone: normalizeText(record.phone),
    created_at: createdAt,
    month: monthKey(createdAt),
    evaluation_number: evaluationNumber,
    days_since_first: daysBetween(createdAt, firstDate),
    complaint_score: complaint,
    complaint_delta: delta(complaint, previous?.complaint ?? null),
    health_average: health,
    health_delta: delta(health, previous?.health ?? null),
    weight_kg: weight,
    weight_delta: delta(weight, previous?.weight ?? null),
  };

  for (const [key] of IMPROVEMENT_FIELDS) {
    row[`${key}_score`] = finiteNumber(goalAnswer(record, key).score);
  }

  return row;
}

function rawRow(record) {
  const identity = patientIdentity(record);
  const row = {
    id: normalizeText(record.id),
    request_id: normalizeText(record.request_id),
    created_at: validDate(record.created_at),
    patient_code: identity.code,
    patient_name: normalizeText(record.patient_name),
    age: finiteNumber(record.age),
    weight_kg: finiteNumber(record.weight_kg),
    profession: normalizeText(record.profession),
    phone: normalizeText(record.phone),
    normalized_phone: identity.phone,
    main_complaint: normalizeText(record.main_complaint),
    complaint_details: normalizeText(record.complaint_details),
    complaint_score: finiteNumber(record.complaint_score),
    pain_average: finiteNumber(record.pain_average),
    health_average: finiteNumber(record.health_average),
    expectations: expectations(record),
    additional_notes: additionalNotes(record).join(" | "),
    privacy_notice_version: normalizeText(record.privacy_notice_version),
    privacy_acknowledged_at: validDate(record.privacy_acknowledged_at),
    improvement_answers_json: JSON.stringify(record.improvement_answers ?? {}),
  };

  for (const [key] of IMPROVEMENT_FIELDS) {
    const answer = goalAnswer(record, key);
    row[`${key}_detail`] = normalizeText(answer.detail);
    row[`${key}_score`] = finiteNumber(answer.score);
    row[`${key}_skipped`] = answer.skipped === true ? "Sim" : "Não";
  }

  return row;
}

export function buildExportData(records) {
  const sorted = [...records].sort((left, right) => dateSortValue(left) - dateSortValue(right));
  const groups = new Map();

  for (const record of sorted) {
    const identity = patientIdentity(record);
    const group = groups.get(identity.groupingKey) ?? { identity, records: [] };
    group.records.push(record);
    groups.set(identity.groupingKey, group);
  }

  const summaries = [];
  const evolution = [];

  for (const { identity, records: patientRecords } of groups.values()) {
    const first = patientRecords[0];
    const current = patientRecords.at(-1);
    const firstDate = validDate(first.created_at);
    const currentDate = validDate(current.created_at);
    let previous = null;

    patientRecords.forEach((record, index) => {
      const row = evaluationRow(record, identity.code, index + 1, firstDate, previous);
      evolution.push(row);
      previous = {
        complaint: row.complaint_score,
        health: row.health_average,
        weight: row.weight_kg,
      };
    });

    const firstComplaint = finiteNumber(first.complaint_score);
    const currentComplaint = finiteNumber(current.complaint_score);
    const firstHealth = finiteNumber(first.health_average);
    const currentHealth = finiteNumber(current.health_average);
    const firstWeight = finiteNumber(first.weight_kg);
    const currentWeight = finiteNumber(current.weight_kg);

    summaries.push({
      patient_code: identity.code,
      patient_name: normalizeText(current.patient_name),
      phone: normalizeText(current.phone),
      evaluations: patientRecords.length,
      first_evaluation: firstDate,
      latest_evaluation: currentDate,
      months_with_evaluation: new Set(
        patientRecords.map((record) => monthKey(validDate(record.created_at))),
      ).size,
      initial_complaint: firstComplaint,
      current_complaint: currentComplaint,
      complaint_change: delta(currentComplaint, firstComplaint),
      initial_health: firstHealth,
      current_health: currentHealth,
      health_change: delta(currentHealth, firstHealth),
      initial_weight: firstWeight,
      current_weight: currentWeight,
      weight_change: delta(currentWeight, firstWeight),
    });
  }

  summaries.sort((left, right) => left.patient_name.localeCompare(right.patient_name, "pt-BR"));

  return { summaries, evolution, raw: sorted.map(rawRow) };
}

function summaryColumns() {
  return [
    textColumn("Código do paciente", "patient_code", 20),
    textColumn("Paciente", "patient_name", 28),
    textColumn("Telefone", "phone", 18),
    numberColumn("Nº de avaliações", "evaluations", 16, "integer"),
    { header: "Primeira avaliação", key: "first_evaluation", width: 19, style: "date" },
    { header: "Última avaliação", key: "latest_evaluation", width: 19, style: "date" },
    numberColumn("Meses com avaliação", "months_with_evaluation", 19, "integer"),
    numberColumn("Queixa inicial (0–10)", "initial_complaint", 20),
    numberColumn("Queixa atual (0–10)", "current_complaint", 19),
    numberColumn("Variação da queixa", "complaint_change", 19),
    numberColumn("Saúde inicial (0–10)", "initial_health", 20),
    numberColumn("Saúde atual (0–10)", "current_health", 19),
    numberColumn("Variação da saúde", "health_change", 19),
    numberColumn("Peso inicial (kg)", "initial_weight", 18),
    numberColumn("Peso atual (kg)", "current_weight", 17),
    numberColumn("Variação do peso (kg)", "weight_change", 21),
  ];
}

function evolutionColumns() {
  return [
    textColumn("Código do paciente", "patient_code", 20),
    textColumn("Paciente", "patient_name", 28),
    textColumn("Telefone", "phone", 18),
    { header: "Data da avaliação", key: "created_at", width: 20, style: "date" },
    textColumn("Mês", "month", 12),
    numberColumn("Nº da avaliação", "evaluation_number", 16, "integer"),
    numberColumn("Dias desde a primeira", "days_since_first", 20, "integer"),
    numberColumn("Queixa (0–10)", "complaint_score", 16),
    numberColumn("Δ queixa vs. anterior", "complaint_delta", 20),
    numberColumn("Média de saúde (0–10)", "health_average", 22),
    numberColumn("Δ saúde vs. anterior", "health_delta", 20),
    numberColumn("Peso (kg)", "weight_kg", 14),
    numberColumn("Δ peso vs. anterior", "weight_delta", 19),
    ...IMPROVEMENT_FIELDS.map(([key, label]) =>
      numberColumn(`${label} (0–10)`, `${key}_score`, Math.max(16, label.length + 8)),
    ),
  ];
}

function rawColumns() {
  const columns = [
    textColumn("ID do registro", "id", 38),
    textColumn("ID da solicitação", "request_id", 38),
    { header: "Data de envio", key: "created_at", width: 20, style: "date" },
    textColumn("Código do paciente", "patient_code", 20),
    textColumn("Paciente", "patient_name", 28),
    numberColumn("Idade", "age", 10, "integer"),
    numberColumn("Peso (kg)", "weight_kg", 14),
    textColumn("Profissão", "profession", 24),
    textColumn("Telefone informado", "phone", 20),
    textColumn("Telefone normalizado", "normalized_phone", 20),
    textColumn("Queixa principal", "main_complaint", 42),
    textColumn("Detalhes da queixa", "complaint_details", 42),
    numberColumn("Nota da queixa (0–10)", "complaint_score", 22),
    numberColumn("Média de dor", "pain_average", 16),
    numberColumn("Média de saúde", "health_average", 17),
    textColumn("Expectativas", "expectations", 42),
    textColumn("Observações adicionais", "additional_notes", 42),
  ];

  for (const [key, label] of IMPROVEMENT_FIELDS) {
    columns.push(
      textColumn(`${label} — detalhes`, `${key}_detail`, 36),
      numberColumn(`${label} — nota`, `${key}_score`, 18),
      textColumn(`${label} — não se aplica`, `${key}_skipped`, 22),
    );
  }

  columns.push(
    textColumn("Versão do aviso de privacidade", "privacy_notice_version", 28),
    {
      header: "Aceite de privacidade em",
      key: "privacy_acknowledged_at",
      width: 23,
      style: "date",
    },
    textColumn("Respostas completas (JSON)", "improvement_answers_json", 60),
  );

  return columns;
}

function readmeRows(generatedAt, recordCount) {
  return [
    {
      topic: "Finalidade",
      guidance:
        "Arquivo privado para análise profissional e comparação longitudinal das avaliações.",
    },
    {
      topic: "Confidencialidade",
      guidance:
        "Contém dados pessoais e de saúde. Mantenha o arquivo em local protegido e não o compartilhe com pessoas não autorizadas.",
    },
    {
      topic: "Acesso do paciente",
      guidance:
        "O paciente apenas preenche e envia o formulário. Esta exportação não fica disponível na área pública.",
    },
    {
      topic: "Agrupamento",
      guidance:
        "Avaliações com o mesmo telefone normalizado são tratadas como pertencentes ao mesmo paciente.",
    },
    {
      topic: "Mudança de telefone",
      guidance:
        "Se o paciente mudar de telefone, confira e concilie manualmente os registros antes de comparar a evolução.",
    },
    {
      topic: "Variações",
      guidance:
        "Os campos de variação representam valor atual menos valor anterior ou inicial. A planilha não classifica melhora ou piora.",
    },
    {
      topic: "Uso clínico",
      guidance:
        "A planilha organiza as respostas; não produz diagnóstico nem substitui avaliação e decisão profissional.",
    },
    {
      topic: "Atualização",
      guidance:
        "Execute novamente o comando após novos envios para gerar uma exportação atualizada.",
    },
    { topic: "Gerado em", guidance: generatedAt },
    { topic: "Registros exportados", guidance: recordCount },
  ];
}

export function buildWorkbookModel(records, generatedAt = new Date()) {
  const { summaries, evolution, raw } = buildExportData(records);
  const generatedLabel = generatedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return [
    {
      name: "Resumo",
      title: "Resumo longitudinal por paciente",
      note: `Gerado em ${generatedLabel}. Variações = valor atual menos valor inicial.`,
      columns: summaryColumns(),
      rows: summaries,
    },
    {
      name: "Evolução",
      title: "Evolução entre avaliações",
      note: "Cada linha é uma avaliação. Δ = valor desta avaliação menos o da avaliação anterior.",
      columns: evolutionColumns(),
      rows: evolution,
    },
    {
      name: "Avaliações",
      title: "Dados completos das avaliações",
      note: "Base bruta preservada para conferência. Não altere esta aba ao fazer análises comparativas.",
      columns: rawColumns(),
      rows: raw,
    },
    {
      name: "Leia-me",
      title: "Como usar esta exportação privada",
      note: "Documento administrativo confidencial — não disponível ao paciente.",
      columns: [textColumn("Item", "topic", 26), textColumn("Orientação", "guidance", 96)],
      rows: readmeRows(generatedAt, records.length),
    },
  ];
}

function sanitizeXml(value) {
  return normalizeText(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnName(index) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function excelDateSerial(date) {
  return date.getTime() / 86_400_000 + 25_569;
}

function styleIndex(style) {
  return { title: 1, header: 2, date: 3, decimal: 4, integer: 5, text: 6, note: 7 }[style];
}

function cellXml(reference, value, style = "text") {
  if (value === null || value === undefined || value === "") return "";
  const styleAttribute = ` s="${styleIndex(style) ?? 0}"`;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `<c r="${reference}"${styleAttribute}><v>${excelDateSerial(value)}</v></c>`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${reference}"${styleAttribute}><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r="${reference}"${styleAttribute} t="b"><v>${value ? 1 : 0}</v></c>`;
  }

  // Inline strings prevent values beginning with =, +, - or @ from being
  // interpreted as formulas when patient-entered text is exported.
  return `<c r="${reference}"${styleAttribute} t="inlineStr"><is><t xml:space="preserve">${sanitizeXml(value)}</t></is></c>`;
}

function worksheetXml(sheet) {
  const lastColumn = columnName(Math.max(sheet.columns.length - 1, 0));
  const lastRow = Math.max(sheet.rows.length + 4, 4);
  const widths = sheet.columns
    .map(
      (column, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`,
    )
    .join("");
  const title = cellXml("A1", sheet.title, "title");
  const note = cellXml("A2", sheet.note, "note");
  const headers = sheet.columns
    .map((column, index) => cellXml(`${columnName(index)}4`, column.header, "header"))
    .join("");
  const dataRows = sheet.rows
    .map((row, rowIndex) => {
      const excelRow = rowIndex + 5;
      const cells = sheet.columns
        .map((column, columnIndex) =>
          cellXml(`${columnName(columnIndex)}${excelRow}`, row[column.key], column.style),
        )
        .join("");
      return `<row r="${excelRow}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><outlinePr summaryBelow="1" summaryRight="1"/><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${widths}</cols>
  <sheetData>
    <row r="1" ht="28" customHeight="1">${title}</row>
    <row r="2" ht="34" customHeight="1">${note}</row>
    <row r="3"/>
    <row r="4" ht="36" customHeight="1">${headers}</row>
    ${dataRows}
  </sheetData>
  <mergeCells count="2"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastColumn}2"/></mergeCells>
  <autoFilter ref="A4:${lastColumn}${lastRow}"/>
  <pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
}

function workbookXml(sheets) {
  const sheetNodes = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${sanitizeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView xWindow="120" yWindow="60" windowWidth="24000" windowHeight="12000"/></bookViews>
  <sheets>${sheetNodes}</sheets>
  <calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`;
}

function workbookRelationships(sheets) {
  const worksheetRelationships = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${worksheetRelationships}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function contentTypes(sheets) {
  const worksheetOverrides = sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  ${worksheetOverrides}
</Types>`;
}

const ROOT_RELATIONSHIPS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/><numFmt numFmtId="165" formatCode="0.00"/></numFmts>
  <fonts count="3">
    <font><sz val="11"/><name val="Aptos"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="15"/><name val="Aptos Display"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/><family val="2"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF173B57"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF2E7D73"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD9E2E8"/></left><right style="thin"><color rgb="FFD9E2E8"/></right><top style="thin"><color rgb="FFD9E2E8"/></top><bottom style="thin"><color rgb="FFD9E2E8"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment vertical="top"/></xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment vertical="top"/></xf>
    <xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment vertical="top"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(entries, generatedAt) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { time, day } = dosDateTime(generatedAt);

  for (const [name, value] of entries) {
    const nameBuffer = Buffer.from(name, "utf8");
    const dataBuffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
    const checksum = crc32(dataBuffer);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(day, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, dataBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(day, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + dataBuffer.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

export function createWorkbookBuffer(records, generatedAt = new Date()) {
  const sheets = buildWorkbookModel(records, generatedAt);
  const timestamp = generatedAt.toISOString();
  const entries = [
    ["[Content_Types].xml", contentTypes(sheets)],
    ["_rels/.rels", ROOT_RELATIONSHIPS],
    [
      "docProps/core.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Exportação privada de anamneses</dc:title><dc:creator>Imagine Now</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified></cp:coreProperties>`,
    ],
    [
      "docProps/app.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Imagine Now</Application><DocSecurity>0</DocSecurity><AppVersion>1.0</AppVersion></Properties>`,
    ],
    ["xl/workbook.xml", workbookXml(sheets)],
    ["xl/_rels/workbook.xml.rels", workbookRelationships(sheets)],
    ["xl/styles.xml", STYLES],
    ...sheets.map((sheet, index) => [`xl/worksheets/sheet${index + 1}.xml`, worksheetXml(sheet)]),
  ];
  return zipStore(entries, generatedAt);
}

async function fetchAllHealthIntakes(url, serviceRoleKey) {
  const client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const pageSize = 1_000;
  const records = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("health_intakes")
      .select("*")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Não foi possível consultar as avaliações: ${error.message}`);
    records.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  return records;
}

function defaultOutputPath(date = new Date()) {
  const stamp = date
    .toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" })
    .replace(" ", "-")
    .replace(/:/g, "");
  return `private-exports/anamneses-${stamp}.xlsx`;
}

function parseArguments(argumentsList) {
  if (argumentsList.includes("--help") || argumentsList.includes("-h")) return { help: true };
  const outputIndex = argumentsList.indexOf("--output");
  if (outputIndex >= 0 && !argumentsList[outputIndex + 1]) {
    throw new Error("Informe um caminho após --output.");
  }
  return { help: false, output: outputIndex >= 0 ? argumentsList[outputIndex + 1] : null };
}

function printHelp() {
  console.log(`Exporta todas as anamneses para um Excel privado e editável.

Uso:
  npm run export:health-intakes
  npm run export:health-intakes -- --output caminho/arquivo.xlsx

Variáveis de ambiente obrigatórias:
  SUPABASE_URL (ou VITE_SUPABASE_URL)
  SUPABASE_SERVICE_ROLE_KEY`);
}

export async function runExport(argumentsList = process.argv.slice(2)) {
  const options = parseArguments(argumentsList);
  if (options.help) {
    printHelp();
    return null;
  }

  for (const envFile of [".env", ".env.export.local"]) {
    try {
      process.loadEnvFile?.(envFile);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Configure SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY no ambiente administrativo.",
    );
  }

  const generatedAt = new Date();
  const records = await fetchAllHealthIntakes(url, serviceRoleKey);
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname, resolve } = await import("node:path");
  const outputPath = resolve(options.output ?? defaultOutputPath(generatedAt));
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, createWorkbookBuffer(records, generatedAt));
  console.log(`Exportação concluída: ${records.length} avaliação(ões).`);
  console.log(`Arquivo privado: ${outputPath}`);
  return outputPath;
}

const isDirectExecution = process.argv[1]
  ?.replace(/\\/g, "/")
  .endsWith("/scripts/export-health-intakes.mjs");

if (isDirectExecution) {
  runExport().catch((error) => {
    console.error(`Falha na exportação: ${error.message}`);
    process.exitCode = 1;
  });
}
