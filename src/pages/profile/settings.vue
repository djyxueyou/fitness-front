<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import ToggleSwitch from '@/components/toggle-switch/index.vue'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { useProfileStore } from '@/stores/profile'

const profileStore = useProfileStore()
const saving = ref(false)

onShow(async () => {
  const ok = await ensureFeatureAuth('个人信息')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  await profileStore.refreshProfile()
})

function goBack() {
  uni.navigateBack()
}

async function changeUnit(unit: 'kg' | 'lb') {
  if (profileStore.unit === unit || saving.value) return
  saving.value = true
  try {
    await profileStore.saveSettings({
      weightUnit: unit,
      restSeconds: profileStore.restSeconds
    })
    uni.showToast({ title: '设置已保存', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '保存失败，请重试', icon: 'none' })
    console.error('[settings] update unit failed', err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell safe-bottom">
      <AppHeader title="设置" subtitle="通知、主题和单位偏好" show-back @back="goBack" />

      <view class="glass-card settings__item">
        <view class="settings__icon">🔂</view>
        <view class="settings__body">
          <view class="settings__title">训练提醒</view>
          <view class="settings__sub">定时提醒你保持训练节奏</view>
        </view>
        <ToggleSwitch v-model="profileStore.notifications" />
      </view>

      <view class="glass-card settings__item">
        <view class="settings__icon">🌘</view>
        <view class="settings__body">
          <view class="settings__title">深色模式</view>
          <view class="settings__sub">当前：{{ profileStore.darkMode ? '深色' : '浅色' }}</view>
        </view>
        <ToggleSwitch v-model="profileStore.darkMode" />
      </view>

      <view class="glass-card settings__item">
        <view class="settings__icon">⚖️</view>
        <view class="settings__body">
          <view class="settings__title">重量单位</view>
          <view class="settings__sub">当前：{{ profileStore.unit }}</view>
        </view>
        <view class="settings__segmented">
          <view
            class="settings__segment"
            :class="{ 'settings__segment--active': profileStore.unit === 'kg' }"
            @tap="changeUnit('kg')"
            >kg</view
          >
          <view
            class="settings__segment"
            :class="{ 'settings__segment--active': profileStore.unit === 'lb' }"
            @tap="changeUnit('lb')"
            >lb</view
          >
        </view>
      </view>

      <view class="glass-card settings__item btn-press">
        <view class="settings__icon">🗏</view>
        <view class="settings__body">
          <view class="settings__title settings__title--danger">清除所有数据</view>
          <view class="settings__sub">此操作不可恢复</view>
        </view>
        <view class="settings__arrow">›</view>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.settings {
  &__item {
    padding: 24rpx;
    display: flex;
    align-items: center;
    gap: 16rpx;
    margin-bottom: 16rpx;
  }

  &__icon {
    width: 68rpx;
    height: 68rpx;
    border-radius: 20rpx;
    background: rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__body {
    flex: 1;
  }

  &__title {
    font-size: 28rpx;
    font-weight: 700;

    &--danger {
      color: #ff501e;
    }
  }

  &__sub {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
  }

  &__segmented {
    display: flex;
    border-radius: 20rpx;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  &__segment {
    min-width: 72rpx;
    min-height: 52rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #828296;

    &--active {
      background: linear-gradient(135deg, #ff501e, #ffa03c);
      color: #fff;
    }
  }

  &__arrow {
    color: #828296;
    font-size: 28rpx;
  }
}
</style>
