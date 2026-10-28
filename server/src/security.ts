import {
  createHmac,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const result = await scrypt(password, salt, 64) as Buffer
  return `scrypt$${salt}$${result.toString('hex')}`
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const [algorithm, salt, expectedHex] = encoded.split('$')
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false

  const actual = await scrypt(password, salt, 64) as Buffer
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function randomPassword(length = 16): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  return Array.from(
    { length },
    () => alphabet[randomInt(0, alphabet.length)],
  ).join('')
}

export function hmacHex(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

type TokenPayload = {
  sub: number
  username: string
  iat: number
  exp: number
}

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

export function signToken(
  payload: Omit<TokenPayload, 'iat' | 'exp'>,
  secret: string,
  ttlSeconds = 8 * 60 * 60,
): string {
  const now = Math.floor(Date.now() / 1000)
  const header = encode({ alg: 'HS256', typ: 'JWT' })
  const body = encode({ ...payload, iat: now, exp: now + ttlSeconds })
  const unsigned = `${header}.${body}`
  const signature = createHmac('sha256', secret)
    .update(unsigned)
    .digest('base64url')
  return `${unsigned}.${signature}`
}

export function verifyToken(token: string, secret: string): TokenPayload {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid token')
  const [header, body, signature] = parts
  if (!header || !body || !signature) throw new Error('Invalid token')

  let parsedHeader: { alg?: string }
  try {
    parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString()) as {
      alg?: string
    }
  } catch {
    throw new Error('Invalid token')
  }
  if (parsedHeader.alg !== 'HS256') throw new Error('Invalid token')

  const expected = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest()
  const supplied = Buffer.from(signature, 'base64url')
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    throw new Error('Invalid token')
  }

  const payload = JSON.parse(
    Buffer.from(body, 'base64url').toString(),
  ) as TokenPayload
  if (
    !Number.isSafeInteger(payload.sub) ||
    payload.sub <= 0 ||
    typeof payload.username !== 'string' ||
    !Number.isSafeInteger(payload.iat) ||
    payload.iat < 0 ||
    !Number.isSafeInteger(payload.exp) ||
    payload.exp <= 0
  ) {
    throw new Error('Invalid token payload')
  }
  const now = Math.floor(Date.now() / 1000)
  if (payload.iat > now + 60 || payload.exp <= now) throw new Error('Expired token')
  return payload
}
