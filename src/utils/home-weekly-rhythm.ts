export interface WeeklyRhythmDates {
  weekStart: string
  trainedDates: string[]
}

export interface WeeklyRhythmDay {
  day: string
  date: string
  trained: boolean
  isToday: boolean
}

export function parseLocalDateOnly(value?: string | null) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  if (!match) return null
  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return toDateString(date) === value ? date : null
}

export function buildWeeklyRhythmDays(
  rhythm: WeeklyRhythmDates | null,
  today = new Date()
): WeeklyRhythmDay[] {
  const weekStart = parseLocalDateOnly(rhythm?.weekStart) || getWeekStart(today)
  const todayString = toDateString(today)
  const trainedDateSet = new Set(rhythm?.trainedDates || [])

  return ['一', '二', '三', '四', '五', '六', '日'].map((day, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    const dateString = toDateString(date)
    return {
      day,
      date: dateString,
      trained: trainedDateSet.has(dateString),
      isToday: dateString === todayString
    }
  })
}

function getWeekStart(date: Date) {
  const start = new Date(date)
  const day = start.getDay() || 7
  start.setDate(start.getDate() - day + 1)
  start.setHours(0, 0, 0, 0)
  return start
}

function toDateString(date: Date) {
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
