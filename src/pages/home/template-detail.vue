<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import AppActionSheet from '@/components/app-action-sheet/index.vue'
import AppHeader from '@/components/app-header/index.vue'
import ExerciseThumbnail from '@/components/exercise-thumbnail/index.vue'
import MembershipRequiredModal from '@/components/membership-required-modal/index.vue'
import PrimaryButton from '@/components/primary-button/index.vue'
import ShareCardSheet from '@/components/share-card-sheet/index.vue'
import WorkoutDraftFab from '@/components/workout-draft-fab/index.vue'
import WorkoutDraftPrompt from '@/components/workout-draft-prompt/index.vue'
import { fetchTemplateSharePreview, type SharePreviewResponse } from '@/api/share'
import type { TemplateDetailResponse } from '@/api/template'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { ensureMembershipFeature, handleMembershipRequiredError } from '@/utils/membership-guard'
import { routes } from '@/utils/navigation'
import { useTemplateStore } from '@/stores/template'
import { useWorkoutStore } from '@/stores/workout'
import { useWorkoutDraftPromptStore } from '@/stores/workout-draft-prompt'
import { useProfileStore } from '@/stores/profile'
import { useThemeStore } from '@/stores/theme'
import { formatWeight } from '@/utils/unit'

interface ActionSheetItem {
  key: string
  label: string
  description?: string
  danger?: boolean
  primary?: boolean
}

const templateStore = useTemplateStore()
const workoutStore = useWorkoutStore()
const draftPromptStore = useWorkoutDraftPromptStore()
const profileStore = useProfileStore()
const themeStore = useThemeStore()
const templateId = ref<number | null>(null)
const detail = ref<TemplateDetailResponse | null>(null)
const loading = ref(false)
const starting = ref(false)
const copying = ref(false)
const saving = ref(false)
const sheetVisible = ref(false)
const sheetItems = ref<ActionSheetItem[]>([])
const shareVisible = ref(false)
const shareLoading = ref(false)
const sharePreview = ref<SharePreviewResponse | null>(null)

const isSystemTemplate = computed(() => detail.value?.templateType === 'SYSTEM')
const totalSets = computed(
  () => detail.value?.items.reduce((total, item) => total + item.targetSets, 0) ?? 0
)
const estimatedDuration = computed(() => Math.max(25, (detail.value?.items.length ?? 0) * 10))

function formatTarget(item: TemplateDetailResponse['items'][number]) {
  if (item.recordType === 'DURATION') {
    return item.targetDurationSeconds
      ? `${item.targetSets} 组 · 每组 ${formatDuration(item.targetDurationSeconds)}`
      : `${item.targetSets} 组 · 使用默认时长`
  }
  if (item.recordType === 'BODYWEIGHT_REPS') {
    return item.targetReps
      ? `${item.targetSets} 组 · 每组 ${item.targetReps} 次`
      : `${item.targetSets} 组 · 使用默认次数`
  }
  if (item.targetWeightKg != null && item.targetReps) {
    return `${item.targetSets} 组 · ${formatWeight(item.targetWeightKg, profileStore.unit, 1)} ${profileStore.unit} × ${item.targetReps} 次`
  }
  return `${item.targetSets} 组 · 使用默认重量和次数`
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (!minutes) return `${remainingSeconds} 秒`
  if (!remainingSeconds) return `${minutes} 分钟`
  return `${minutes} 分 ${remainingSeconds} 秒`
}

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
  const canStart = await prepareNewWorkout(detail.value?.name)
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

async function editTemplate() {
  if (!templateId.value || isSystemTemplate.value) return
  if (!(await ensureMembershipFeature('自定义模板'))) return
  uni.navigateTo({ url: `${routes.templateEdit}?id=${templateId.value}` })
}

