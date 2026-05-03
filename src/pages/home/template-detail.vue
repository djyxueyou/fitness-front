<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import PrimaryButton from '@/components/primary-button/index.vue'
import type { TemplateDetailResponse } from '@/api/template'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { routes } from '@/utils/navigation'
import { useTemplateStore } from '@/stores/template'
import { useWorkoutStore } from '@/stores/workout'

const templateStore = useTemplateStore()
const workoutStore = useWorkoutStore()
const templateId = ref<number | null>(null)
const detail = ref<TemplateDetailResponse | null>(null)
const loading = ref(false)
const starting = ref(false)
const copying = ref(false)
const saving = ref(false)

const isSystemTemplate = computed(() => detail.value?.templateType === 'SYSTEM')
const totalSets = computed(
  () => detail.value?.items.reduce((total, item) => total + item.targetSets, 0) ?? 0
)
const estimatedDuration = computed(() => Math.max(25, (detail.value?.items.length ?? 0) * 10))

onLoad((options) => {
  const id = Number(options?.id)
  templateId.value = Number.isFinite(id) && id > 0 ? id : null
})

onShow(async () => {
  const ok = await ensureFeatureAuth('训练模板')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  await loadDetail()
})

function goBack() {
  uni.navigateBack()
}

async function loadDetail(force = false) {
  if (!templateId.value || loading.value) return
  loading.value = true
  try {
    if (force) {
      await templateStore.fetchTemplates({ includeDetails: false })
    }
    detail.value = await templateStore.getDetail(templateId.value)
  } catch (err) {
    uni.showToast({ title: '模板加载失败', icon: 'none' })
    console.error('[template] detail fetch failed', err)
  } finally {
    loading.value = false
  }
}

async function startWorkout() {
  if (!templateId.value || starting.value) return
  const ok = await ensureFeatureAuth('训练功能')
  if (!ok) return
  const canStart = await prepareNewWorkout()
  if (!canStart) return

  starting.value = true
  try {
    templateStore.markUsed(templateId.value)
    await workoutStore.startWorkout(templateId.value)
    uni.navigateTo({ url: routes.workoutActive })
  } catch (err) {
    uni.showToast({ title: '开始训练失败', icon: 'none' })
    console.error('[workout] start from template detail failed', err)
  } finally {
    starting.value = false
  }
}

function editTemplate() {
  if (!templateId.value || isSystemTemplate.value) return
  uni.navigateTo({ url: `${routes.templateEdit}?id=${templateId.value}` })
}

async function renameTemplate() {
  if (!templateId.value || !detail.value || isSystemTemplate.value || saving.value) return
  const nextName = await new Promise<string | null>((resolve) => {
    uni.showModal({
      title: '重命名模板',
      editable: true,
      placeholderText: '请输入模板名称',
      content: detail.value?.name || '',
      success: (res) => resolve(res.confirm ? (res.content || '').trim() : null),
      fail: () => resolve(null)
    } as UniApp.ShowModalOptions & { editable: boolean; placeholderText: string })
  })
  if (!nextName) return

  saving.value = true
  try {
    await templateStore.rename(templateId.value, nextName)
    await loadDetail(true)
    uni.showToast({ title: '已重命名', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '重命名失败', icon: 'none' })
    console.error('[template] rename failed', err)
  } finally {
    saving.value = false
  }
}

async function removeTemplate() {
  if (!templateId.value || isSystemTemplate.value || saving.value) return
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '删除模板',
      content: '删除后不可恢复，确认删除这个自定义模板吗？',
      confirmText: '删除',
      confirmColor: '#ff501e',
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false)
    })
  })
  if (!confirmed) return

  saving.value = true
  try {
    await templateStore.remove(templateId.value)
    uni.showToast({ title: '已删除', icon: 'none' })
    uni.navigateBack()
  } catch (err) {
    uni.showToast({ title: '删除失败', icon: 'none' })
    console.error('[template] remove failed', err)
  } finally {
    saving.value = false
  }
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

