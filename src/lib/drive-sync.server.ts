// Mirrors each patient's workbook into the clinician's Google Drive folder.
const DRIVE_FOLDER_ID = "1YNrelYbPZ1ivEPGv7hZmUxxrxGzteggm";
const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function headers(): Record<string, string> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const driveKey = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovableKey || !driveKey) throw new Error("Google Drive não está conectado.");
  return { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": driveKey };
}

async function check(response: Response, step: string): Promise<Response> {
  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    throw new Error(`Google Drive (${step}) falhou [${response.status}]: ${body}`);
  }
  return response;
}

export async function syncWorkbookToDrive(filename: string, workbook: Uint8Array): Promise<void> {
  const safeName = filename.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const q = `name='${safeName}' and '${DRIVE_FOLDER_ID}' in parents and trashed=false`;
  const search = await check(
    await fetch(`${GATEWAY}/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`, {
      headers: headers(),
    }),
    "busca",
  );
  const existing = ((await search.json()) as { files?: { id: string }[] }).files?.[0];

  const boundary = `b${crypto.randomUUID()}`;
  const metadata = existing ? { name: filename } : { name: filename, parents: [DRIVE_FOLDER_ID] };
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${XLSX_MIME}\r\n\r\n`,
    workbook as BlobPart,
    `\r\n--${boundary}--`,
  ]);
  const url = existing
    ? `${GATEWAY}/upload/drive/v3/files/${existing.id}?uploadType=multipart`
    : `${GATEWAY}/upload/drive/v3/files?uploadType=multipart`;
  await check(
    await fetch(url, {
      method: existing ? "PATCH" : "POST",
      headers: { ...headers(), "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
      signal: AbortSignal.timeout(15_000),
    }),
    "envio",
  );
}
