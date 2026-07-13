export function workoutHeaderActions(isSubmitting: boolean, isPaused = false) {
  return {
    minimizeLabel: '最小化训练',
    exitLabel: '退出训练',
    pauseLabel: isPaused ? '继续' : '暂停',
    finishLabel: isSubmitting ? '保存中' : '完成训练',
    finishDisabled: isSubmitting
  }
}
