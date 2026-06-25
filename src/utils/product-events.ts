const STORAGE_KEY = 'FITFORGE_PRODUCT_EVENTS'
const MAX_EVENTS = 100

interface ProductEvent {
  name: string
  occurredAt: string
  properties: Record<string, string | number | boolean | null>
}

export function trackProductEvent(
  name: string,
  properties: Record<string, string | number | boolean | null> = {}
) {
  try {
    const existing = (uni.getStorageSync(STORAGE_KEY) || []) as ProductEvent[]
    uni.setStorageSync(
      STORAGE_KEY,
      [...existing, { name, occurredAt: new Date().toISOString(), properties }].slice(-MAX_EVENTS)
    )
  } catch (err) {
    console.warn('[product-event] track failed', name, err)
  }
}
