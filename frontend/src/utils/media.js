function getApiOrigin() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL

  if (!apiBaseUrl) {
    return window.location.origin
  }

  try {
    return new URL(apiBaseUrl, window.location.origin).origin
  } catch {
    return window.location.origin
  }
}

export function resolveMediaUrl(path) {
  if (!path) return undefined

  const normalizedPath = String(path).trim()
  if (!normalizedPath) return undefined

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath
  }

  const baseOrigin = getApiOrigin()
  const relativePath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`
  return `${baseOrigin}${relativePath}`
}
