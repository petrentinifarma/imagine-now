// Package catalog. Prices are provisional until Pedro confirms them.
export type Plan = { id: string; name: string; tag: string; items: string[]; amountCents: number };

export const PLANS: Plan[] = [
  { id: "essencial", name: "Saúde em Dia", tag: "Essencial", items: ["Consulta inicial completa", "Plano personalizado", "1 retorno"], amountCents: 49700 },
  { id: "alta", name: "Saúde em Alta", tag: "Mais escolhido", items: ["Consulta inicial completa", "Plano personalizado", "Retornos mensais", "Ajustes no tratamento"], amountCents: 89700 },
  { id: "longevidade", name: "Longevidade", tag: "Integral", items: ["Consulta inicial completa", "Plano personalizado", "Retornos frequentes", "Acompanhamento próximo"], amountCents: 149700 },
];

export function findPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function isValidCpf(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}
