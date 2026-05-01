<script setup lang="ts">
import { onMounted } from 'vue'
import AppHeader from '@/components/app-header/index.vue'
import PrimaryButton from '@/components/primary-button/index.vue'
import TemplateItem from '@/components/template-item/index.vue'
import { routes } from '@/utils/navigation'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { useTemplateStore } from '@/stores/template'
import { useWorkoutStore } from '@/stores/workout'

const templateStore = useTemplateStore()
const workoutStore = useWorkoutStore()

function goBack() {
  uni.navigateBack()
}

async function openManager() {
  const ok = await ensureFeatureAuth('模板管理')
  if (!ok) return
  uni.navigateTo({ url: routes.templateManager })
}

async function startWorkout(templateId: number | null) {
  const ok = await ensureFeatureAuth('开始训练')
  if (!ok) return
  await workoutStore.startWorkout(templateId)
  uni.navigateTo({ url: routes.workoutActive })
}

onMounted(() => {
  templateStore.loadTemplates()
})
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell safe-bottom">
      <AppHeader title="选择模板" subtitle="选择一个训练计划开始今天的训练" show-back @back="goBack">
        <template #right>
          <view class="glass-card select-template__manage btn-press" @tap="openManager">管理</view>
        </template>
      </AppHeader>

      <PrimaryButton @tap="startWorkout(null)">
        <view class="select-template__free">
          <view class="select-template__free-icon">+</view>
          <view class="select-template__free-copy">
            <view class="select-template__free-title">自由训练</view>
            <view class="select-template__free-sub">按你的节奏自由添加动作和组数</view>
          </view>
          <view class="select-template__free-arrow">›</view>
        </view>
      </PrimaryButton>

      <view class="select-template__section-label section-label">我的模板</view>
      <view class="select-template__list">
        <TemplateItem v-for="item in templateStore.userItems" :key="item.id" :template="item" @start="startWorkout" />
        <view v-if="!templateStore.userItems.length" class="glass-card select-template__empty">
          登录后可以保存和管理自己的训练模板
        </view>
      </view>

      <view class="select-template__section-label section-label">系统推荐</view>
      <view class="select-template__list">
        <TemplateItem v-for="item in templateStore.systemItems" :key="item.id" :template="item" @start="startWorkout" />
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.select-template {
  &__manage {
    padding: 18rpx 24rpx;
    font-size: 22rpx;
    color: #828296;
  }

  &__free {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 18rpx;
  }

  &__free-icon {
    width: 76rpx;
    height: 76rpx;
    border-radius: 24rpx;
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 34rpx;
  }

  &__free-copy {
    flex: 1;
  }

  &__free-title {
    font-size: 30rpx;
    font-weight: 700;
  }

  &__free-sub {
    margin-top: 8rpx;
    font-size: 22rpx;
    color: rgba(255, 255, 255, 0.78);
  }

  &__free-arrow {
    font-size: 36rpx;
    color: rgba(255, 255, 255, 0.78);
  }

  &__section-label {
    margin: 32rpx 0 20rpx;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }

  &__empty {
    padding: 24rpx;
    color: #828296;
    font-size: 24rpx;
  }
}
</style>
