import type { Template } from '@/types/template'

export const templates: Template[] = [
  {
    id: 1,
    name: '胸肌强化训练',
    tag: 'Push',
    exercises: 6,
    duration: 45,
    level: '中级',
    muscles: ['胸大肌', '三角肌', '肱三头肌'],
    color: 'rgba(255, 80, 30, 0.15)',
    accent: '#ff501e'
  },
  {
    id: 2,
    name: '背部雕塑训练',
    tag: 'Pull',
    exercises: 5,
    duration: 50,
    level: '中级',
    muscles: ['背阔肌', '斜方肌', '肱二头肌'],
    color: 'rgba(80, 200, 255, 0.15)',
    accent: '#50c8ff'
  },
  {
    id: 3,
    name: '腿部爆发训练',
    tag: 'Legs',
    exercises: 7,
    duration: 60,
    level: '高级',
    muscles: ['股四头肌', '臀肌', '腘绳肌'],
    color: 'rgba(200, 80, 255, 0.15)',
    accent: '#c850ff'
  },
  {
    id: 4,
    name: '全身 HIIT',
    tag: 'HIIT',
    exercises: 8,
    duration: 30,
    level: '高级',
    muscles: ['全身', '核心', '心肺'],
    color: 'rgba(255, 200, 80, 0.15)',
    accent: '#ffc850'
  }
]

export const recentTemplateIds = [1, 2, 3]
