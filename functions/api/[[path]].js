export async function onRequest(context) {
  const incoming = context.request;
  const url = new URL(incoming.url);
  let origin;
  try {
    origin = new URL(context.env?.API_ORIGIN);
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/') {
      throw new Error('Invalid API origin');
    }
  } catch {
    return Response.json({ code: 503, message: 'API_ORIGIN must be configured as an HTTPS origin', data: null }, { status: 503 });
  }
  const headers = new Headers(incoming.headers);
  headers.delete("host");
  headers.delete("X-City-Proxy-Key");

  const init = {
    method: incoming.method,
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  };

  if (incoming.method !== "GET" && incoming.method !== "HEAD") {
    init.body = incoming.body;
  }

  try {
    const target = new URL(origin);
    target.pathname = url.pathname;
    target.search = url.search;
    return await fetch(target, init);
  } catch {
    return Response.json({ code: 502, message: '后端服务暂不可用', data: null }, { status: 502 });
  }
}
