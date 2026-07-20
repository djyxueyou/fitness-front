// @ts-ignore -- Vitest runs in Node; production tsconfig omits Node types.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rootUrl = new URL('../../../', import.meta.url)
const readSource = (path: string) => readFileSync(new URL(path, rootUrl), 'utf8')

describe('home weekly rhythm contract', () => {
  it('uses one free aggregate instead of membership-gated summary and weekly history', () => {
    const home = readSource('src/pages/home/index.vue')
    expect(home).toContain('fetchHomeWeeklyRhythm')
    expect(home).not.toContain('fetchTrainingSummary')
    expect(home).not.toContain('weekHistory')
    expect(home).not.toContain('v-else-if="!membershipStore.active"')
    expect(home).not.toContain('membershipStore')
    expect(home).not.toContain('refreshStatus')
    expect(home).not.toMatch(/pageSize:\s*50/)
    expect(home).not.toMatch(/limit:\s*50/)
    expect(home).toContain('查看本周完成情况')
  })

  it('deduplicates in-flight loads and invalidates stale requests on logout or forced refresh', () => {
    const home = readSource('src/pages/home/index.vue')
    expect(home).toContain('let homeLoadPromise: Promise<void> | null = null')
    expect(home).toContain('let homeLoadEpoch = 0')
    expect(home).toContain('function clearHomeData()')
    expect(home).toContain('homeLoadEpoch += 1')
    expect(home).toContain('if (homeLoadPromise && !options?.forceTemplates)')
    expect(home).toContain('isHomeLoadActive(epoch)')
    expect(home).toContain('await Promise.allSettled')
  })

  it('keeps template loading inside the epoch guard without loading the full plan list', () => {
    const home = readSource('src/pages/home/index.vue')
    const templateStore = readSource('src/stores/template.ts')
    expect(home).not.toContain('planStore.fetchPlans')
    expect(home).not.toContain('templateStore.fetchTemplates({ includeDetails: false }).catch')
    expect(home).toContain('shouldCommit: () => isHomeLoadActive(epoch)')
    expect(templateStore).toContain('shouldCommit?: () => boolean')
    expect(templateStore).toContain('if (!shouldCommit()) return')
  })

  it('invalidates template requests across sessions and keeps fetch cleanup identity-safe', () => {
    const home = readSource('src/pages/home/index.vue')
    const templateStore = readSource('src/stores/template.ts')
    expect(home).toContain('templateStore.invalidateSession()')
    expect(templateStore).toContain('let fetchGeneration = 0')
    expect(templateStore).toContain('const generation = fetchGeneration')
    expect(templateStore).toContain('fetchGeneration === generation && shouldCommit()')
    expect(templateStore).toContain('function invalidateSession()')
    expect(templateStore).toContain('fetchGeneration += 1')
    expect(templateStore).toContain('items.value = []')
    expect(templateStore).toContain('detailCache.value = {}')
    expect(templateStore).toContain('fetchPromise = null')
    expect(templateStore).toContain('if (fetchPromise === pendingFetch)')
  })
})
