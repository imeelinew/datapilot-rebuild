import assert from 'node:assert/strict'
import test from 'node:test'
import { onRequest } from '../functions/api/[[path]].js'

test('proxy fails closed without an HTTPS API origin', async () => {
  for (const API_ORIGIN of [undefined, 'http://api.example.test', 'https://user:pass@example.test', 'https://example.test/nested']) {
    const response = await onRequest({ request: new Request('https://city.example.test/api/auth/me'), env: { API_ORIGIN } })
    assert.equal(response.status, 503)
  }
})

test('proxy forwards authentication and a fixed path, without trusting inbound proxy keys', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url.href, 'https://backend.example.test/api/auth/me?q=1')
      assert.equal(init.headers.get('authorization'), 'Bearer example-token')
      assert.equal(init.headers.has('host'), false)
      assert.equal(init.headers.has('x-city-proxy-key'), false)
      assert.equal(init.redirect, 'manual')
      return Response.json({ code: 200 })
    }
    const response = await onRequest({
      request: new Request('https://city.example.test/api/auth/me?q=1', { headers: { authorization: 'Bearer example-token', 'x-city-proxy-key': 'untrusted', host: 'untrusted.test' } }),
      env: { API_ORIGIN: 'https://backend.example.test' },
    })
    assert.equal(response.status, 200)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('upstream failures return a controlled gateway error', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => { throw new Error('connect failed') }
    const response = await onRequest({ request: new Request('https://city.example.test/api/cities'), env: { API_ORIGIN: 'https://backend.example.test' } })
    assert.equal(response.status, 502)
  } finally {
    globalThis.fetch = originalFetch
  }
})
