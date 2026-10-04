import { createFileRoute } from "@tanstack/react-router";
import { HealthIntakeApp } from "@/components/health-intake-app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Anamnese Inicial | Dr. Pedro Trentini" },
      { name: "description", content: "Questionário inicial de saúde e bem-estar para um cuidado farmacêutico individualizado." },
      { property: "og:title", content: "Anamnese Inicial | Dr. Pedro Trentini" },
      { property: "og:description", content: "Conte como você está hoje e quais melhorias busca para sua saúde, independência e vitalidade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <HealthIntakeApp />;
}
