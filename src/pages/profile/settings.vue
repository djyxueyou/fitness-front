<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { useProfileStore } from '@/stores/profile'
import { useThemeStore, type ThemeMode } from '@/stores/theme'

const profileStore = useProfileStore()
const themeStore = useThemeStore()
const saving = ref(false)
const restInput = ref(String(profileStore.restSeconds))
const restPresets = [60, 90, 120, 180]
const themeOptions: Array<{ value: ThemeMode; label: string; description: string }> = [
  { value: 'system', label: '跟随系统', description: '自动匹配设备外观' },
  { value: 'light', label: '亮色', description: '明亮清晰，适合白天' },
  { value: 'dark', label: '暗色', description: '降低亮度，适合夜间' }
]

onShow(async () => {
  const ok = await ensureFeatureAuth('个人设置')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  await profileStore.refreshProfile()
  restInput.value = String(profileStore.restSeconds)
})

function goBack() {
  uni.navigateBack()
}

function openDataPrivacy() {
  uni.navigateTo({ url: routes.dataPrivacy })
}

function stepRest(seconds: number) {
  const next = profileStore.restSeconds + seconds
  if (next < 30 || next > 300 || saving.value) return
  void changeRest(next)
}

function setRest(seconds: number) {
  if (seconds === profileStore.restSeconds || saving.value) return
  void changeRest(seconds)
}

function onRestInputBlur(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) {
    restInput.value = String(profileStore.restSeconds)
    return
  }
  const next = Math.min(300, Math.max(30, Math.round(value)))
  if (next === profileStore.restSeconds) {
    restInput.value = String(profileStore.restSeconds)
    return
  }
  void changeRest(next)
}

async function changeRest(seconds: number) {
  if (saving.value) return
  saving.value = true
  try {
    await profileStore.saveSettings({
      weightUnit: profileStore.unit,
      restSeconds: seconds
    })
    restInput.value = String(seconds)
    uni.showToast({ title: '设置已保存', icon: 'none' })
  } catch (err) {
    restInput.value = String(profileStore.restSeconds)
    uni.showToast({ title: '保存失败，请重试', icon: 'none' })
    console.error('[settings] save rest seconds failed', {
      restSeconds: seconds,
      error: err
    })
  } finally {
    saving.value = false
  }
}

async function changeUnit(unit: 'kg' | 'lb') {
  if (saving.value || unit === profileStore.unit) return
  saving.value = true
  try {
    await profileStore.saveSettings({
      weightUnit: unit,
      restSeconds: profileStore.restSeconds
    })
    uni.showToast({ title: '单位已保存', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '保存失败，请重试', icon: 'none' })
    console.error('[settings] save weight unit failed', {
      weightUnit: unit,
      error: err
    })
  } finally {
    saving.value = false
  }
}

async function saveTrainingPreference(next: Parameters<typeof profileStore.saveTrainingPreferences>[0]) {
  if (saving.value) return
  saving.value = true
  try {
    await profileStore.saveTrainingPreferences(next)
    uni.showToast({ title: '训练设置已保存', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '保存失败，请重试', icon: 'none' })
    console.error('[settings] save training preference failed', err)
  } finally {
    saving.value = false
  }
}

function stepTrainingPreference(
  key: 'weightStepKg' | 'weightStepLb' | 'repsStep' | 'durationStepSeconds' | 'barWeightKg',
  delta: number
) {
  const current = Number(profileStore[key])
  const next = Number((current + delta).toFixed(2))
  void saveTrainingPreference({ [key]: next })
}

