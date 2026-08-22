export async function onRequest(context) {
  const incoming = context.request;
  const url = new URL(incoming.url);
  const secret = context.env.CITY_API_PROXY_SECRET;

  if (!secret) {
    return new Response("API proxy is not configured", { status: 500 });
  }

  const headers = new Headers(incoming.headers);
  headers.delete("host");
  headers.set("X-City-Proxy-Key", secret);

  const init = {
    method: incoming.method,
    headers,
    redirect: "manual",
  };

  if (incoming.method !== "GET" && incoming.method !== "HEAD") {
    init.body = incoming.body;
  }

  return fetch(`https://city-api.elinew.tech${url.pathname}${url.search}`, init);
}
