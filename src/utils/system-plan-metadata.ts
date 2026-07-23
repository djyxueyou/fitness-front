export function systemPlanDifficultyText(level?: string) {
  const labels: Record<string, string> = {
    BEGINNER: '入门',
    BEGINNER_INTERMEDIATE: '新手到进阶',
    INTERMEDIATE: '进阶',
    ADVANCED: '高阶'
  }
  return level ? labels[level] || '通用' : '通用'
}

export function systemPlanGoalText(goal?: string) {
  const labels: Record<string, string> = {
    STARTER: '入门体验',
    FOUNDATION: '基础力量',
    MUSCLE_GAIN: '增肌',
    HYPERTROPHY: '增肌',
    HOME_FITNESS: '居家训练',
    STRENGTH: '力量提升',
    FAT_LOSS: '减脂塑形',
    BODY_SHAPING: '塑形',
    GENERAL_FITNESS: '综合训练'
  }
  return goal ? labels[goal] || '综合训练' : '综合训练'
}
