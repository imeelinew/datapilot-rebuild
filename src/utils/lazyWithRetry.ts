import {
  lazy,
  type ComponentType,
  type LazyExoticComponent,
} from 'react'

const retryKeyPrefix = 'city-view:chunk-retry:'

function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(
    message,
  )
}

export function lazyWithRetry<T extends ComponentType<unknown>>(
  loader: () => Promise<{ default: T }>,
  chunkName: string,
): LazyExoticComponent<T> {
  const retryKey = `${retryKeyPrefix}${chunkName}`

  return lazy(async () => {
    try {
      const module = await loader()
      sessionStorage.removeItem(retryKey)
      return module
    } catch (error) {
      if (!isChunkLoadError(error)) {
        throw error
      }

      try {
        if (!sessionStorage.getItem(retryKey)) {
          sessionStorage.setItem(retryKey, '1')
          window.location.reload()

          // Keep Suspense pending while the browser starts the reload.
          return await new Promise<never>(() => undefined)
        }
      } catch {
        // Storage can be unavailable in strict privacy modes. In that case the
        // error boundary below provides a manual recovery action.
      }

      throw error
    }
  })
}
