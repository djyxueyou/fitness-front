// @ts-ignore -- Vitest runs in Node; the uni-app production tsconfig intentionally omits Node types.
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rootUrl = new URL('../../../', import.meta.url)
const readSource = (path: string) => readFileSync(new URL(path, rootUrl), 'utf8')

describe('onboarding removal', () => {
  it('removes the onboarding page, store and API module', () => {
    expect(existsSync(new URL('src/pages/onboarding/index.vue', rootUrl))).toBe(false)
    expect(existsSync(new URL('src/stores/onboarding.ts', rootUrl))).toBe(false)
    expect(existsSync(new URL('src/api/onboarding.ts', rootUrl))).toBe(false)
  })

  it('removes onboarding routes and home branching', () => {
    expect(readSource('src/pages.json')).not.toContain('pages/onboarding')
    expect(readSource('src/utils/navigation.ts')).not.toMatch(/onboarding/)
    expect(readSource('src/pages/home/index.vue')).not.toMatch(/onboarding|训练画像|建立训练档案/)
  })

  it('exports training data without a training profile payload', () => {
    expect(readSource('src/pages/profile/data-privacy.vue')).not.toMatch(
      /trainingProfile|训练偏好|product-events/
    )
  })
})
