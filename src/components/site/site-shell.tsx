import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import logo from "@/assets/logo-dr-pedro-trentini.png.asset.json";

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-stone text-ink">
      <header className="sticky top-0 z-30 border-b border-stone-strong bg-stone/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <Link to="/inicio" className="flex items-center gap-3">
            <img src={logo.url} alt="Logo Dr. Pedro Trentini" className="h-11 w-11 rounded-full object-cover" />
            <div className="leading-tight">
              <p className="font-display text-lg font-semibold text-primary">Dr. Pedro Trentini</p>
              <p className="text-xs text-muted-foreground">Farmacêutico clínico · CRF-SP 67.965</p>
            </div>
          </Link>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-16 bg-primary px-5 py-10 text-center text-sm text-primary-foreground/80">
        <p className="font-display text-lg text-primary-foreground">Dr. Pedro Trentini</p>
        <p className="mt-1">Farmácia clínica e integrativa para adultos 50+ · CRF-SP 67.965</p>
        <p className="mt-3 text-xs">Atendimento individualizado. Resultados variam de pessoa para pessoa.</p>
      </footer>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">{children}</p>;
}

export function DriveVideo({ id, title }: { id: string; title: string }) {
  return (
    <div className="aspect-[9/16] w-full overflow-hidden rounded-2xl bg-primary shadow-app sm:aspect-video">
      <iframe
        src={`https://drive.google.com/file/d/${id}/preview`}
        title={title}
        allow="autoplay; fullscreen"
        className="h-full w-full"
      />
    </div>
  );
}

export function VideoPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl bg-primary text-center text-primary-foreground shadow-app">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-accent text-2xl text-accent">▶</div>
      <p className="px-6 text-base text-primary-foreground/85">{label}</p>
    </div>
  );
}
