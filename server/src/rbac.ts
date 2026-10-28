export const SYSTEM_ROLE_CODES = [
  'super_admin',
  'admin',
  'analyst',
  'user',
] as const

export type SystemRoleCode = typeof SYSTEM_ROLE_CODES[number]

export function isSystemRoleCode(code: string): code is SystemRoleCode {
  return (SYSTEM_ROLE_CODES as readonly string[]).includes(code)
}
