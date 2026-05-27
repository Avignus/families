interface Env {
  VERCEL_WEBHOOK_URL: string;
  PROXY_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Efí makes a GET during webhook registration connectivity test
    if (request.method === "GET") {
      return new Response("OK", { status: 200 });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await request.text();

    // Forward to Vercel with shared secret so the handler can distinguish
    // real Efí events (via this proxy) from direct calls.
    const res = await fetch(env.VERCEL_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-efi-proxy-secret": env.PROXY_SECRET,
      },
      body,
    });

    // Echo Efí's expected 200 regardless of Vercel's response, so Efí doesn't
    // mark the webhook as failed due to a transient Vercel error.
    if (!res.ok) {
      console.error(`[proxy] Vercel returned ${res.status}: ${await res.text()}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
};
