<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import EmptyState from '@/components/empty-state/index.vue'
import TemplateItem from '@/components/template-item/index.vue'
import type { TemplateListItemResponse } from '@/api/template'
import { fetchTrainingHistory, type TrainingHistoryItemResponse } from '@/api/training'
import { useTemplateStore } from '@/stores/template'
import { useWorkoutStore } from '@/stores/workout'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'

const templateStore = useTemplateStore()
const workoutStore = useWorkoutStore()
const recentHistory = ref<TrainingHistoryItemResponse[]>([])
const recentTemplates = computed(() =>
  templateStore.getRecentItemsFromHistory(recentHistory.value, 5)
)
const searchText = ref('')
const activeTab = ref<'mine' | 'recent' | 'system'>('mine')
const tabs = [
  { key: 'mine', label: '我的模板' },
  { key: 'recent', label: '最近使用' },
  { key: 'system', label: '系统模板' }
] as const

const activeTemplates = computed(() => {
  const sourceMap = {
    mine: templateStore.userItems,
    recent: recentTemplates.value,
    system: templateStore.systemItems
  }
  return filterTemplates(sourceMap[activeTab.value])
})
const initialLoading = computed(() => templateStore.loading && !templateStore.items.length)
const emptyText = computed(() => {
  if (searchText.value.trim()) return '没有匹配的训练模板'
  if (activeTab.value === 'mine') return '还没有我的模板，可以新建模板或从系统模板复制。'
  if (activeTab.value === 'recent') return '开始一次模板训练后，会显示最近使用模板。'
  return '暂无系统模板'
})

function filterTemplates(items: TemplateListItemResponse[]) {
  const keyword = searchText.value.trim().toLowerCase()
  if (!keyword) return items
  return items.filter((item) => {
    const haystack = `${item.name} ${item.description || ''}`.toLowerCase()
    return haystack.includes(keyword)
  })
}

onShow(async () => {
  const ok = await ensureFeatureAuth('训练模板')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  workoutStore.refreshDraftState()
  await loadTemplates(false)
  fetchTrainingHistory({ pageNo: 1, pageSize: 20 })
    .then((page) => {
      recentHistory.value = page.list
    })
    .catch((err) => {
      recentHistory.value = []
      console.error('[template] recent history fetch failed', err)
    })
})

async function loadTemplates(force: boolean) {
  if (!force && templateStore.loadedFromServer) return
  await templateStore.fetchTemplates({ includeDetails: false, force })
}

function retryLoadTemplates() {
  loadTemplates(true)
}

function goBack() {
  uni.navigateBack()
}

