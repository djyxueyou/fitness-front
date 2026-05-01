export interface WorkoutHistoryRecord {
  date: string
  name: string
  duration: number
  type: 'push' | 'pull' | 'legs'
}

export interface WorkoutDayRecord {
  type: 'push' | 'pull' | 'legs'
  name: string
  duration: number
}
