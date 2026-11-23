const GATEWAY_URL = "https://connector-gateway.lovable.dev/asaas";

export async function asaas<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env["ASAAS_CONNECTION_KEY"];
  if (!lovableKey || !connKey) throw new Error("Asaas is not configured");
  const res = await fetch(`${GATEWAY_URL}/${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": connKey, "Content-Type": "application/json" },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Asaas ${path} failed [${res.status}]: ${text}`);
    throw new Error(`Asaas ${path} failed [${res.status}]: ${text}`);
  }
  return res.json() as Promise<T>;
}

const PAID = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "AWAITING_CHARGEBACK_REVERSAL"];

/** Returns true when the payment is handled (or not ours); throws on transient failures. */
export async function confirmPayment(paymentId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const p = await asaas<any>(`payments/${paymentId}`);
  const orderId: string | undefined = p.externalReference;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) return;
  const { data: order, error } = await supabaseAdmin.from("package_orders").select("id, amount_cents, status").eq("id", orderId).maybeSingle();
  if (error) throw error;
  if (!order) return;

  const charged = Math.round(Number(p.originalValue ?? p.value) * 100);
  if (PAID.includes(p.status) && charged === order.amount_cents) {
    const { error: e } = await supabaseAdmin
      .from("package_orders")
      .update({ status: "paid", asaas_payment_id: p.id, paid_at: new Date().toISOString() })
      .eq("id", orderId)
      .in("status", ["pending", "disputed"]);
    if (e) throw e;
  } else if (p.status === "REFUNDED") {
    const { error: e } = await supabaseAdmin.from("package_orders").update({ status: "refunded" }).eq("id", orderId);
    if (e) throw e;
  } else if (p.status === "CHARGEBACK_REQUESTED" || p.status === "CHARGEBACK_DISPUTE") {
    const { error: e } = await supabaseAdmin.from("package_orders").update({ status: "disputed" }).eq("id", orderId);
    if (e) throw e;
  } else if (p.deleted === true || p.status === "DELETED") {
    await supabaseAdmin.from("package_orders").update({ status: "cancelled" }).eq("id", orderId).eq("status", "pending");
  }
}
