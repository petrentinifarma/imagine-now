import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizePatientPhone, patientWorkbookFilename } from "@/lib/patient-export";

const EXPORT_BUCKET = "health-intake-exports";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const SIGNED_LINK_SECONDS = 60 * 60;

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function ensurePrivateExportBucket(): Promise<void> {
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
  if (listError) throw new Error(`Não foi possível conferir o armazenamento: ${listError.message}`);
  const existingBucket = buckets.find((bucket) => bucket.name === EXPORT_BUCKET);
  if (existingBucket?.public) {
    throw new Error("O armazenamento de exportações existe, mas está público. Torne-o privado.");
  }
  if (existingBucket) return;

  const { error: createError } = await supabaseAdmin.storage.createBucket(EXPORT_BUCKET, {
    public: false,
    fileSizeLimit: 20 * 1024 * 1024,
    allowedMimeTypes: [XLSX_MIME],
  });
  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw new Error(`Não foi possível criar o armazenamento privado: ${createError.message}`);
  }
}

async function sendPrivateDownloadEmail(input: {
  patientName: string;
  filename: string;
  signedUrl: string;
  evaluationCount: number;
}): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  const recipient = process.env["ADMIN_EXPORT_EMAIL"];
  const sender = process.env["EXPORT_EMAIL_FROM"];
  if (!apiKey || !recipient || !sender) {
    throw new Error(
      "Configure RESEND_API_KEY, ADMIN_EXPORT_EMAIL e EXPORT_EMAIL_FROM para receber o Excel.",
    );
  }

  const patientName = escapeHtml(input.patientName);
  const filename = escapeHtml(input.filename);
  const signedUrl = escapeHtml(input.signedUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: sender,
      to: [recipient],
      subject: "Nova avaliação recebida — Excel privado disponível",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#173b57">
          <h1 style="font-size:22px">Nova avaliação recebida</h1>
          <p>O arquivo <strong>${filename}</strong> foi atualizado com ${input.evaluationCount} avaliação(ões) de ${patientName}.</p>
          <p style="margin:28px 0">
            <a href="${signedUrl}" style="background:#2e7d73;color:#fff;text-decoration:none;padding:14px 20px;border-radius:8px;font-weight:bold">Baixar Excel privado</a>
          </p>
          <p style="font-size:13px;color:#52636f">Por segurança, este link expira em 1 hora. O paciente não recebe este e-mail nem tem acesso ao arquivo.</p>
        </div>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const errorText = (await response.text()).slice(0, 300);
    throw new Error(`O serviço de e-mail recusou o envio (${response.status}): ${errorText}`);
  }
}

export async function deliverPatientWorkbook(input: {
  patientName: string;
  phone: string;
}): Promise<void> {
  const normalizedPhone = normalizePatientPhone(input.phone);
  const phoneSuffix = normalizedPhone.slice(-4);
  const { data: candidates, error: recordsError } = await supabaseAdmin
    .from("health_intakes")
    .select("*")
    .ilike("phone", `%${phoneSuffix}%`)
    .order("created_at", { ascending: true });
  if (recordsError) {
    throw new Error(`Não foi possível reunir o histórico do paciente: ${recordsError.message}`);
  }
  const records = (candidates ?? []).filter(
    (record) => normalizePatientPhone(record.phone) === normalizedPhone,
  );
  if (!records?.length) throw new Error("Nenhuma avaliação encontrada para gerar o Excel.");

  // The workbook generator is shared with the private administrative command.
  // @ts-expect-error The portable generator is JavaScript and intentionally has no runtime dependency on the app.
  const { createWorkbookBuffer } = await import("../../scripts/export-health-intakes.mjs");
  const workbook = createWorkbookBuffer(records, new Date()) as Uint8Array;
  const filename = patientWorkbookFilename(input.patientName);
  const patientFolder = await sha256(normalizedPhone);
  const objectPath = `${patientFolder}/latest.xlsx`;

  await ensurePrivateExportBucket();
  const { error: uploadError } = await supabaseAdmin.storage
    .from(EXPORT_BUCKET)
    .upload(objectPath, workbook, {
      contentType: XLSX_MIME,
      cacheControl: "0",
      upsert: true,
    });
  if (uploadError)
    throw new Error(`Não foi possível salvar o Excel privado: ${uploadError.message}`);

  const { data: signedLink, error: signedLinkError } = await supabaseAdmin.storage
    .from(EXPORT_BUCKET)
    .createSignedUrl(objectPath, SIGNED_LINK_SECONDS, { download: filename });
  if (signedLinkError) {
    throw new Error(`Não foi possível criar o link privado: ${signedLinkError.message}`);
  }

  await sendPrivateDownloadEmail({
    patientName: input.patientName,
    filename,
    signedUrl: signedLink.signedUrl,
    evaluationCount: records.length,
  });
}
