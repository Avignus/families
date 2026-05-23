export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const required = ["NEXTAUTH_SECRET", "DATABASE_URL", "STEAM_API_KEY"];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      throw new Error(`[startup] Missing required env vars: ${missing.join(", ")}`);
    }
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
