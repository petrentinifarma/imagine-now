const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

export async function gcal<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const calKey = process.env["GOOGLE_CALENDAR_API_KEY"];
  if (!lovableKey || !calKey) throw new Error("Google Calendar is not configured");
  const res = await fetch(`${GATEWAY}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": calKey, "Content-Type": "application/json" },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Google Calendar ${path} failed [${res.status}]: ${text}`);
    throw new Error(`Google Calendar failed [${res.status}]`);
  }
  return res.json() as Promise<T>;
}

export async function busyRanges(timeMin: string, timeMax: string): Promise<{ start: number; end: number }[]> {
  const r = await gcal<any>("/freeBusy", { method: "POST", body: { timeMin, timeMax, timeZone: "America/Sao_Paulo", items: [{ id: "primary" }] } });
  const busy: { start: string; end: string }[] = r?.calendars?.primary?.busy ?? [];
  return busy.map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
}
