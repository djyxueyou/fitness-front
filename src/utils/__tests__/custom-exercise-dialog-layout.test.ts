import { describe, expect, it } from 'vitest'
import componentSource from '../../components/custom-exercise-dialog/index.vue?raw'

describe('custom exercise dialog responsive layout', () => {
  it('keeps record types horizontal without relying on a viewport media query', () => {
    const baseStyles = componentSource.slice(
      componentSource.indexOf('<style'),
      componentSource.indexOf('@media screen and (max-height: 740px)')
    )

    expect(baseStyles).toContain(
      '&__types {\n    display: grid;\n    grid-template-columns: repeat(3, minmax(0, 1fr));'
    )
    expect(baseStyles).toContain('&__type-desc {\n    display: none;')
    expect(baseStyles).toContain('&__type-hint {\n    display: block;')
  })

  it('uses a compact density on short viewports without moving the action footer into the scroll area', () => {
    expect(componentSource).toContain('@media screen and (max-height: 740px)')
    expect(componentSource).toContain('height: 88vh')
    expect(componentSource).toContain(
      '<view class="custom-exercise-dialog__type-hint">{{ recordTypeDescription }}</view>'
    )
    expect(componentSource).toContain('&__actions {\n      padding-top: 12rpx;')

    const scrollEnd = componentSource.indexOf('</scroll-view>')
    const actionsStart = componentSource.indexOf('<view class="custom-exercise-dialog__actions">')
    expect(actionsStart).toBeGreaterThan(scrollEnd)
  })
})
