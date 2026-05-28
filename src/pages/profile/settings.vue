<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { useProfileStore } from '@/stores/profile'

const profileStore = useProfileStore()
const saving = ref(false)
const restInput = ref(String(profileStore.restSeconds))
const restPresets = [60, 90, 120, 180]

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

function stepRest(seconds: number) {
  const next = profileStore.restSeconds + seconds
  if (next < 30 || next > 300 || saving.value) return
  changeRest(next)
}

function setRest(seconds: number) {
  if (saving.value || seconds === profileStore.restSeconds) return
  changeRest(seconds)
}

function onRestInputBlur() {
  const value = Number(restInput.value)
  if (!Number.isFinite(value)) {
    restInput.value = String(profileStore.restSeconds)
    return
  }
  const clamped = Math.max(30, Math.min(300, Math.round(value)))
  restInput.value = String(clamped)
  if (clamped === profileStore.restSeconds) return
  changeRest(clamped)
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
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell settings safe-bottom">
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
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.settings {
  &__hero,
  &__control {
    border-color: rgba(255, 80, 30, 0.14);
  }

  &__hero {
    padding: 28rpx;
    display: flex;
    gap: 22rpx;
    background:
      radial-gradient(circle at 12% 0%, rgba(255, 80, 30, 0.18), transparent 44%),
      rgba(255, 255, 255, 0.04);
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
    color: #828296;
  }

  &__eyebrow {
    font-size: 20rpx;
    letter-spacing: 4rpx;
    text-transform: uppercase;
    color: #ff8a3d;
    font-weight: 900;
  }

  &__title {
    margin-top: 8rpx;
    color: #f5f5fa;
    font-size: 34rpx;
    font-weight: 900;
  }

  &__desc {
    margin-top: 10rpx;
    color: #a2a2b6;
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
    color: #f5f5fa;
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
    background: rgba(255, 255, 255, 0.05);
    font-size: 20rpx;
    flex-shrink: 0;
  }

  &__value-row {
    margin-top: 30rpx;
    gap: 18rpx;
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
    color: #ff8a3d;
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
    background: rgba(255, 255, 255, 0.055);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  &__value {
    width: 112rpx;
    text-align: center;
    color: #f5f5fa;
    font-size: 48rpx;
    line-height: 1;
    font-weight: 900;
  }

  &__unit {
    color: #a2a2b6;
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
    background: rgba(255, 255, 255, 0.05);
    color: #a2a2b6;
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
    background: rgba(255, 255, 255, 0.07);
  }

  &__range-fill {
    height: 100%;
    border-radius: 999rpx;
    background: linear-gradient(90deg, #ff501e, #ffa03c);
    box-shadow: 0 0 16rpx rgba(255, 80, 30, 0.36);
    transition: width 0.25s ease;
  }
}
</style>
