"use client";

export const dynamic = "force-dynamic";

/**
 * COMPARATIVO DE TECNOLOGIAS DE ANIMAÇÃO
 *
 * Como usar:
 *
 * LOTTIE —————————————————————————————————————
 * 1. Acesse https://lottiefiles.com/free-animations/galaxy-universe
 * 2. Escolha uma animação e clique em "Free Download" → "Lottie JSON"
 * 3. Faça upload em https://lottie.host e copie o URL público
 *    OU cole o arquivo em /public/effects/galaxy.json
 * 4. Substitua LOTTIE_URL abaixo
 *
 * SPLINE ——————————————————————————————————————
 * 1. Acesse https://spline.design → crie conta gratuita
 * 2. Abra https://community.spline.design/file/43b4d565-2839-426e-a0b7-1ca798ad58cb (Black Hole)
 * 3. Clique em "Remix" → abrir no editor
 * 4. Export → Public URL → copie o URL gerado (prod.spline.design/...)
 * 5. Substitua SPLINE_URL abaixo
 *
 * VIDEO ———————————————————————————————————————
 * 1. Acesse https://pixabay.com/videos/search/nebula/
 * 2. Escolha um vídeo → clique em Download → copie o link do arquivo .mp4
 * 3. Substitua VIDEO_URL abaixo
 */

const LOTTIE_URL = "/effects/galaxy.json";
// Spline community file — tente exportar como Public URL para obter o prod.spline.design URL.
// Fallback: iframe viewer com o ID do arquivo comunitário.
const SPLINE_SCENE = "https://prod.spline.design/43b4d565-2839-426e-a0b7-1ca798ad58cb/scene.splinecode";
const SPLINE_IFRAME = "https://my.spline.design/43b4d565-2839-426e-a0b7-1ca798ad58cb/";
const VIDEO_URL = "/effects/nebula.mp4";

import lazyLoad from "next/dynamic";
import { useState, Suspense } from "react";

// Both packages use browser-only APIs at module level — must be loaded client-side only
const Player = lazyLoad(
  () => import("@lottiefiles/react-lottie-player").then((m) => ({ default: m.Player })),
  { ssr: false }
);
const Spline = lazyLoad(() => import("@splinetool/react-spline"), { ssr: false });
import { Loader2, ExternalLink } from "lucide-react";

function LoadingState({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/40 backdrop-blur-sm">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function CardWrapper({ title, rarity, description, tech, resourceUrl, resourceLabel, children }: {
  title: string;
  rarity: string;
  description: string;
  tech: string;
  resourceUrl: string;
  resourceLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col">
      <div className="relative h-64 bg-black overflow-hidden">
        {children}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-[10px] font-medium text-amber-400">{rarity}</p>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono shrink-0">{tech}</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        <a
          href={resourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" /> {resourceLabel}
        </a>
      </div>
    </div>
  );
}

export default function EffectsDemo() {
  const [splineReady, setSplineReady] = useState(false);
  const [splineError, setSplineError] = useState(false);

  return (
    <div className="min-h-screen bg-background px-6 py-10 space-y-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Comparativo de Efeitos Animados</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Três tecnologias, mesmo container. Escolha qual se encaixa melhor na estética da plataforma.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* ── LOTTIE ─────────────────────────────────────────── */}
          <CardWrapper
            title="Lottie Animation"
            rarity="Leve · Vetorial · Artístico"
            description="Animação vetorial criada por artistas em After Effects. Arquivo JSON leve (20–200kb), escala perfeita, cores nítidas. Ideal para efeitos 2D expressivos como o Discord usa."
            tech="JSON / 60fps"
            resourceUrl="https://lottiefiles.com/free-animations/galaxy-universe"
            resourceLabel="Baixar animação gratuita no LottieFiles"
          >
            <Suspense fallback={<LoadingState label="Carregando Lottie..." />}>
              <Player
                autoplay loop
                src={LOTTIE_URL}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </Suspense>
          </CardWrapper>

          {/* ── SPLINE ─────────────────────────────────────────── */}
          <CardWrapper
            title="Spline 3D"
            rarity="Interativo · WebGL · Imersivo"
            description="Cena 3D em tempo real rodando no browser via WebGL. O usuário pode interagir (mouse/touch). Qualidade cinematográfica — isso é literalmente o que o Discord usa para os efeitos premium."
            tech="WebGL / Realtime"
            resourceUrl="https://community.spline.design/file/43b4d565-2839-426e-a0b7-1ca798ad58cb"
            resourceLabel="Abrir Black Hole no Spline Community (CC0)"
          >
            {splineError ? (
              <iframe
                src={SPLINE_IFRAME}
                title="Spline 3D Black Hole"
                className="absolute inset-0 w-full h-full border-0"
                loading="lazy"
              />
            ) : (
              <>
                {!splineReady && <LoadingState label="Renderizando 3D..." />}
                <Spline
                  scene={SPLINE_SCENE}
                  onLoad={() => setSplineReady(true)}
                  onError={() => setSplineError(true)}
                  style={{ width: "100%", height: "100%" }}
                />
              </>
            )}
          </CardWrapper>

          {/* ── VIDEO ──────────────────────────────────────────── */}
          <CardWrapper
            title="Vídeo WebM/MP4"
            rarity="Cinematográfico · Renderizado · Premium"
            description="Vídeo pré-renderizado por artistas em Blender/Cinema 4D. Qualidade de estúdio, fluido, orgânico — o mesmo nível do Discord Nitro. Arquivo maior (3–15MB) mas incomparável visualmente."
            tech="MP4 / WebM"
            resourceUrl="https://pixabay.com/videos/search/nebula/"
            resourceLabel="Vídeos gratuitos de nebulosa no Pixabay (CC0)"
          >
            <video
              autoPlay muted loop playsInline
              className="absolute inset-0 w-full h-full object-cover"
            >
              <source src={VIDEO_URL} type="video/mp4" />
            </video>
          </CardWrapper>

        </div>

        {/* Resumo técnico */}
        <div className="mt-10 rounded-xl border border-border/40 bg-card/60 p-6">
          <h2 className="font-semibold mb-4">Comparativo técnico</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground">
                  <th className="pb-2 pr-4">Critério</th>
                  <th className="pb-2 pr-4">Lottie</th>
                  <th className="pb-2 pr-4">Spline 3D</th>
                  <th className="pb-2">Vídeo MP4</th>
                </tr>
              </thead>
              <tbody className="space-y-1">
                {[
                  ["Qualidade visual",     "⭐⭐⭐⭐",   "⭐⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"],
                  ["Peso do arquivo",      "20–200kb",  "50–300kb",  "3–15MB"],
                  ["Performance mobile",  "Excelente", "Boa",       "Excelente"],
                  ["Interatividade",       "Não",       "Sim (3D)",  "Não"],
                  ["Personalização",       "Média",     "Alta",      "Nenhuma"],
                  ["Onde conseguir",       "LottieFiles","Spline",   "Pixabay / Pexels"],
                  ["Custo",               "Grátis",    "Grátis",    "Grátis / Comissão"],
                  ["O Discord usa?",       "Sim",       "Sim",       "Sim (Nitro BG)"],
                ].map(([c, l, s, v]) => (
                  <tr key={c} className="border-b border-border/20">
                    <td className="py-2 pr-4 font-medium text-muted-foreground">{c}</td>
                    <td className="py-2 pr-4">{l}</td>
                    <td className="py-2 pr-4">{s}</td>
                    <td className="py-2">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
