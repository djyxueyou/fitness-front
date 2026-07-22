// @ts-ignore -- Vitest runs in Node; production tsconfig omits Node types.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildWeeklyRhythmDays, parseLocalDateOnly } from '@/utils/home-weekly-rhythm'

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
    expect(templateStore).toMatch(
      /const canCommit = \(\) =>\s+sessionGeneration === requestSession &&\s+fetchGeneration === requestGeneration &&\s+shouldCommit\(\)/
    )
    expect(templateStore).toMatch(
      /const list = await fetchTemplateList\(\)\s+if \(!includeDetails\) {\s+if \(!canCommit\(\)\) return\s+items\.value = list\.map/
    )
  })

  it('invalidates template requests across sessions and keeps fetch cleanup identity-safe', () => {
    const home = readSource('src/pages/home/index.vue')
    const templateStore = readSource('src/stores/template.ts')
    expect(home).toContain('templateStore.invalidateSession()')
    expect(templateStore).toContain('let sessionGeneration = 0')
    expect(templateStore).toContain('let fetchGeneration = 0')
    expect(templateStore).toContain('const requestSession = sessionGeneration')
    expect(templateStore).toContain('const requestGeneration = fetchGeneration')
    expect(templateStore).toContain('sessionGeneration === requestSession')
    expect(templateStore).toContain('fetchGeneration === requestGeneration')
    expect(templateStore).toMatch(
      /function invalidateTemplateReads\(\) {\s+fetchGeneration \+= 1\s+fetchPromise = null/
    )
    expect(templateStore).toMatch(
      /function invalidateSession\(\) {\s+sessionGeneration \+= 1\s+invalidateTemplateReads\(\)/
    )
    expect(templateStore).toContain('items.value = []')
    expect(templateStore).toContain('detailCache.value = {}')
    expect(templateStore).toContain('fetchPromise = null')
    expect(templateStore).toContain('if (fetchPromise === pendingFetch)')
  })

  it('anchors the seven day rhythm to the server week instead of the device current week', () => {
    const days = buildWeeklyRhythmDays(
      {
        weekStart: '2026-07-06',
        trainedDates: ['2026-07-06', '2026-07-12']
      },
      new Date(2026, 6, 22, 12)
    )

    expect(days.map((day) => day.date)).toEqual([
      '2026-07-06',
      '2026-07-07',
      '2026-07-08',
      '2026-07-09',
      '2026-07-10',
      '2026-07-11',
      '2026-07-12'
    ])
    expect(days.filter((day) => day.trained).map((day) => day.date)).toEqual([
      '2026-07-06',
      '2026-07-12'
    ])
    expect(days.some((day) => day.isToday)).toBe(false)
  })

  it('parses date-only values in local time and falls back to the current local week', () => {
    const parsed = parseLocalDateOnly('2026-07-06')
    expect(parsed).not.toBeNull()
    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(6)
    expect(parsed?.getDate()).toBe(6)

    const days = buildWeeklyRhythmDays(null, new Date(2026, 6, 22, 12))
    expect(days[0]?.date).toBe('2026-07-20')
    expect(days[2]).toMatchObject({ date: '2026-07-22', isToday: true })
  })

  it('falls back for an invalid server week start', () => {
    const days = buildWeeklyRhythmDays(
      { weekStart: '2026-02-30', trainedDates: [] },
      new Date(2026, 6, 22, 12)
    )

    expect(days[0]?.date).toBe('2026-07-20')
    expect(days[6]?.date).toBe('2026-07-26')
  })

  it('keeps a local calendar sequence across month and year boundaries', () => {
    const days = buildWeeklyRhythmDays(
      { weekStart: '2025-12-29', trainedDates: ['2026-01-01'] },
      new Date(2026, 0, 1, 12)
    )

    expect(days.map((day) => day.date)).toEqual([
      '2025-12-29',
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04'
    ])
    expect(days[3]).toMatchObject({ trained: true, isToday: true })
  })
})
