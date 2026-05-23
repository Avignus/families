import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function buildUrl() {
  const base = process.env.DATABASE_URL ?? "";
  if (process.env.NODE_ENV !== "production") return base;
  // Limit connections per serverless instance to avoid exhausting Railway pool
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}connection_limit=3&pool_timeout=20&connect_timeout=10`;
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: { db: { url: buildUrl() } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