async function copyTemplate() {
  if (!templateId.value || copying.value) return
  copying.value = true
  try {
    await templateStore.duplicate(templateId.value)
    uni.showToast({ title: '已复制到我的模板', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '复制失败', icon: 'none' })
    console.error('[template] copy failed', err)
  } finally {
    copying.value = false
  }
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll">
    <view class="page-shell template-detail safe-bottom">
      <AppHeader title="模板详情" subtitle="查看动作安排后开始训练" show-back @back="goBack" />

      <view v-if="detail" class="template-detail__content">
        <view class="glass-card template-detail__hero">
          <view class="template-detail__tag">
            {{ isSystemTemplate ? '系统模板' : '我的模板' }}
          </view>
          <view class="template-detail__title">{{ detail.name }}</view>
          <view class="template-detail__desc">
            {{ detail.description || '按模板动作顺序完成训练，可在训练中调整重量、次数和组数。' }}
          </view>
          <view class="template-detail__stats">
            <view class="template-detail__stat">
              <view class="template-detail__stat-value">{{ detail.items.length }}</view>
              <view class="template-detail__stat-label">动作</view>
            </view>
            <view class="template-detail__stat">
              <view class="template-detail__stat-value">{{ totalSets }}</view>
              <view class="template-detail__stat-label">目标组</view>
            </view>
            <view class="template-detail__stat">
              <view class="template-detail__stat-value">{{ estimatedDuration }}</view>
              <view class="template-detail__stat-label">分钟</view>
            </view>
          </view>
        </view>

        <view class="template-detail__actions">
          <view class="glass-card template-detail__action btn-press" @tap="copyTemplate">
            {{ copying ? '复制中...' : '复制到我的模板' }}
          </view>
          <view
            v-if="!isSystemTemplate"
            class="glass-card template-detail__action btn-press"
            @tap="editTemplate"
          >
            编辑模板
          </view>
          <view
            v-if="!isSystemTemplate"
            class="glass-card template-detail__action btn-press"
            @tap="renameTemplate"
          >
            改名
          </view>
          <view
            v-if="!isSystemTemplate"
            class="template-detail__action template-detail__action--danger btn-press"
            @tap="removeTemplate"
          >
            删除
          </view>
        </view>

        <view class="template-detail__section-title">动作安排</view>
        <view class="template-detail__items">
          <view
            v-for="(item, index) in detail.items"
            :key="`${item.exerciseId}-${index}`"
            class="glass-card template-detail__item"
          >
            <view class="template-detail__index">{{ index + 1 }}</view>
            <view class="template-detail__item-body">
              <view class="template-detail__item-name">{{ item.exerciseName }}</view>
              <view class="template-detail__item-meta">目标 {{ item.targetSets }} 组</view>
            </view>
          </view>
        </view>
      </view>

      <view v-else class="glass-card template-detail__empty">
        {{ loading ? '模板加载中...' : '没有找到模板' }}
      </view>

      <view class="template-detail__footer">
        <PrimaryButton :disabled="!detail || starting" @tap="startWorkout">
          {{ starting ? '正在开始...' : '开始此模板训练' }}
        </PrimaryButton>
      </view>
    </view>
  </scroll-view>
</template>

<style lang="scss" scoped>
.template-detail {
  padding-bottom: 160rpx;

  &__content {
    display: flex;
    flex-direction: column;
    gap: 24rpx;
  }

  &__hero {
    padding: 32rpx;
  }

  &__tag {
    display: inline-flex;
    padding: 8rpx 18rpx;
    border-radius: 999rpx;
    background: rgba(255, 80, 30, 0.14);
    color: #ff501e;
    font-size: 22rpx;
    font-weight: 700;
  }

  &__title {
    margin-top: 22rpx;
    font-size: 42rpx;
    font-weight: 800;
    color: #f5f5fa;
  }

  &__desc {
    margin-top: 14rpx;
    color: #a6a6b8;
    font-size: 24rpx;
    line-height: 1.7;
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14rpx;
    margin-top: 28rpx;
  }

  &__stat {
    padding: 20rpx;
    border-radius: 24rpx;
    background: rgba(255, 255, 255, 0.05);
  }

  &__stat-value {
    font-size: 34rpx;
    font-weight: 800;
  }

  &__stat-label {
    margin-top: 6rpx;
    color: #828296;
    font-size: 22rpx;
  }

  &__actions {
    display: flex;
    gap: 16rpx;
  }

  &__action {
    flex: 1;
    padding: 22rpx;
    text-align: center;
    color: #f5f5fa;
    font-size: 24rpx;
    font-weight: 700;

    &--danger {
      border-radius: 26rpx;
      color: #ff6b4a;
      background: rgba(255, 107, 74, 0.12);
      border: 1px solid rgba(255, 107, 74, 0.18);
    }
  }

  &__section-title {
    margin-top: 8rpx;
    color: #f5f5fa;
    font-size: 30rpx;
    font-weight: 800;
  }

  &__items {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 20rpx;
    padding: 24rpx;
  }

  &__index {
    width: 72rpx;
    height: 72rpx;
    border-radius: 22rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 80, 30, 0.16);
    color: #ff501e;
    font-size: 26rpx;
    font-weight: 800;
  }

  &__item-body {
    flex: 1;
  }

  &__item-name {
    color: #f5f5fa;
    font-size: 28rpx;
    font-weight: 700;
  }

  &__item-meta {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
  }

  &__empty {
    padding: 32rpx;
    color: #828296;
    font-size: 24rpx;
  }

  &__footer {
    position: fixed;
    left: 24rpx;
    right: 24rpx;
    bottom: calc(24rpx + env(safe-area-inset-bottom));
    z-index: 10;
  }
}
</style>
