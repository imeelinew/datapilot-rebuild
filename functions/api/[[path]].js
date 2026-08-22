export async function onRequest(context) {
  const incoming = context.request;
  const url = new URL(incoming.url);
  const target = `http://116.62.230.90${url.pathname}${url.search}`;

  const headers = new Headers(incoming.headers);
  headers.delete("host");

  const init = {
    method: incoming.method,
    headers,
    redirect: "manual",
  };

  if (incoming.method !== "GET" && incoming.method !== "HEAD") {
    init.body = incoming.body;
  }

  return fetch(target, init);
}
