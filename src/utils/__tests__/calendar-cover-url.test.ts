import { describe, expect, it } from 'vitest'
import { normalizeCalendarCoverItems, safeCalendarCoverUrl } from '@/utils/calendar-cover-url'

describe('calendar cover url', () => {
  it('rejects backend media paths that the mini program would treat as local files', () => {
    expect(safeCalendarCoverUrl('/media/exercises/thumbs/male/chest/bench.jpg')).toBeUndefined()
  })

  it('preserves resolved remote urls and app static resources', () => {
    expect(safeCalendarCoverUrl('https://assets.example.com/media/exercises/bench.jpg')).toBe(
      'https://assets.example.com/media/exercises/bench.jpg'
    )
    expect(safeCalendarCoverUrl('/static/images/exercise-placeholder.png')).toBe(
      '/static/images/exercise-placeholder.png'
    )
  })

  it('normalizes every calendar item without mutating the response', () => {
    const items = [
      { id: 1, coverUrl: '/media/exercises/broken.jpg' },
      { id: 2, coverUrl: 'https://assets.example.com/media/exercises/valid.jpg' }
    ]

    expect(normalizeCalendarCoverItems(items)).toEqual([
      { id: 1, coverUrl: undefined },
      { id: 2, coverUrl: 'https://assets.example.com/media/exercises/valid.jpg' }
    ])
    expect(items[0].coverUrl).toBe('/media/exercises/broken.jpg')
  })
})
