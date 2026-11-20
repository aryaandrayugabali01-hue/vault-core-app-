const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });

function originOnly(value) {
  if (!value) return null;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    return null;
  }

  return parsed.origin;
}

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);

    if (incoming.pathname === "/_gateway/health") {
      if (request.method !== "GET") {
        return new Response(null, {
          status: 405,
          headers: { allow: "GET" },
        });
      }

      return json({
        service: "VAULT CORE gateway",
        status: "gateway_ready",
        applicationReady: false,
        routes: {
          apiConfigured: Boolean(originOnly(env.API_ORIGIN)),
          frontendConfigured: Boolean(originOnly(env.WEB_ORIGIN)),
        },
        note: "Gateway health only. Application origins and production secrets must be configured before launch.",
      });
    }

    const isApi = incoming.hostname.startsWith("api.") || incoming.pathname === "/api" || incoming.pathname.startsWith("/api/");
    const configuredOrigin = originOnly(isApi ? env.API_ORIGIN : env.WEB_ORIGIN);

    if (!configuredOrigin) {
      return json(
        {
          error: "UPSTREAM_NOT_CONFIGURED",
          service: "VAULT CORE gateway",
          route: isApi ? "api" : "frontend",
          message: "The VAULT CORE upstream origin is not configured.",
        },
        503,
      );
    }

    const target = new URL(incoming.pathname + incoming.search, configuredOrigin);
    const headers = new Headers(request.headers);
    headers.set("x-forwarded-host", incoming.host);
    headers.set("x-forwarded-proto", incoming.protocol.slice(0, -1));
    headers.delete("host");

    const init = {
      method: request.method,
      headers,
      redirect: "manual",
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
    }

    try {
      return await fetch(new Request(target, init));
    } catch {
      return json(
        {
          error: "UPSTREAM_UNAVAILABLE",
          service: "VAULT CORE gateway",
        },
        502,
      );
    }
  },
};
