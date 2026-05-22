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
