import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { findPlan, isValidCpf } from "./plans";

const checkoutSchema = z.object({
  planId: z.string().min(1).max(40),
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(160),
  cpf: z.string().refine(isValidCpf, "CPF inválido"),
  phone: z.string().trim().max(30).optional(),
});

export const createCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => checkoutSchema.parse(input))
  .handler(async ({ data }) => {
    const plan = findPlan(data.planId);
    if (!plan) throw new Error("Pacote inválido");
    const { asaas } = await import("./asaas.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cpf = data.cpf.replace(/\D/g, "");
    const phone = data.phone?.replace(/\D/g, "") || null;

    const { data: order, error } = await supabaseAdmin
      .from("package_orders")
      .insert({ plan_id: plan.id, plan_name: plan.name, amount_cents: plan.amountCents, buyer_name: data.name, buyer_email: data.email, buyer_cpf: cpf, buyer_phone: phone })
      .select("id")
      .single();
    if (error || !order) throw new Error("Não foi possível registrar o pedido");

    const found = await asaas<any>(`customers?cpfCnpj=${cpf}`);
    let customerId: string | undefined = found?.data?.[0]?.id;
    if (!customerId) {
      const c = await asaas<any>("customers", {
        method: "POST",
        body: { name: data.name, cpfCnpj: cpf, email: data.email, ...(phone ? { mobilePhone: phone } : {}), notificationDisabled: true },
      });
      customerId = c.id;
    }
    await supabaseAdmin.from("package_orders").update({ asaas_customer_id: customerId ?? null }).eq("id", order.id);

    const due = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const payment = await asaas<any>("payments", {
      method: "POST",
      body: { customer: customerId, billingType: "UNDEFINED", value: plan.amountCents / 100, dueDate: due, description: `Pacote ${plan.name} — Dr. Pedro Trentini`, externalReference: order.id },
    });
    await supabaseAdmin.from("package_orders").update({ asaas_payment_id: payment.id, invoice_url: payment.invoiceUrl }).eq("id", order.id);
    return { orderId: order.id, invoiceUrl: payment.invoiceUrl as string };
  });

export const getOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid(), check: z.boolean().default(false) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const read = async () =>
      (await supabaseAdmin.from("package_orders").select("id, plan_name, amount_cents, buyer_name, status, invoice_url, asaas_payment_id, created_at, paid_at").eq("id", data.orderId).maybeSingle()).data;
    let order = await read();
    if (!order) return null;
    if (order.status === "pending" && order.asaas_payment_id && data.check) {
      try {
        const { confirmPayment } = await import("./asaas.server");
        await confirmPayment(order.asaas_payment_id);
        order = (await read()) ?? order;
      } catch (e) {
        console.error(e);
      }
    }
    return {
      planName: order.plan_name,
      amountCents: order.amount_cents,
      firstName: order.buyer_name.split(" ")[0] ?? "",
      status: order.status,
      invoiceUrl: order.invoice_url,
      createdAt: order.created_at,
      paidAt: order.paid_at,
    };
  });
