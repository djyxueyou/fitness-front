import type { Exercise, ExerciseRecord } from '@/types/exercise'

export const exerciseCategories = ['全部', '胸', '背', '腿', '肩', '手臂', '核心', '有氧']

export const exercises: Exercise[] = [
  {
    id: 1,
    name: '卧推',
    category: '胸',
    muscle: '胸大肌',
    equipment: '杠铃',
    level: '中级',
    favorited: false
  },
  {
    id: 2,
    name: '哑铃飞鸟',
    category: '胸',
    muscle: '胸大肌',
    equipment: '哑铃',
    level: '初级',
    favorited: true
  },
  {
    id: 3,
    name: '上斜卧推',
    category: '胸',
    muscle: '上胸',
    equipment: '杠铃',
    level: '中级',
    favorited: false
  },
  {
    id: 4,
    name: '引体向上',
    category: '背',
    muscle: '背阔肌',
    equipment: '单杠',
    level: '中级',
    favorited: true
  },
  {
    id: 5,
    name: '坐姿划船',
    category: '背',
    muscle: '背阔肌',
    equipment: '器械',
    level: '初级',
    favorited: false
  },
  {
    id: 6,
    name: '深蹲',
    category: '腿',
    muscle: '股四头肌',
    equipment: '杠铃',
    level: '中级',
    favorited: true
  },
  {
    id: 7,
    name: '腿举',
    category: '腿',
    muscle: '股四头肌',
    equipment: '器械',
    level: '初级',
    favorited: false
  },
  {
    id: 8,
    name: '侧平举',
    category: '肩',
    muscle: '三角肌',
    equipment: '哑铃',
    level: '初级',
    favorited: false
  },
  {
    id: 9,
    name: '弯举',
    category: '手臂',
    muscle: '肱二头肌',
    equipment: '哑铃',
    level: '初级',
    favorited: false
  },
  {
    id: 10,
    name: '平板支撑',
    category: '核心',
    muscle: '腹肌',
    equipment: '自重',
    level: '初级',
    favorited: false
  }
]

export const exerciseTips = [
  '保持核心收紧，不要塌腰。',
  '下放时吸气，发力时呼气。',
  '全程控制节奏，不要借力。',
  '肩胛骨后缩下沉，保证动作稳定。'
]

export const exerciseRecords: Record<number, ExerciseRecord> = {
  1: { maxWeight: '80 kg', bestSet: '70 × 10' },
  2: { maxWeight: '24 kg', bestSet: '20 × 12' },
  3: { maxWeight: '75 kg', bestSet: '65 × 8' },
  4: { maxWeight: '自重 + 15 kg', bestSet: '12 次' },
  5: { maxWeight: '70 kg', bestSet: '60 × 12' },
  6: { maxWeight: '120 kg', bestSet: '100 × 8' },
  7: { maxWeight: '180 kg', bestSet: '160 × 12' },
  8: { maxWeight: '12 kg', bestSet: '10 × 15' },
  9: { maxWeight: '16 kg', bestSet: '14 × 12' },
  10: { maxWeight: '180 秒', bestSet: '120 秒' }
}
