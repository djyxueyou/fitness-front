const DEFAULT_STATIC_ASSET_BASE_URL = 'https://fitness-1426319827.cos.ap-guangzhou.myqcloud.com'

const STATIC_ASSET_BASE_URL =
  (import.meta.env.VITE_STATIC_ASSET_BASE_URL as string | undefined)?.trim().replace(/\/+$/, '') ||
  DEFAULT_STATIC_ASSET_BASE_URL

export function staticAssetUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${STATIC_ASSET_BASE_URL}${normalizedPath}`
}

export function exerciseDefaultImageUrl(filename: string) {
  return staticAssetUrl(`/static/exercise-defaults/${filename}`)
}
