const avatarPathPattern = /\/(?:api\/)?avatars\/[^?#]+/

export function resolveAvatarUrl(value?: string | null) {
  const avatar = value?.trim()
  if (!avatar) return undefined

  if (!avatar.includes('/')) {
    return `/api/avatars/${encodeURIComponent(avatar)}`
  }

  try {
    const url = new URL(avatar, window.location.origin)
    const matchedPath = url.pathname.match(avatarPathPattern)?.[0]

    if (matchedPath) {
      const proxyPath = matchedPath.startsWith('/api/')
        ? matchedPath
        : `/api${matchedPath}`
      return `${proxyPath}${url.search}`
    }

    return url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}
