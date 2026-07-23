// @ts-ignore -- Vitest runs in Node; the uni-app production tsconfig intentionally omits Node types.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rootUrl = new URL('../../../', import.meta.url)
const readSource = (path: string) => readFileSync(new URL(path, rootUrl), 'utf8')

describe('training level XP V2 contract', () => {
  it('removes streak and duration bonus fields from frontend contracts', () => {
    const contracts = [
      'src/api/training-level.ts',
      'src/api/training.ts',
      'src/api/analytics.ts',
      'src/api/user.ts'
    ]

    contracts.forEach((path) => {
      expect(readSource(path)).not.toMatch(/currentStreakDays|durationBonusExp|streakBonusExp/)
    })
  })

  it('documents the effective workout, plan, PR and daily-cap rules', () => {
    const page = readSource('src/pages/profile/index.vue')

    expect(page).toContain('3 个正式组')
    expect(page).toContain('15 分钟')
    expect(page).toContain('计划日 +4 XP')
    expect(page).toContain('产生新 PR +2 XP')
    expect(page).toContain('每天最多 26 XP')
    expect(page).not.toContain('连续训练')
  })

  it('uses the settlement returned by save instead of history-page settlement query flags', () => {
    const activePage = readSource('src/pages/home/workout-active.vue')
    const detailPage = readSource('src/pages/home/history-detail.vue')

    expect(activePage).not.toContain('settleLevel=1')
    expect(detailPage).not.toContain('settleTrainingLevel')
    expect(detailPage).toContain('completedSummary?.levelSettlement')
  })

  it('renders the returned base, plan and PR breakdown', () => {
    const rewardCard = readSource('src/components/training-level-reward-card/index.vue')

    expect(rewardCard).toContain('settlement.baseExp')
    expect(rewardCard).toContain('settlement.planBonusExp')
    expect(rewardCard).toContain('settlement.prBonusExp')
  })
})
