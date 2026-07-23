<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useProfileStore } from '@/stores/profile'
import { useThemeStore } from '@/stores/theme'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { validateProfileField, type ProfileEditableField } from '@/utils/profile-editing'

const profileStore = useProfileStore()
const themeStore = useThemeStore()
const field = ref<ProfileEditableField>('nickname')
const inputValue = ref('')
const initialValue = ref('')
const saving = ref(false)
const synced = ref(false)

const title = computed(() => (field.value === 'nickname' ? '修改昵称' : '修改身高'))
const helper = computed(() =>
  field.value === 'nickname'
    ? '好昵称可以让训练记录更容易识别。'
    : '身高将用于身体指标和个性化训练建议。'
)
const validation = computed(() => validateProfileField(field.value, inputValue.value))
const validationError = computed(() => ('error' in validation.value ? validation.value.error : ''))
const changed = computed(() => inputValue.value.trim() !== initialValue.value)
const canComplete = computed(() => !validationError.value && !saving.value)

onLoad((query = {}) => {
  field.value = query.field === 'height' ? 'height' : 'nickname'
})

onShow(async () => {
  const ok = await ensureFeatureAuth('编辑资料')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  if (!synced.value) {
    await profileStore.refreshProfile()
    syncInput()
    synced.value = true
  }
})

function syncInput() {
  const next =
    field.value === 'nickname'
      ? profileStore.nickname
      : profileStore.heightCm
        ? String(profileStore.heightCm)
        : ''
  inputValue.value = next
  initialValue.value = next.trim()
}

function goBack() {
  uni.navigateBack()
}

async function save() {
  if (saving.value) return
  const result = validation.value
  if ('error' in result) {
    uni.showToast({ title: result.error, icon: 'none' })
    return
  }
  if (!changed.value) {
    goBack()
    return
  }
  saving.value = true
  try {
    await profileStore.saveProfilePatch(
      field.value === 'nickname'
        ? { nickname: String(result.value) }
        : { heightCm: result.value as number | null }
    )
    uni.showToast({ title: '已保存', icon: 'none' })
    setTimeout(goBack, 260)
  } catch (err) {
    uni.showToast({ title: '保存失败，请重试', icon: 'none' })
    console.error('[profile-edit-field] save failed', err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <view class="page-shell profile-field safe-bottom" :class="themeStore.themeClass">
    <view class="profile-field__header">
      <view class="profile-field__back btn-press" aria-label="返回" @tap="goBack">
        <image
          class="profile-field__back-icon"
          src="/static/icons/chevron-down.svg"
          mode="aspectFit"
        />
      </view>
      <view class="profile-field__title">{{ title }}</view>
      <view class="profile-field__header-spacer" />
    </view>

    <view class="profile-field__editor">
      <input
        v-model="inputValue"
        class="profile-field__input"
        :type="field === 'height' ? 'digit' : 'text'"
        :maxlength="field === 'nickname' ? 20 : 5"
        :placeholder="field === 'nickname' ? '请输入昵称' : '请输入身高'"
        placeholder-class="profile-field__placeholder"
        focus
        @confirm="save"
      />
      <view v-if="field === 'height'" class="profile-field__unit">cm</view>
      <view v-else class="profile-field__count">{{ inputValue.trim().length }}/20</view>
    </view>

    <view v-if="validationError && inputValue.trim()" class="profile-field__error">
      {{ validationError }}
    </view>
    <view v-else class="profile-field__helper">{{ helper }}</view>

    <view class="profile-field__action-bar">
      <view
        class="profile-field__complete btn-press"
        :class="{ 'profile-field__complete--disabled': !canComplete }"
        @tap="save"
      >
        {{ saving ? '保存中...' : '完成' }}
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.profile-field {
  min-height: 100vh;
  padding-bottom: 190rpx;

  &__header {
    min-height: 84rpx;
    margin-bottom: 58rpx;
    display: grid;
    grid-template-columns: 112rpx 1fr 112rpx;
    align-items: center;
  }

  &__back {
    width: 72rpx;
    height: 72rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__back-icon {
    width: 34rpx;
    height: 34rpx;
    transform: rotate(90deg);
  }

  &__title {
    color: var(--app-text);
    font-size: 36rpx;
    font-weight: 900;
    text-align: center;
  }

  &__action-bar {
    position: fixed;
    left: 32rpx;
    right: 32rpx;
    bottom: calc(env(safe-area-inset-bottom) + 24rpx);
    z-index: 20;
  }

  &__complete {
    min-height: 88rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: var(--app-accent);
    box-shadow: 0 14rpx 34rpx rgba(255, 100, 24, 0.2);
    font-size: 28rpx;
    font-weight: 900;
  }

  &__complete--disabled {
    color: var(--app-text-muted);
    background: var(--app-border);
    box-shadow: none;
  }

  &__editor {
    position: relative;
    display: flex;
    align-items: center;
    border-bottom: 2rpx solid var(--app-border-strong);
  }

  &__input {
    width: 100%;
    height: 88rpx;
    padding: 0 90rpx 0 8rpx;
    box-sizing: border-box;
    color: var(--app-text);
    font-size: 34rpx;
  }

  &__unit,
  &__count {
    position: absolute;
    right: 8rpx;
    color: var(--app-text-muted);
    font-size: 23rpx;
  }

  &__helper,
  &__error {
    margin: 26rpx 8rpx 0;
    color: var(--app-text-muted);
    font-size: 23rpx;
    line-height: 1.5;
  }

  &__error {
    color: var(--app-danger);
  }

  &__placeholder {
    color: var(--app-text-muted);
  }
}
</style>
