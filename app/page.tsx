import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FamiliesLogo } from "@/components/layout/logo";
import { Gift, Users, Zap, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getServerTranslations } from "@/lib/i18n/server";

export default async function LandingPage() {
  const session = await getSession();
  if (session?.user) redirect("/dashboard");

  const { t } = getServerTranslations();

  const features = [
    { icon: Users, label: t.home.feature1, color: "hsl(258 82% 66%)" },
    { icon: Gift, label: t.home.feature2, color: "hsl(186 90% 48%)" },
    { icon: Zap, label: t.home.feature3, color: "hsl(258 82% 80%)" },
    { icon: ShieldCheck, label: t.home.feature4, color: "hsl(186 90% 60%)" },
  ];

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center overflow-hidden">

      {/* Background layers */}
      <div className="absolute inset-0 grid-pattern" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
      <div
        className="absolute top-[-20%] left-[30%] w-[600px] h-[600px] rounded-full opacity-[0.07]"
        style={{ background: "radial-gradient(circle, hsl(258 82% 66%), transparent 70%)" }}
      />
      <div
        className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] rounded-full opacity-[0.05]"
        style={{ background: "radial-gradient(circle, hsl(186 90% 48%), transparent 70%)" }}
      />

      <div className="relative z-10 max-w-2xl w-full mx-auto px-6 py-16 flex flex-col items-center gap-10">

        {/* Logo + tagline */}
        <div className="flex flex-col items-center gap-5 text-center">
          <FamiliesLogo className="scale-150 mb-2" />

          <div className="space-y-3">
            <h1
              className="text-4xl sm:text-5xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-space-grotesk)" }}
            >
              {t.home.title1}{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, hsl(258 82% 72%), hsl(186 90% 58%))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {t.home.title2}
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
              {t.home.subtitle}
            </p>
          </div>
        </div>

        {/* Feature pills */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-md">
          {features.map(({ icon: Icon, label, color }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border/50 bg-card/40 backdrop-blur-sm"
            >
              <Icon className="h-4 w-4 flex-shrink-0" style={{ color }} />
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-3">
          <Link href="/api/auth/steam">
            <button className="group flex items-center gap-3 px-7 py-3.5 rounded-lg font-semibold text-white transition-all duration-200 glow-primary hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, hsl(258 82% 60%), hsl(258 82% 50%))",
                boxShadow: "0 0 24px hsl(258 82% 66% / 0.3), inset 0 1px 0 hsl(258 82% 80% / 0.2)",
              }}
            >
              <svg className="h-5 w-5 opacity-90" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.497 1.009 2.455-.397.957-1.497 1.41-2.455 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z" />
              </svg>
              {t.home.loginBtn}
            </button>
          </Link>
          <p className="text-xs text-muted-foreground">
            {t.home.loginSubtext}
          </p>
        </div>

        {/* Disclaimer */}
        <div className="w-full max-w-md rounded-lg border border-border/40 bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            {t.home.disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
}
