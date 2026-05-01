export function formatDuration(minutes: number) {
  return `${minutes} min`
}

export function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatWorkoutDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${year}年${month}月${day}日`
}

export function monthDay(value: string) {
  const [, month, day] = value.split('-')
  return `${month}月${day}日`
}
