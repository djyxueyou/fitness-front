<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import PrimaryButton from '@/components/primary-button/index.vue'
import TemplateItem from '@/components/template-item/index.vue'
import { useTemplateStore } from '@/stores/template'
import { useWorkoutStore } from '@/stores/workout'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'

const templateStore = useTemplateStore()
const workoutStore = useWorkoutStore()
const recentTemplates = computed(() => templateStore.recentItems.slice(0, 5))

onShow(async () => {
  const ok = await ensureFeatureAuth('训练模板')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  workoutStore.refreshDraftState()
  if (!templateStore.loadedFromServer) {
    templateStore.fetchTemplates({ includeDetails: false })
  }
})

function goBack() {
  uni.navigateBack()
}

async function openManager() {
  const ok = await ensureFeatureAuth('训练模板管理')
  if (!ok) return
  uni.navigateTo({ url: routes.templateManager })
}

async function continueWorkout() {
  const ok = await ensureFeatureAuth('训练功能')
  if (!ok) return
  if (!workoutStore.restoreDraft()) {
    uni.showToast({ title: '没有可恢复的训练', icon: 'none' })
    return
  }
  uni.navigateTo({ url: routes.workoutActive })
}

async function startWorkout(templateId: number | null) {
  const ok = await ensureFeatureAuth('训练功能')
  if (!ok) return
  const canStart = await prepareNewWorkout()
  if (!canStart) return
  if (templateId) {
    templateStore.markUsed(templateId)
  }
  workoutStore.queueStartWorkout(templateId)
  uni.navigateTo({ url: routes.workoutActive })
}

async function goTemplateDetail(templateId: number) {
  const ok = await ensureFeatureAuth('训练模板')
  if (!ok) return
  uni.navigateTo({ url: `${routes.templateDetail}?id=${templateId}` })
}

async function goTemplateEdit(templateId: number) {
  const ok = await ensureFeatureAuth('训练模板管理')
  if (!ok) return
  uni.navigateTo({ url: `${routes.templateEdit}?id=${templateId}` })
}

async function prepareNewWorkout() {
  workoutStore.refreshDraftState()
  if (!workoutStore.hasRecoverableWorkout) return true

  try {
    const result = await new Promise<UniApp.ShowActionSheetSuccess>((resolve, reject) => {
      uni.showActionSheet({
        itemList: ['继续当前训练', '放弃并重新开始'],
        success: resolve,
        fail: reject
      })
    })

    if (result.tapIndex === 0) {
      if (workoutStore.restoreDraft()) {
        uni.navigateTo({ url: routes.workoutActive })
      }
      return false
    }

    workoutStore.discardWorkout()
    return true
  } catch {
    return false
  }
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell safe-bottom">
      <AppHeader
        title="选择模板"
        subtitle="选择一个训练计划，开始今天的训练"
        show-back
        @back="goBack"
      >
        <template #right>
          <view class="glass-card select-template__manage btn-press" @tap="openManager">管理</view>
        </template>
      </AppHeader>

      <view
        v-if="workoutStore.hasRecoverableWorkout"
        class="glass-card select-template__resume btn-press"
        @tap="continueWorkout"
      >
        <view class="select-template__resume-icon">▶</view>
        <view class="select-template__resume-copy">
          <view class="select-template__resume-title">继续上次训练</view>
          <view class="select-template__resume-sub">
            {{ workoutStore.activeTemplateName || '自由训练' }} · {{ workoutStore.doneSets }}/{{
              workoutStore.totalSets
            }}
            组已完成
          </view>
        </view>
        <view class="select-template__free-arrow">›</view>
      </view>

      <view v-if="recentTemplates.length" class="select-template__section-label section-label">
        最近使用
      </view>
      <view v-if="recentTemplates.length" class="select-template__list">
        <TemplateItem
          v-for="item in recentTemplates"
          :key="`recent-${item.id}`"
          :template="item"
          :editable="item.templateType !== 'SYSTEM'"
          @start="startWorkout"
          @detail="goTemplateDetail"
          @edit="goTemplateEdit"
        />
      </view>

      <view class="select-template__section-label section-label">我的模板</view>
      <view class="select-template__list">
        <TemplateItem
          v-for="item in templateStore.userItems"
          :key="item.id"
          :template="item"
          editable
          @start="startWorkout"
          @detail="goTemplateDetail"
          @edit="goTemplateEdit"
        />
        <view v-if="!templateStore.userItems.length" class="glass-card select-template__empty">
          登录后可以保存和管理自己的训练模板。
        </view>
      </view>

      <view class="select-template__section-label section-label">系统推荐</view>
      <view class="select-template__list">
        <TemplateItem
          v-for="item in templateStore.systemItems"
          :key="item.id"
          :template="item"
          @start="startWorkout"
          @detail="goTemplateDetail"
        />
      </view>

      <view class="select-template__section-label section-label">自由训练</view>
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

  &__resume {
    display: flex;
    align-items: center;
    gap: 18rpx;
    padding: 24rpx;
  }

  &__resume-icon {
    width: 76rpx;
    height: 76rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    color: #fff;
    font-size: 26rpx;
  }

  &__resume-copy {
    flex: 1;
  }

  &__resume-title {
    color: #f5f5fa;
    font-size: 30rpx;
    font-weight: 800;
  }

  &__resume-sub {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
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
    font-size: 32rpx;
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