function toggleRestVibration() {
  void saveTrainingPreference({ restVibration: !profileStore.restVibration })
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view class="page-shell settings safe-bottom" :class="themeStore.themeClass">
      <AppHeader title="设置" show-back @back="goBack" />

      <view class="settings__hero glass-card">
        <view class="settings__hero-icon">⏱</view>
        <view class="settings__hero-body">
          <view class="settings__eyebrow">Training Preference</view>
          <view class="settings__title">组间休息时长</view>
          <view class="settings__desc">
            每组完成后自动启动休息倒计时，训练中仍可临时跳过或加时。
          </view>
        </view>
      </view>

      <view class="settings__control glass-card">
        <view class="settings__label-row">
          <view>
            <view class="settings__label">外观主题</view>
            <view class="settings__hint">切换后立即应用，并在下次启动时保留</view>
          </view>
          <view class="settings__saving">{{ themeStore.resolvedTheme === 'dark' ? '暗色' : '亮色' }}</view>
        </view>
        <view class="settings__theme-row">
          <view
            v-for="option in themeOptions"
            :key="option.value"
            class="settings__theme-option btn-press"
            :class="{ 'settings__theme-option--active': themeStore.mode === option.value }"
            @tap="themeStore.setMode(option.value)"
          >
            <view class="settings__theme-label">{{ option.label }}</view>
            <view class="settings__theme-desc">{{ option.description }}</view>
          </view>
        </view>
      </view>

      <view class="settings__control glass-card settings__privacy btn-press" @tap="openDataPrivacy">
        <view>
          <view class="settings__label">数据与隐私</view>
          <view class="settings__hint">导出数据或更新训练目标与条件</view>
        </view>
        <view class="settings__privacy-arrow">→</view>
      </view>

      <view class="settings__control glass-card">
        <view class="settings__label-row">
          <view>
            <view class="settings__label">重量单位</view>
            <view class="settings__hint">影响训练输入、容量统计和历史展示</view>
          </view>
          <view class="settings__saving">{{ saving ? '保存中' : '自动保存' }}</view>
        </view>
        <view class="settings__unit-row">
          <view
            class="settings__unit-option btn-press"
            :class="{ 'settings__unit-option--active': profileStore.unit === 'kg' }"
            @tap="changeUnit('kg')"
          >
            kg
          </view>
          <view
            class="settings__unit-option btn-press"
            :class="{ 'settings__unit-option--active': profileStore.unit === 'lb' }"
            @tap="changeUnit('lb')"
          >
            lb
          </view>
        </view>
      </view>

      <view class="settings__control glass-card">
        <view class="settings__label-row">
          <view>
            <view class="settings__label">默认休息</view>
            <view class="settings__hint">支持 30-300 秒，修改后自动保存</view>
          </view>
          <view class="settings__saving">{{ saving ? '保存中' : '自动保存' }}</view>
        </view>

        <view class="settings__value-row">
          <view class="settings__step-btn btn-press" @tap="stepRest(-30)">-30秒</view>
          <view class="settings__value-box">
            <input
              class="settings__value"
              type="number"
              v-model="restInput"
              :disabled="saving"
              @blur="onRestInputBlur"
            />
            <text class="settings__unit">秒</text>
          </view>
          <view class="settings__step-btn btn-press" @tap="stepRest(30)">+30秒</view>
        </view>

        <view class="settings__preset-row">
          <view
            v-for="seconds in restPresets"
            :key="seconds"
            class="settings__preset btn-press"
            :class="{ 'settings__preset--active': seconds === profileStore.restSeconds }"
            @tap="setRest(seconds)"
          >
            {{ seconds }}秒
          </view>
        </view>

        <view class="settings__range">
          <text class="settings__range-end">30s</text>
          <view class="settings__range-bar">
            <view
              class="settings__range-fill"
              :style="{ width: `${((profileStore.restSeconds - 30) / 270) * 100}%` }"
            />
          </view>
          <text class="settings__range-end">300s</text>
        </view>
      </view>

      <view class="settings__control glass-card">
        <view class="settings__label-row">
          <view>
            <view class="settings__label">休息提醒</view>
            <view class="settings__hint">小程序前台倒计时结束后提醒，不承诺后台通知。</view>
          </view>
          <view class="settings__saving">本地保存</view>
        </view>
        <view class="settings__unit-row">
          <view
            class="settings__unit-option btn-press"
            :class="{ 'settings__unit-option--active': profileStore.restVibration }"
            @tap="toggleRestVibration"
          >
            振动 {{ profileStore.restVibration ? '开' : '关' }}
          </view>
        </view>
      </view>

      <view class="settings__control glass-card">
        <view class="settings__label-row">
          <view>
            <view class="settings__label">训练输入步长</view>
            <view class="settings__hint">影响训练页的加减按钮、热身组取整和杠铃片计算。</view>
          </view>
          <view class="settings__saving">账号同步</view>
        </view>
        <view class="settings__preference-list">
          <view class="settings__preference-row">
            <view>
              <view class="settings__preference-title">kg 步长</view>
              <view class="settings__hint">当前 {{ profileStore.weightStepKg }}kg</view>
            </view>
            <view class="settings__mini-steps">
              <view class="settings__mini-step btn-press" @tap="stepTrainingPreference('weightStepKg', -0.5)">-</view>
              <view class="settings__mini-step btn-press" @tap="stepTrainingPreference('weightStepKg', 0.5)">+</view>
            </view>
          </view>
          <view class="settings__preference-row">
            <view>
              <view class="settings__preference-title">lb 步长</view>
              <view class="settings__hint">当前 {{ profileStore.weightStepLb }}lb</view>
            </view>
            <view class="settings__mini-steps">
              <view class="settings__mini-step btn-press" @tap="stepTrainingPreference('weightStepLb', -1)">-</view>
              <view class="settings__mini-step btn-press" @tap="stepTrainingPreference('weightStepLb', 1)">+</view>
            </view>
          </view>
          <view class="settings__preference-row">
            <view>
              <view class="settings__preference-title">次数步长</view>
              <view class="settings__hint">当前 {{ profileStore.repsStep }} 次</view>
            </view>
            <view class="settings__mini-steps">
              <view class="settings__mini-step btn-press" @tap="stepTrainingPreference('repsStep', -1)">-</view>
              <view class="settings__mini-step btn-press" @tap="stepTrainingPreference('repsStep', 1)">+</view>
            </view>
          </view>
          <view class="settings__preference-row">
            <view>
              <view class="settings__preference-title">时间步长</view>
              <view class="settings__hint">当前 {{ profileStore.durationStepSeconds }} 秒</view>
            </view>
            <view class="settings__mini-steps">
              <view class="settings__mini-step btn-press" @tap="stepTrainingPreference('durationStepSeconds', -5)">-</view>
              <view class="settings__mini-step btn-press" @tap="stepTrainingPreference('durationStepSeconds', 5)">+</view>
            </view>
          </view>
          <view class="settings__preference-row">
            <view>
              <view class="settings__preference-title">默认杠铃杆</view>
              <view class="settings__hint">当前 {{ profileStore.barWeightKg }}kg</view>
            </view>
            <view class="settings__mini-steps">
              <view class="settings__mini-step btn-press" @tap="stepTrainingPreference('barWeightKg', -2.5)">-</view>
              <view class="settings__mini-step btn-press" @tap="stepTrainingPreference('barWeightKg', 2.5)">+</view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </scroll-view>
</template>
<style lang="scss" scoped>
.settings {
  &__hero,
  &__control {
    border-color: var(--app-border);
  }

  &__hero {
    padding: 28rpx;
    display: flex;
    gap: 22rpx;
    background:
      radial-gradient(circle at 12% 0%, rgba(255, 80, 30, 0.18), transparent 44%),
      var(--app-surface);
  }

  &__hero-icon {
    width: 84rpx;
    height: 84rpx;
    border-radius: 28rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 80, 30, 0.14);
    font-size: 40rpx;
    flex-shrink: 0;
    box-shadow: 0 0 22rpx rgba(255, 80, 30, 0.14);
  }

  &__hero-body {
    flex: 1;
    min-width: 0;
  }

  &__eyebrow,
  &__hint,
  &__saving,
  &__range-end {
    color: var(--app-text-muted);
  }

  &__eyebrow {
    font-size: 20rpx;
    letter-spacing: 4rpx;
    text-transform: uppercase;
    color: var(--app-accent);
    font-weight: 900;
  }

  &__title {
    margin-top: 8rpx;
    color: var(--app-text);
    font-size: 34rpx;
    font-weight: 900;
  }

  &__desc {
    margin-top: 10rpx;
    color: var(--app-text-muted);
    font-size: 24rpx;
    line-height: 1.55;
  }

  &__control {
    margin-top: 24rpx;
    padding: 30rpx 26rpx;
  }

  &__label-row,
  &__value-row,
  &__range {
    display: flex;
    align-items: center;
  }

  &__label-row {
    justify-content: space-between;
    gap: 18rpx;
  }

  &__label {
    color: var(--app-text);
    font-size: 28rpx;
    font-weight: 800;
  }

  &__hint {
    margin-top: 6rpx;
    font-size: 22rpx;
  }

  &__saving {
    padding: 8rpx 14rpx;
    border-radius: 999rpx;
    background: var(--app-bg);
    font-size: 20rpx;
    flex-shrink: 0;
  }

  &__value-row {
    margin-top: 30rpx;
    gap: 18rpx;
  }

  &__unit-row {
    margin-top: 24rpx;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16rpx;
  }

  &__theme-row {
    margin-top: 24rpx;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12rpx;
  }

  &__theme-option {
    min-width: 0;
    min-height: 112rpx;
    padding: 18rpx 12rpx;
    border: 1rpx solid var(--app-border);
    border-radius: 22rpx;
    background: var(--app-bg);
    text-align: center;

    &--active {
      border-color: rgba(255, 80, 30, 0.58);
      background: rgba(255, 80, 30, 0.14);
    }
  }

  &__theme-label {
    color: var(--app-text);
    font-size: 23rpx;
    font-weight: 900;
  }

  &__theme-desc {
    margin-top: 8rpx;
    color: var(--app-text-muted);
    font-size: 18rpx;
    line-height: 1.35;
  }

  &__unit-option {
    min-height: 78rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-text-secondary);
    background: var(--app-bg);
    border: 1rpx solid var(--app-border);
    font-size: 28rpx;
    font-weight: 900;

    &--active {
      color: var(--app-accent);
      background: var(--app-accent-soft);
      border-color: rgba(255, 80, 30, 0.58);
    }
  }

  &__step-btn {
    width: 132rpx;
    height: 84rpx;
    border-radius: 26rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 80, 30, 0.12);
    border: 1px solid rgba(255, 80, 30, 0.28);
    color: var(--app-accent);
    font-size: 24rpx;
    font-weight: 900;
    flex-shrink: 0;
  }

  &__value-box {
    flex: 1;
    min-width: 0;
    height: 96rpx;
    border-radius: 28rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8rpx;
    background: var(--app-bg);
    border: 1px solid var(--app-border);
  }

  &__value {
    width: 112rpx;
    text-align: center;
    color: var(--app-text);
    font-size: 48rpx;
    line-height: 1;
    font-weight: 900;
  }

  &__unit {
    color: var(--app-text-muted);
    font-size: 24rpx;
    font-weight: 700;
  }

  &__preset-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12rpx;
    margin-top: 26rpx;
  }

  &__preset {
    min-height: 66rpx;
    border-radius: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--app-bg);
    color: var(--app-text-muted);
    font-size: 23rpx;
    font-weight: 800;

    &--active {
      color: #fff;
      background: linear-gradient(135deg, #ff501e, #ffa03c);
      box-shadow: 0 10rpx 24rpx rgba(255, 80, 30, 0.22);
    }
  }

  &__range {
    gap: 16rpx;
    margin-top: 26rpx;
  }

  &__range-end {
    min-width: 50rpx;
    font-size: 20rpx;
  }

  &__range-bar {
    flex: 1;
    height: 10rpx;
    border-radius: 999rpx;
    overflow: hidden;
    background: var(--app-border);
  }

  &__range-fill {
    height: 100%;
    border-radius: 999rpx;
    background: linear-gradient(90deg, #ff501e, #ffa03c);
    box-shadow: 0 0 16rpx rgba(255, 80, 30, 0.36);
    transition: width 0.25s ease;
  }

  &__privacy {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
  }

  &__privacy-arrow {
    color: var(--app-accent);
    font-size: 34rpx;
    font-weight: 900;
  }

  &__preference-list {
    margin-top: 24rpx;
    display: flex;
    flex-direction: column;
    gap: 14rpx;
  }

  &__preference-row {
    min-height: 88rpx;
    padding: 18rpx 20rpx;
    border-radius: 24rpx;
    background: var(--app-bg);
    border: 1px solid var(--app-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18rpx;
  }

  &__preference-title {
    color: var(--app-text);
    font-size: 26rpx;
    font-weight: 900;
  }

  &__mini-steps {
    display: flex;
    gap: 10rpx;
    flex-shrink: 0;
  }

  &__mini-step {
    width: 58rpx;
    height: 58rpx;
    border-radius: 18rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-accent);
    background: var(--app-accent-soft);
    font-size: 30rpx;
    font-weight: 900;
  }
}
</style>