async function createTemplate() {
  const ok = await ensureFeatureAuth('训练模板管理')
  if (!ok) return
  uni.navigateTo({ url: routes.templateEdit })
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

function goSystemTemplates() {
  searchText.value = ''
  activeTab.value = 'system'
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
          <view class="glass-card select-template__create btn-press" @tap="createTemplate">
            新建模板
          </view>
        </template>
      </AppHeader>

      <view class="glass-card select-template__search">
        <text class="select-template__search-icon">⌕</text>
        <input
          v-model="searchText"
          class="select-template__search-input"
          placeholder="搜索训练模板..."
          placeholder-class="select-template__placeholder"
        />
        <text v-if="searchText" class="select-template__search-clear" @tap="searchText = ''">
          ×
        </text>
      </view>

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

      <view class="select-template__tabs">
        <view
          v-for="tab in tabs"
          :key="tab.key"
          class="select-template__tab btn-press"
          :class="{ 'select-template__tab--active': activeTab === tab.key }"
          @tap="activeTab = tab.key"
        >
          {{ tab.label }}
        </view>
      </view>

      <view v-if="initialLoading" class="select-template__state muted">加载中...</view>

      <view v-else-if="templateStore.listError" class="select-template__state">
        <EmptyState
          icon="⚠"
          title="模板加载失败"
          description="网络或服务暂时异常，可以稍后重试。"
        />
        <view class="gradient-fire select-template__retry btn-press" @tap="retryLoadTemplates">
          重新加载
        </view>
      </view>

      <view v-else class="select-template__list">
        <TemplateItem
          v-for="item in activeTemplates"
          :key="`${activeTab}-${item.id}`"
          :template="item"
          :editable="item.templateType !== 'SYSTEM'"
          @start="startWorkout"
          @detail="goTemplateDetail"
          @edit="goTemplateEdit"
        />
        <view v-if="!activeTemplates.length" class="glass-card select-template__empty">
          <view class="select-template__empty-title">{{ emptyText }}</view>
          <view
            v-if="activeTab === 'mine' && !searchText.trim()"
            class="select-template__empty-actions"
          >
            <view class="select-template__empty-action btn-press" @tap="createTemplate">
              新建模板
            </view>
            <view class="select-template__empty-action btn-press" @tap="goSystemTemplates">
              查看系统模板
            </view>
          </view>
        </view>
      </view>

      <view class="gradient-fire select-template__free-fab btn-press" @tap="startWorkout(null)">
        <text class="select-template__free-fab-plus">+</text>
        <text>自由训练</text>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.select-template {
  &__create {
    padding: 18rpx 24rpx;
    font-size: 22rpx;
    color: #ff7a32;
    font-weight: 800;
  }

  &__search {
    margin-top: 24rpx;
    padding: 24rpx 28rpx;
    display: flex;
    align-items: center;
    gap: 16rpx;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 80, 30, 0.15);
    border-radius: 32rpx;
  }

  &__search-input {
    flex: 1;
    color: #f5f5fa;
    font-size: 26rpx;
  }

  &__placeholder,
  &__search-icon,
  &__search-clear {
    color: #828296;
  }

  &__search-icon,
  &__search-clear {
    font-size: 28rpx;
  }

  &__tabs {
    display: flex;
    gap: 12rpx;
    margin: 30rpx 0 20rpx;
    padding: 8rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  &__tab {
    flex: 1;
    min-height: 64rpx;
    border-radius: 999rpx;
    color: #828296;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    font-weight: 800;

    &--active {
      background: linear-gradient(135deg, #ff501e, #ffa03c);
      color: #fff;
      box-shadow: 0 0 24rpx rgba(255, 80, 30, 0.22);
    }
  }

  &__state {
    padding-top: 80rpx;
  }

  &__retry {
    width: 240rpx;
    min-height: 76rpx;
    margin: 0 auto;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 26rpx;
    font-weight: 800;
  }

  &__resume {
    display: flex;
    align-items: center;
    gap: 18rpx;
    margin-top: 24rpx;
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

  &__free-arrow {
    font-size: 32rpx;
    color: rgba(255, 255, 255, 0.78);
  }

  &__free-fab {
    position: fixed;
    right: 32rpx;
    bottom: calc(env(safe-area-inset-bottom) + 40rpx);
    z-index: 20;
    min-height: 88rpx;
    padding: 0 30rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    gap: 10rpx;
    color: #fff;
    font-size: 26rpx;
    font-weight: 900;
    box-shadow: 0 18rpx 44rpx rgba(255, 80, 30, 0.28);
  }

  &__free-fab-plus {
    font-size: 34rpx;
    line-height: 1;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
    padding-bottom: 128rpx;
  }

  &__empty {
    padding: 24rpx;
    color: #828296;
    font-size: 24rpx;
  }

  &__empty-title {
    line-height: 1.6;
  }

  &__empty-actions {
    display: flex;
    gap: 14rpx;
    margin-top: 20rpx;
  }

  &__empty-action {
    min-height: 64rpx;
    padding: 0 22rpx;
    border-radius: 999rpx;
    background: rgba(255, 80, 30, 0.14);
    color: #ff7a32;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22rpx;
    font-weight: 800;
  }
}
</style>
