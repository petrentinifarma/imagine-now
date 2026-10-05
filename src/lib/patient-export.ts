const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function normalizePatientPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") && (digits.length === 12 || digits.length === 13)
    ? digits.slice(2)
    : digits;
}

export function patientWorkbookFilename(patientName: string): string {
  const cleaned = patientName
    .trim()
    .replace(/[<>:"/\\|?*]/g, " ")
    .split("")
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, 120)
    .trim();
  const safeName = !cleaned || WINDOWS_RESERVED_NAMES.test(cleaned) ? "Paciente" : cleaned;
  return `${safeName}.xlsx`;
}
