import type { WorkoutDayRecord, WorkoutHistoryRecord } from '@/types/history'

export const historyList: WorkoutHistoryRecord[] = [
  { date: '2025-06-26', name: '\u80f8\u808c\u8bad\u7ec3', duration: 45, type: 'push' },
  { date: '2025-06-24', name: '\u80cc\u90e8\u8bad\u7ec3', duration: 50, type: 'pull' },
  { date: '2025-06-22', name: '\u80a9\u90e8\u8bad\u7ec3', duration: 42, type: 'push' },
  { date: '2025-06-19', name: '\u817f\u90e8\u8bad\u7ec3', duration: 65, type: 'legs' },
  { date: '2025-06-17', name: '\u80f8\u808c\u8bad\u7ec3', duration: 45, type: 'push' }
]

export const workoutDays: Record<string, WorkoutDayRecord> = {
  '2025-06-01': { type: 'push', name: '\u80f8\u808c\u8bad\u7ec3', duration: 45 },
  '2025-06-03': { type: 'pull', name: '\u80cc\u90e8\u8bad\u7ec3', duration: 50 },
  '2025-06-05': { type: 'legs', name: '\u817f\u90e8\u8bad\u7ec3', duration: 60 },
  '2025-06-08': { type: 'push', name: '\u80a9\u90e8\u8bad\u7ec3', duration: 40 },
  '2025-06-10': { type: 'push', name: '\u80f8\u808c\u8bad\u7ec3', duration: 48 },
  '2025-06-12': { type: 'legs', name: '\u5168\u8eab HIIT', duration: 30 },
  '2025-06-15': { type: 'pull', name: '\u80cc\u90e8\u8bad\u7ec3', duration: 55 },
  '2025-06-17': { type: 'push', name: '\u80f8\u808c\u8bad\u7ec3', duration: 45 },
  '2025-06-19': { type: 'legs', name: '\u817f\u90e8\u8bad\u7ec3', duration: 65 },
  '2025-06-22': { type: 'push', name: '\u80a9\u90e8\u8bad\u7ec3', duration: 42 },
  '2025-06-24': { type: 'pull', name: '\u80cc\u90e8\u8bad\u7ec3', duration: 50 },
  '2025-06-26': { type: 'push', name: '\u80f8\u808c\u8bad\u7ec3', duration: 45 }
}

export const detailExercises = [
  { name: '\u5367\u63a8', sets: ['60kg × 10', '65kg × 10', '70kg × 8'] },
  { name: '\u4e0a\u659c\u54d1\u94c3\u5367\u63a8', sets: ['22kg × 12', '24kg × 12', '26kg × 10'] },
  { name: '\u5939\u80f8', sets: ['40kg × 15', '45kg × 12', '45kg × 10'] }
]

export const weeklyVolume = [
  { week: 'W1', volume: 8500, sessions: 3 },
  { week: 'W2', volume: 10200, sessions: 4 },
  { week: 'W3', volume: 9800, sessions: 3 },
  { week: 'W4', volume: 12450, sessions: 4 },
  { week: 'W5', volume: 11300, sessions: 4 },
  { week: 'W6', volume: 13800, sessions: 5 }
]

export const muscleDistribution = [
  { name: '\u80f8\u5927\u808c', pct: 28, color: '#ff501e' },
  { name: '\u80cc\u9614\u808c', pct: 24, color: '#50c8ff' },
  { name: '\u80a1\u56db\u5934\u808c', pct: 20, color: '#c850ff' },
  { name: '\u4e09\u89d2\u808c', pct: 15, color: '#ffc850' },
  { name: '\u5176\u4ed6', pct: 13, color: '#828296' }
]
