import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { NextRequest } from "next/server";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Returns the app's public base URL for webhook notification URLs.
// Priority: configured env → Vercel auto-vars → request origin → localhost fallback.
export function getAppBaseUrl(req?: NextRequest): string {
  const configured = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL ?? "";
  if (configured && !configured.includes("localhost")) return configured;

  // Vercel injects these automatically on every deployment
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL}`;

  // Fall back to the request's own origin (reliable in API routes)
  if (req) {
    const origin = req.headers.get("origin") ?? req.nextUrl.origin;
    if (origin && !origin.includes("localhost")) return origin;
  }

  return "http://localhost:3000";
}

export function formatCurrency(cents: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d atrás`;
  return d.toLocaleDateString("pt-BR");
}

export const MEMBER_COLORS = [
  "#9b74f7", // violet
  "#22d3ee", // cyan
  "#f59e0b", // amber
  "#34d399", // emerald
  "#f472b6", // pink
  "#fb923c", // orange
  "#60a5fa", // blue
  "#a3e635", // lime
];

export function getMemberColor(index: number): string {
  return MEMBER_COLORS[index % MEMBER_COLORS.length];
}
