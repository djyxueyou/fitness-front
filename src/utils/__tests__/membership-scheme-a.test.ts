// @ts-ignore -- Vitest runs in Node; the uni-app production tsconfig intentionally omits Node types.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rootUrl = new URL('../../../', import.meta.url)
const readSource = (path: string) => readFileSync(new URL(path, rootUrl), 'utf8')

describe('membership scheme A contract', () => {
  it('does not expose trial state in the membership API or store', () => {
    expect(readSource('src/api/membership.ts')).not.toMatch(/trial|trialEndsAt/i)
    expect(readSource('src/stores/membership.ts')).not.toMatch(/trial|试用/i)
  })

  it('describes core workout records as free and custom quotas as one', () => {
    const page = readSource('src/pages/profile/membership.vue')
    expect(page).not.toMatch(/免费版每周|不限训练记录/)
    expect(page).toContain('训练记录永久免费')
    expect(page).toContain('1 个自定义动作')
    expect(page).toContain('1 个自定义训练模板')
    expect(page).toContain('周统计')
  })

  it('does not pre-lock the first free custom exercise', () => {
    const page = readSource('src/pages/exercises/index.vue')
    expect(page).not.toMatch(/ensureMembershipFeature\('自定义动作'\)/)
  })
})
