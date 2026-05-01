export interface Template {
  id: number
  name: string
  templateType?: 'USER' | 'SYSTEM' | string
  description?: string
  tag: string
  exercises: number
  duration: number
  level: string
  muscles: string[]
  color: string
  accent: string
}
