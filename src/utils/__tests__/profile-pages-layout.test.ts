import { describe, expect, it } from 'vitest'
import editSource from '../../pages/profile/edit.vue?raw'
import editFieldSource from '../../pages/profile/edit-field.vue?raw'
import profileSource from '../../pages/profile/index.vue?raw'

describe('profile page interaction structure', () => {
  it('keeps edit navigation and level detail visually distinct', () => {
    expect(profileSource).toContain('class="profile__identity btn-press"')
    expect(profileSource).toContain('class="profile__level-pill btn-press"')
    expect(profileSource).toContain('@tap.stop="openLevelDetail"')
    expect(profileSource).not.toContain('class="profile__level-entry btn-press"')
    expect(profileSource).not.toContain('等级详情')
  })

  it('does not generate fake level numbers from badge order', () => {
    expect(profileSource).not.toContain(':level="index + 1"')
    expect(profileSource).toContain(':show-level="false"')
    expect(profileSource).toContain('去完成有效训练')
  })

  it('uses a grouped overview without a global save action', () => {
    expect(editSource).not.toContain('fetchLatestBodyMetrics')
    expect(editSource).toContain('profile-edit__section-title">基础资料')
    expect(editSource).toContain("openFieldEditor('nickname')")
    expect(editSource).toContain("openFieldEditor('height')")
    expect(editSource).not.toContain('<PrimaryButton')
    expect(editSource).not.toContain('保存资料')
  })

  it('provides focused nickname and height editing', () => {
    expect(editFieldSource).toContain("field.value === 'nickname' ? '修改昵称' : '修改身高'")
    expect(editFieldSource).toContain('class="profile-field__complete btn-press"')
    expect(editFieldSource).not.toContain('class="profile-field__save btn-press"')
    expect(editFieldSource).toContain(
      'const canComplete = computed(() => !validationError.value && !saving.value)'
    )
    expect(editFieldSource).toContain('validateProfileField')
  })
})
