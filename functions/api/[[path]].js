export async function onRequest(context) {
  const incoming = context.request;
  const url = new URL(incoming.url);
  const headers = new Headers(incoming.headers);
  headers.delete("host");
  headers.delete("X-City-Proxy-Key");

  const init = {
    method: incoming.method,
    headers,
    redirect: "manual",
  };

  if (incoming.method !== "GET" && incoming.method !== "HEAD") {
    init.body = incoming.body;
  }

  return fetch(`http://182.92.74.1:8080${url.pathname}${url.search}`, init);
}
