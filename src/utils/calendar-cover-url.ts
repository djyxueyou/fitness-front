export function safeCalendarCoverUrl(value?: string | null) {
  const url = value?.trim()
  if (!url) return undefined
  if (/^https?:\/\//i.test(url) || url.startsWith('/static/')) return url
  return undefined
}

export function normalizeCalendarCoverItems<T extends { coverUrl?: string }>(items: T[]) {
  return items.map((item) => ({
    ...item,
    coverUrl: safeCalendarCoverUrl(item.coverUrl)
  }))
}
