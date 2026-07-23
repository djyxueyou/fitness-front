import { describe, expect, it } from 'vitest'

describe('training level presentation module', () => {
  it('defines truthful ranges for every badge tier', async () => {
    const presentation = await import('@/utils/training-level-presentation')

    expect(presentation.TRAINING_BADGE_PREVIEWS).toEqual([
      { badgeCode: 'BRONZE', badgeName: '青铜', range: 'Lv.1–5', accentColor: '#cd7f32' },
      { badgeCode: 'SILVER', badgeName: '白银', range: 'Lv.6–10', accentColor: '#b8c0cc' },
      { badgeCode: 'GOLD', badgeName: '黄金', range: 'Lv.11–20', accentColor: '#d6a63a' },
      { badgeCode: 'PLATINUM', badgeName: '铂金', range: 'Lv.21–35', accentColor: '#94a3b8' },
      { badgeCode: 'DIAMOND', badgeName: '钻石', range: 'Lv.36–55', accentColor: '#60a5fa' },
      { badgeCode: 'STELLAR', badgeName: '星耀', range: 'Lv.56–80', accentColor: '#8b5cf6' },
      { badgeCode: 'GLORY', badgeName: '荣耀', range: 'Lv.81+', accentColor: '#f59e0b' }
    ])
  })
})
