import { cn } from "@/lib/utils";

export function FamiliesLogo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {/* Icon: three overlapping circles representing family members */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Glow base — animated */}
        <circle cx="10" cy="15" r="7" fill="hsl(258 82% 66%)" className="logo-glow-1" />
        <circle cx="18" cy="15" r="7" fill="hsl(186 90% 48%)" className="logo-glow-2" />

        {/* Left circle — member */}
        <circle cx="10" cy="15" r="6" stroke="hsl(258 82% 66%)" strokeWidth="1.5" fill="hsl(258 82% 66% / 0.12)" />
        {/* Right circle — member */}
        <circle cx="18" cy="15" r="6" stroke="hsl(186 90% 48%)" strokeWidth="1.5" fill="hsl(186 90% 48% / 0.10)" />
        {/* Top circle — member, overlapping both */}
        <circle cx="14" cy="8" r="5.5" stroke="hsl(258 82% 80%)" strokeWidth="1.5" fill="hsl(258 82% 66% / 0.18)" className="logo-glow-3" />

        {/* Gift dot in center */}
        <circle cx="14" cy="13.5" r="2" fill="hsl(258 82% 80%)" />
        <line x1="14" y1="11.5" x2="14" y2="10" stroke="hsl(258 82% 80%)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12.5" y1="10.8" x2="14" y2="10" stroke="hsl(186 90% 68%)" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="15.5" y1="10.8" x2="14" y2="10" stroke="hsl(186 90% 68%)" strokeWidth="1.2" strokeLinecap="round" />
      </svg>

      {showText && (
        <span
          className="text-xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          <span className="text-foreground">fam</span>
          <span className="logo-shimmer">ilies</span>
        </span>
      )}
    </div>
  );
}
