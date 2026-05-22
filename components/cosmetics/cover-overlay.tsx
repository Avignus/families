"use client";

type OverlayConfig = {
  cssClass?: string;
};

type Props = {
  config: OverlayConfig;
  className?: string;
};

// Maps each overlay slug/cssClass to inline-style animated divs.
// Bypasses CSS pseudo-elements which are unreliable with dynamic class names.
const OVERLAY_ELEMENTS: Record<string, React.ReactNode> = {
  "cover-overlay-mist": (
    <div
      className="absolute bottom-0 left-0 right-0 pointer-events-none"
      style={{
        height: "45%",
        background: "linear-gradient(to top, rgba(107,33,168,0.55) 0%, transparent 100%)",
        animation: "mist-drift 6s ease-in-out infinite",
      }}
    />
  ),
  "cover-overlay-shimmer": (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: "linear-gradient(105deg, transparent 35%, rgba(251,191,36,0.5) 50%, transparent 65%)",
        backgroundSize: "200% 100%",
        animation: "gold-shimmer 4s linear infinite",
      }}
    />
  ),
  "cover-overlay-flags": (
    <div
      className="absolute top-0 left-0 right-0 pointer-events-none"
      style={{
        height: "40%",
        background: "linear-gradient(to bottom, rgba(16,185,129,0.45) 0%, transparent 100%)",
        animation: "flag-wave 3s ease-in-out infinite",
      }}
    />
  ),
  "cover-overlay-rain": (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: "repeating-linear-gradient(100deg, transparent 0, transparent 2px, rgba(129,140,248,0.22) 2px, rgba(129,140,248,0.22) 3px)",
        backgroundSize: "4px 8px",
        // backgroundPosition animation keeps element fixed — no translateY escaping overflow-hidden
        animation: "rain-bg-scroll 0.3s linear infinite",
      }}
    />
  ),
  "cover-overlay-radiance": (
    <div
      className="absolute bottom-0 left-0 right-0 pointer-events-none"
      style={{
        height: "55%",
        background: "radial-gradient(ellipse at 50% 110%, rgba(234,179,8,0.65) 0%, transparent 70%)",
        animation: "radiance-pulse 2.5s ease-in-out infinite",
      }}
    />
  ),
  "cover-overlay-flame": (
    <>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 0% 100%, rgba(124,58,237,0.70) 0%, transparent 40%), radial-gradient(ellipse at 100% 100%, rgba(124,58,237,0.70) 0%, transparent 40%)",
          animation: "flame-pulse 2s ease-in-out infinite",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 0% 0%, rgba(124,58,237,0.50) 0%, transparent 30%), radial-gradient(ellipse at 100% 0%, rgba(124,58,237,0.50) 0%, transparent 30%)",
          animation: "flame-pulse 2.5s ease-in-out infinite 0.5s",
        }}
      />
    </>
  ),
  "cover-overlay-scanner": (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{
        // Use a tall gradient stripe + backgroundPosition to scroll it vertically
        backgroundImage: "linear-gradient(to bottom, transparent 0, transparent 49%, rgba(99,102,241,0.9) 50%, transparent 51%, transparent 100%)",
        backgroundSize: "100% 200%",
        animation: "scanner-bg-sweep 2s ease-in-out infinite",
      }}
    />
  ),
  "cover-overlay-blackhole": (
    <>
      {/* Outer nebula swirl — blurred rotating conic gradient */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "conic-gradient(from 0deg at 50% 50%, rgba(180,120,255,0.45) 0deg, rgba(255,255,255,0.35) 80deg, rgba(120,80,200,0.45) 180deg, rgba(220,180,255,0.25) 260deg, rgba(180,120,255,0.45) 360deg)",
        filter: "blur(18px)",
        animation: "bh-spin 22s linear infinite",
      }} />
      {/* Inner swirl arm — opposite spin, tighter */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "conic-gradient(from 120deg at 50% 50%, rgba(255,200,100,0.3) 0deg, transparent 60deg, rgba(200,100,255,0.35) 130deg, transparent 200deg, rgba(255,180,80,0.2) 280deg, transparent 340deg, rgba(255,200,100,0.3) 360deg)",
        filter: "blur(10px)",
        animation: "bh-spin-reverse 14s linear infinite",
      }} />
      {/* Accretion disk — warm ring around the horizon */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(circle at 50% 50%, transparent 12%, rgba(255,200,80,0.65) 18%, rgba(220,80,255,0.5) 26%, rgba(140,60,220,0.3) 34%, transparent 42%)",
        animation: "bh-pulse 3s ease-in-out infinite",
      }} />
      {/* Central white-hot light */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.95) 0%, rgba(255,230,180,0.8) 5%, rgba(220,150,255,0.4) 12%, transparent 22%)",
        filter: "blur(6px)",
        animation: "bh-pulse 2.5s ease-in-out infinite 0.5s",
      }} />
      {/* Event horizon — the dark absolute center */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div style={{
          width: "10%",
          aspectRatio: "1",
          borderRadius: "50%",
          background: "radial-gradient(circle, #000 50%, rgba(0,0,0,0.6) 100%)",
          animation: "bh-breathe 4s ease-in-out infinite",
        }} />
      </div>
      {/* Star particles */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: [
          "radial-gradient(circle at 25% 35%, rgba(255,255,255,0.9) 0%, transparent 0.4%)",
          "radial-gradient(circle at 72% 28%, rgba(255,255,255,0.8) 0%, transparent 0.4%)",
          "radial-gradient(circle at 40% 70%, rgba(255,255,255,0.7) 0%, transparent 0.3%)",
          "radial-gradient(circle at 80% 65%, rgba(255,255,255,0.85) 0%, transparent 0.4%)",
          "radial-gradient(circle at 15% 58%, rgba(255,255,255,0.6) 0%, transparent 0.3%)",
          "radial-gradient(circle at 60% 15%, rgba(255,255,255,0.75) 0%, transparent 0.35%)",
        ].join(", "),
        animation: "bh-twinkle 4s ease-in-out infinite",
      }} />
    </>
  ),
  "cover-overlay-crt": (
    <>
      {/* Scanlines — fine horizontal dark stripes every 3px */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.20) 2px, rgba(0,0,0,0.20) 3px)",
          backgroundSize: "100% 3px",
        }}
      />
      {/* Electron beam — bright horizontal line sweeping top-to-bottom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(to bottom, transparent 0%, transparent 48%, rgba(160,255,180,0.08) 50%, transparent 52%, transparent 100%)",
          backgroundSize: "100% 80px",
          animation: "crt-beam 4s linear infinite",
        }}
      />
      {/* Vignette — dark edges, bright center like a tube screen */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      {/* Phosphor tint + flicker */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "rgba(0, 30, 10, 0.06)",
          animation: "crt-flicker 5s steps(6) infinite",
        }}
      />
      {/* Occasional glitch — rare color shift */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          animation: "crt-glitch 8s steps(1) infinite",
          mixBlendMode: "screen",
          background: "transparent",
        }}
      />
    </>
  ),
};

export function CoverOverlay({ config, className = "" }: Props) {
  const cls = config?.cssClass;
  if (!cls) return null;

  const elements = OVERLAY_ELEMENTS[cls];
  if (!elements) return null;

  return (
    <div className={`absolute inset-0 pointer-events-none z-20 ${className}`}>
      {elements}
    </div>
  );
}
