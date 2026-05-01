export interface Exercise {
  id: number
  name: string
  category: string
  muscle: string
  equipment: string
  level: '初级' | '中级' | '高级'
  favorited?: boolean
}

export interface ExerciseRecord {
  maxWeight: string
  bestSet: string
}