async function renameTemplate() {
  if (!templateId.value || !detail.value || isSystemTemplate.value || saving.value) return
  if (!(await ensureMembershipFeature('自定义模板'))) return
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
    if (handleMembershipRequiredError(err, '自定义模板', 'custom_template')) return
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

function openTemplateMoreSheet() {
  if (!detail.value) return
  sheetItems.value = isSystemTemplate.value
    ? [
        {
          key: 'copy',
          label: '复制到我的模板',
          description: '复制后可以自由编辑动作和组数。',
          primary: true
        }
      ]
    : [
        {
          key: 'edit',
          label: '编辑模板',
          description: '调整动作、顺序和目标组数。',
          primary: true
        },
        {
          key: 'rename',
          label: '改名',
          description: '修改模板名称。'
        },
        {
          key: 'copy',
          label: '复制副本',
          description: '复制一份新的自定义模板。'
        },
        {
          key: 'delete',
          label: '删除模板',
          description: '删除后不可恢复。',
          danger: true
        }
      ]
  sheetVisible.value = true
}

function closeTemplateMoreSheet() {
  sheetVisible.value = false
}

async function handleTemplateMoreAction(item: ActionSheetItem) {
  closeTemplateMoreSheet()
  if (item.key === 'copy') {
    await copyTemplate()
    return
  }
  if (item.key === 'edit') {
    await editTemplate()
    return
  }
  if (item.key === 'rename') {
    await renameTemplate()
    return
  }
  if (item.key === 'delete') {
    await removeTemplate()
  }
}

async function prepareNewWorkout(nextTitle?: string) {
  workoutStore.refreshDraftState()
  if (!workoutStore.hasRecoverableWorkout) return true

  const action = await draftPromptStore.open(
    nextTitle ? { title: nextTitle, subtitle: '模板训练 · 删除当前草稿后直接开始' } : undefined
  )
  if (action === 'continue') {
    if (workoutStore.restoreDraft()) {
      uni.navigateTo({ url: routes.workoutActive })
    }
    return false
  }
  if (action === 'discard') {
    workoutStore.discardWorkout()
    return true
  }
  return false
}

async function openDraftFab() {
  workoutStore.refreshDraftState()
  const action = await draftPromptStore.open()
  if (action === 'continue') {
    if (workoutStore.restoreDraft()) {
      uni.navigateTo({ url: routes.workoutActive })
    }
  }
  if (action === 'discard') {
    workoutStore.discardWorkout()
  }
}

async function copyTemplate() {
  if (!templateId.value || copying.value) return
  if (!(await ensureMembershipFeature('自定义模板'))) return
  copying.value = true
  try {
    await templateStore.duplicate(templateId.value)
    uni.showToast({ title: '已复制到我的模板', icon: 'none' })
  } catch (err) {
    if (handleMembershipRequiredError(err, '自定义模板', 'custom_template')) return
    uni.showToast({ title: '复制失败', icon: 'none' })
    console.error('[template] copy failed', err)
  } finally {
    copying.value = false
  }
}

async function openTemplateShareCard() {
  if (!templateId.value || !detail.value) return
  shareVisible.value = true
  shareLoading.value = true
  try {
    sharePreview.value = await fetchTemplateSharePreview(templateId.value)
  } catch (err) {
    shareVisible.value = false
    uni.showToast({ title: '分享预览生成失败', icon: 'none' })
    console.error('[share] template preview failed', err)
  } finally {
    shareLoading.value = false
  }
}

function closeShareCard() {
  shareVisible.value = false
}

function copyShareText() {
  const text = sharePreview.value?.copyText
  if (!text) return
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '已复制分享文案', icon: 'none' })
  })
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view
      class="page-shell template-detail operation-page safe-bottom"
      :class="themeStore.themeClass"
    >
      <AppHeader title="模板详情" subtitle="查看动作安排后开始训练" show-back @back="goBack" />

      <view v-if="detail" class="template-detail__content">
        <view class="glass-card template-detail__hero">
          <view class="template-detail__hero-more btn-press" @tap="openTemplateMoreSheet">...</view>
          <view class="template-detail__tag">
            {{ isSystemTemplate ? '系统模板' : '我的模板' }}
          </view>
          <view class="template-detail__title">{{ detail.name }}</view>
          <view class="template-detail__desc">
            {{ detail.description || '按模板动作顺序完成训练，可在训练中调整重量、次数和组数。' }}
          </view>
          <view class="template-detail__hero-actions">
            <view class="template-detail__share btn-press" @tap="openTemplateShareCard"
              >分享模板</view
            >
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

        <view class="template-detail__section-title">动作安排</view>
        <view class="template-detail__items">
          <view
            v-for="(item, index) in detail.items"
            :key="`${item.exerciseId}-${index}`"
            class="glass-card template-detail__item"
          >
            <view class="template-detail__index">{{ index + 1 }}</view>
            <ExerciseThumbnail
              :name="item.exerciseName"
              :record-type="item.recordType"
              :url="item.thumbnailUrl || item.thumbnailPath"
            />
            <view class="template-detail__item-body">
              <view class="template-detail__item-name">{{ item.exerciseName }}</view>
              <view class="template-detail__item-meta">{{ formatTarget(item) }}</view>
            </view>
          </view>
        </view>
      </view>

      <view v-else class="glass-card template-detail__empty">
        {{ loading ? '模板加载中...' : '没有找到模板' }}
      </view>

      <view class="template-detail__footer">
        <PrimaryButton :disabled="!detail || starting" :loading="starting" @tap="startWorkout">
          {{ starting ? '正在开始...' : '开始此模板训练' }}
        </PrimaryButton>
      </view>
    </view>
  </scroll-view>
  <WorkoutDraftFab
    :variant="themeStore.resolvedTheme === 'light' ? 'light' : 'default'"
    @open="openDraftFab"
  />
  <WorkoutDraftPrompt />
  <AppActionSheet
    :class="themeStore.themeClass"
    :visible="sheetVisible"
    title="更多模板操作"
    :subtitle="detail?.name || ''"
    :items="sheetItems"
    @close="closeTemplateMoreSheet"
    @select="handleTemplateMoreAction"
  />
  <ShareCardSheet
    :visible="shareVisible"
    :preview="sharePreview"
    :loading="shareLoading"
    @close="closeShareCard"
    @copy="copyShareText"
  />
  <MembershipRequiredModal />
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
    position: relative;
    padding: 32rpx;
  }

  &__hero-more {
    position: absolute;
    top: 24rpx;
    right: 24rpx;
    width: 64rpx;
    height: 64rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.07);
    color: #ff9b58;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28rpx;
    font-weight: 900;
    letter-spacing: 2rpx;
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
    padding-right: 76rpx;
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

  &__hero-actions {
    display: flex;
    gap: 14rpx;
    margin-top: 22rpx;
  }

  &__share {
    min-height: 62rpx;
    padding: 0 22rpx;
    border-radius: 999rpx;
    background: rgba(255, 80, 30, 0.14);
    color: #ff501e;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 23rpx;
    font-weight: 900;
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
    width: 64rpx;
    height: 64rpx;
    border-radius: 20rpx;
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
