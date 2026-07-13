<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import ExerciseThumbnail from '@/components/exercise-thumbnail/index.vue'
import ExercisePicker from '@/components/exercise-picker/index.vue'
import PrimaryButton from '@/components/primary-button/index.vue'
import RestSecondsSheet from '@/components/rest-seconds-sheet/index.vue'
import {
  createTemplate,
  updateTemplate,
  type TemplateDetailResponse,
  type UpsertTemplateItemRequest
} from '@/api/template'
import type { ExerciseSummary } from '@/api/exercise'
import { fetchExerciseLastPerformance } from '@/api/training'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { ensureMembershipFeature } from '@/utils/membership-guard'
import { routes } from '@/utils/navigation'
import { useTemplateStore } from '@/stores/template'
import { useProfileStore } from '@/stores/profile'
import { useThemeStore } from '@/stores/theme'
import { convertUnitToKg, formatWeight } from '@/utils/unit'

interface EditableTemplateItem {
  exerciseId: number
  exerciseName: string
  targetSets: number
  recordType: string
  targetWeightKg?: number
  targetReps?: number
  targetDurationSeconds?: number
  restSeconds?: number | null
  thumbnailUrl?: string
}

const templateStore = useTemplateStore()
const profileStore = useProfileStore()
const themeStore = useThemeStore()
const templateId = ref<number | null>(null)
const templateName = ref('')
const items = ref<EditableTemplateItem[]>([])
const saving = ref(false)
const loading = ref(false)
const durationEditorVisible = ref(false)
const durationEditorIndex = ref<number | null>(null)
const durationMinutes = ref(1)
const durationSeconds = ref(0)

const pickerVisible = ref(false)
const restEditorIndex = ref<number | null>(null)

const isEditMode = computed(() => !!templateId.value)
const hasValidContent = computed(() => Boolean(templateName.value.trim()) && items.value.length > 0)
const canSave = computed(() => hasValidContent.value && !saving.value)
const totalSets = computed(() => items.value.reduce((total, item) => total + item.targetSets, 0))
const weightUnit = computed(() => profileStore.unit)

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
  await loadTemplate()
})

function goBack() {
  uni.navigateBack()
}

function chooseRestSeconds(index: number) {
  restEditorIndex.value = index
}

function confirmRestSeconds(payload: { restSeconds: number }) {
  const item = items.value[restEditorIndex.value ?? -1]
  if (item) item.restSeconds = payload.restSeconds
  restEditorIndex.value = null
}

async function loadTemplate() {
  if (!templateId.value || loading.value) {
    if (!templateId.value && !templateName.value) {
      templateName.value = '新模板'
    }
    return
  }

  loading.value = true
  try {
    const detail: TemplateDetailResponse = await templateStore.getDetail(templateId.value)
    if (detail.templateType === 'SYSTEM') {
      uni.showToast({ title: '系统模板不能编辑，请先复制', icon: 'none' })
      uni.navigateBack()
      return
    }
    templateName.value = detail.name
    items.value = detail.items.map((item) => ({
      exerciseId: item.exerciseId,
      exerciseName: item.exerciseName,
      targetSets: item.targetSets,
      recordType: item.recordType || 'WEIGHT_REPS',
      targetWeightKg: item.targetWeightKg,
      targetReps: item.targetReps,
      targetDurationSeconds: item.targetDurationSeconds,
      restSeconds: item.restSeconds,
      thumbnailUrl: item.thumbnailUrl || item.thumbnailPath
    }))
  } catch (err) {
    uni.showToast({ title: '模板加载失败', icon: 'none' })
    console.error('[template-edit] load failed', err)
  } finally {
    loading.value = false
  }
}

async function saveTemplate() {
  if (saving.value) return
  if (!templateName.value.trim()) {
    uni.showToast({ title: '请输入模板名称', icon: 'none' })
    return
  }
  if (!items.value.length) {
    uni.showToast({ title: '请至少添加一个动作', icon: 'none' })
    return
  }

  saving.value = true
  const payload = {
    name: templateName.value.trim(),
    items: items.value.map<UpsertTemplateItemRequest>((item) => ({
      exerciseId: item.exerciseId,
      targetSets: item.targetSets,
      targetWeightKg: item.recordType === 'WEIGHT_REPS' ? (item.targetWeightKg ?? 20) : undefined,
      targetReps: item.recordType !== 'DURATION' ? (item.targetReps ?? 10) : undefined,
      targetDurationSeconds:
        item.recordType === 'DURATION' ? (item.targetDurationSeconds ?? 60) : undefined,
      restSeconds: item.restSeconds
    }))
  }

  try {
    if (!(await ensureMembershipFeature('自定义模板'))) return
    if (templateId.value) {
      await updateTemplate(templateId.value, payload)
    } else {
      await createTemplate(payload)
    }
    await templateStore.fetchTemplates()
    uni.showToast({ title: '模板已保存', icon: 'none' })
    uni.navigateBack()
  } catch (err) {
    uni.showToast({ title: '保存失败', icon: 'none' })
    console.error('[template-edit] save failed', err)
  } finally {
    saving.value = false
  }
}

function openExercisePicker() {
  pickerVisible.value = true
}

function closeExercisePicker() {
  pickerVisible.value = false
}

async function addExercise(exercise: ExerciseSummary) {
  if (items.value.some((item) => item.exerciseId === exercise.id)) {
    uni.showToast({ title: '该动作已在模板中', icon: 'none' })
    return
  }
  const recordType = exercise.recordType || 'WEIGHT_REPS'
  let targetWeightKg = recordType === 'WEIGHT_REPS' ? 20 : undefined
  let targetReps = recordType === 'DURATION' ? undefined : 10
  let targetDurationSeconds = recordType === 'DURATION' ? 60 : undefined
  let usedPrevious = false
  try {
    const performance = await fetchExerciseLastPerformance(exercise.id)
    const previousSet = performance.sets[0]
    if (previousSet) {
      usedPrevious = true
      if (recordType === 'DURATION') {
        targetDurationSeconds = previousSet.durationSeconds || 60
      } else {
        targetReps = previousSet.reps || 10
        if (recordType === 'WEIGHT_REPS') {
          targetWeightKg = previousSet.weightKg ?? 20
        }
      }
    }
  } catch {
    // No previous performance is a normal first-use state.
  }
  items.value.push({
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    targetSets: 3,
    recordType,
    targetWeightKg,
    targetReps,
    targetDurationSeconds,
    thumbnailUrl: exercise.thumbnailUrl || exercise.thumbnailPath
  })
  uni.showToast({ title: usedPrevious ? '已参考上次表现' : '已按默认目标添加', icon: 'none' })
}

async function addExercises(exercises: ExerciseSummary[]) {
  try {
    for (const exercise of exercises) await addExercise(exercise)
    closeExercisePicker()
    uni.showToast({ title: `已添加 ${exercises.length} 个动作`, icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '添加动作失败，请重试', icon: 'none' })
    console.error('[template-edit] batch add failed', err)
  }
}

function removeItem(index: number) {
  items.value = items.value.filter((_, itemIndex) => itemIndex !== index)
}

function moveItem(index: number, delta: -1 | 1) {
  const targetIndex = index + delta
  if (targetIndex < 0 || targetIndex >= items.value.length) return
  const next = [...items.value]
  const [item] = next.splice(index, 1)
  next.splice(targetIndex, 0, item)
  items.value = next
}

function adjustSets(index: number, delta: -1 | 1) {
  items.value = items.value.map((item, itemIndex) =>
    itemIndex === index
      ? {
          ...item,
          targetSets: Math.min(20, Math.max(1, item.targetSets + delta))
        }
      : item
  )
}

function adjustTarget(
  index: number,
  field: 'targetWeightKg' | 'targetReps' | 'targetDurationSeconds',
  delta: number
) {
  items.value = items.value.map((item, itemIndex) => {
    if (itemIndex !== index) return item
    const minimum = field === 'targetWeightKg' ? 0 : 1
    const current =
      item[field] ?? (field === 'targetDurationSeconds' ? 60 : field === 'targetReps' ? 10 : 20)
    const normalizedDelta =
      field === 'targetWeightKg' ? convertUnitToKg(delta, weightUnit.value) : delta
    return {
      ...item,
      [field]: Math.max(minimum, Number((current + normalizedDelta).toFixed(2)))
    }
  })
}

function formatDuration(seconds = 60) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (!minutes) return `${remainingSeconds} 秒`
  if (!remainingSeconds) return `${minutes} 分钟`
  return `${minutes} 分 ${remainingSeconds} 秒`
}

function openDurationEditor(index: number) {
  const totalSeconds = Math.max(5, items.value[index]?.targetDurationSeconds ?? 60)
  durationEditorIndex.value = index
  durationMinutes.value = Math.floor(totalSeconds / 60)
  durationSeconds.value = totalSeconds % 60
  durationEditorVisible.value = true
}

function closeDurationEditor() {
  durationEditorVisible.value = false
  durationEditorIndex.value = null
}

function setQuickDuration(totalSeconds: number) {
  durationMinutes.value = Math.floor(totalSeconds / 60)
  durationSeconds.value = totalSeconds % 60
}

function confirmDuration() {
  const index = durationEditorIndex.value
  if (index == null) return
  const minutes = Math.max(0, Math.min(60, Number(durationMinutes.value) || 0))
  const seconds = Math.max(0, Math.min(59, Number(durationSeconds.value) || 0))
  const totalSeconds = Math.max(5, Math.min(3600, minutes * 60 + seconds))
  items.value = items.value.map((item, itemIndex) =>
    itemIndex === index ? { ...item, targetDurationSeconds: totalSeconds } : item
  )
  closeDurationEditor()
}
</script>

<template>
  <view class="template-edit operation-page" :class="themeStore.themeClass">
    <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
      <view class="page-shell template-edit__shell safe-bottom" :class="themeStore.themeClass">
        <AppHeader
          :title="isEditMode ? '编辑模板' : '新建模板'"
          subtitle="选择动作并设置目标组数"
          show-back
          @back="goBack"
        />

        <view class="template-edit__form">
          <view class="template-edit__form-head">
            <view class="template-edit__label">模板名称</view>
            <view class="template-edit__name-count">{{ templateName.trim().length }}/30</view>
          </view>
          <input
            v-model="templateName"
            class="template-edit__input"
            placeholder="请输入模板名称"
            placeholder-class="template-edit__placeholder"
            maxlength="30"
          />
        </view>

        <view class="template-edit__toolbar">
          <view>
            <view class="template-edit__section-title">动作安排</view>
            <view class="template-edit__section-sub">
              {{
                items.length
                  ? `${items.length} 个动作 · ${totalSets} 个目标组`
                  : '按训练顺序添加动作'
              }}
            </view>
          </view>
          <view class="template-edit__add btn-press" @tap="openExercisePicker">
            <view class="template-edit__add-icon">+</view>
            <text>添加动作</text>
          </view>
        </view>

        <view v-if="items.length" class="template-edit__items">
          <view
            v-for="(item, index) in items"
            :key="`${item.exerciseId}-${index}`"
            class="template-edit__item"
          >
            <view class="template-edit__item-main">
              <view class="template-edit__order">{{ index + 1 }}</view>
              <ExerciseThumbnail
                :name="item.exerciseName"
                :record-type="item.recordType"
                :url="item.thumbnailUrl"
              />
              <view class="template-edit__body">
                <view class="template-edit__name">{{ item.exerciseName }}</view>
                <view class="template-edit__meta">目标组数</view>
                <view
                  class="template-edit__rest-pill btn-press"
                  :class="{ 'template-edit__rest-pill--custom': item.restSeconds != null }"
                  @tap="chooseRestSeconds(index)"
                >
                  {{
                    item.restSeconds == null
                      ? `休息 默认 ${profileStore.restSeconds} 秒`
                      : `休息 ${item.restSeconds} 秒`
                  }}
                  ›
                </view>
              </view>
              <view class="template-edit__sets">
                <view class="template-edit__step btn-press" @tap="adjustSets(index, -1)">−</view>
                <view class="template-edit__sets-value">
                  <text>{{ item.targetSets }}</text>
                  <view>组</view>
                </view>
                <view class="template-edit__step btn-press" @tap="adjustSets(index, 1)">+</view>
              </view>
            </view>
            <view
              class="template-edit__targets"
              :class="{ 'template-edit__targets--single': item.recordType !== 'WEIGHT_REPS' }"
            >
              <view v-if="item.recordType === 'WEIGHT_REPS'" class="template-edit__target">
                <view class="template-edit__target-label">目标重量</view>
                <view class="template-edit__target-control">
                  <view
                    class="template-edit__target-step btn-press"
                    @tap="adjustTarget(index, 'targetWeightKg', -2.5)"
                    >−</view
                  >
                  <view class="template-edit__target-value">
                    {{ formatWeight(item.targetWeightKg ?? 20, weightUnit, 1) }} {{ weightUnit }}
                  </view>
                  <view
                    class="template-edit__target-step btn-press"
                    @tap="adjustTarget(index, 'targetWeightKg', 2.5)"
                    >+</view
                  >
                </view>
              </view>
              <view v-if="item.recordType !== 'DURATION'" class="template-edit__target">
                <view class="template-edit__target-label">目标次数</view>
                <view class="template-edit__target-control">
                  <view
                    class="template-edit__target-step btn-press"
                    @tap="adjustTarget(index, 'targetReps', -1)"
                    >−</view
                  >
                  <view class="template-edit__target-value">{{ item.targetReps ?? 10 }} 次</view>
                  <view
                    class="template-edit__target-step btn-press"
                    @tap="adjustTarget(index, 'targetReps', 1)"
                    >+</view
                  >
                </view>
              </view>
              <view v-else class="template-edit__target">
                <view class="template-edit__target-label">每组时长</view>
                <view class="template-edit__target-control">
                  <view
                    class="template-edit__target-step btn-press"
                    @tap="adjustTarget(index, 'targetDurationSeconds', -15)"
                    >−</view
                  >
                  <view
                    class="template-edit__target-value template-edit__target-value--editable btn-press"
                    @tap="openDurationEditor(index)"
                  >
                    {{ formatDuration(item.targetDurationSeconds ?? 60) }}
                  </view>
                  <view
                    class="template-edit__target-step btn-press"
                    @tap="adjustTarget(index, 'targetDurationSeconds', 15)"
                    >+</view
                  >
                </view>
              </view>
            </view>
            <view class="template-edit__actions">
              <view class="template-edit__sort-label">调整顺序</view>
              <view
                class="template-edit__mini btn-press"
                :class="{ 'template-edit__mini--disabled': index === 0 }"
                @tap="moveItem(index, -1)"
              >
                上移
              </view>
              <view
                class="template-edit__mini btn-press"
                :class="{ 'template-edit__mini--disabled': index === items.length - 1 }"
                @tap="moveItem(index, 1)"
              >
                下移
              </view>
              <view class="template-edit__danger btn-press" @tap="removeItem(index)">删除</view>
            </view>
          </view>
        </view>
        <view v-else class="template-edit__empty">
          <view class="template-edit__empty-icon">+</view>
          <view class="template-edit__empty-title">添加第一个动作</view>
          <view class="template-edit__empty-sub">选择动作并设置目标组数，之后仍可调整顺序。</view>
          <view class="template-edit__empty-action btn-press" @tap="openExercisePicker">
            添加动作
          </view>
        </view>

        <view class="template-edit__footer-spacer" />
      </view>
    </scroll-view>

    <view class="template-edit__footer">
      <view class="template-edit__footer-summary">
        <view>{{ items.length }} 个动作</view>
        <text>{{ totalSets }} 个目标组</text>
      </view>
      <PrimaryButton :disabled="!canSave" :loading="saving" @tap="saveTemplate">
        {{ saving ? '保存中...' : '保存到我的模板' }}
      </PrimaryButton>
    </view>

    <ExercisePicker
      :class="themeStore.themeClass"
      :visible="pickerVisible"
      title="添加动作"
      subtitle="搜索并添加到当前模板"
      :selected-ids="items.map((item) => item.exerciseId)"
      context="TEMPLATE"
      @close="closeExercisePicker"
      @select="addExercise"
      @confirm="addExercises"
    />
    <RestSecondsSheet
      :visible="restEditorIndex !== null"
      :exercise-name="items[restEditorIndex ?? -1]?.exerciseName || ''"
      :value="items[restEditorIndex ?? -1]?.restSeconds ?? profileStore.restSeconds"
      @close="restEditorIndex = null"
      @confirm="confirmRestSeconds"
    />

    <view v-if="durationEditorVisible" class="duration-editor__mask" @tap="closeDurationEditor">
      <view class="duration-editor" @tap.stop>
        <view class="duration-editor__handle" />
        <view class="duration-editor__head">
          <view>
            <view class="duration-editor__title">设置每组时长</view>
            <view class="duration-editor__sub">可精确设置，加减按钮仍按 15 秒调整</view>
          </view>
          <view class="duration-editor__close btn-press" @tap="closeDurationEditor">×</view>
        </view>
        <view class="duration-editor__fields">
          <view class="duration-editor__field">
            <input v-model.number="durationMinutes" type="number" class="duration-editor__input" />
            <view class="duration-editor__unit">分钟</view>
          </view>
          <view class="duration-editor__field">
            <input v-model.number="durationSeconds" type="number" class="duration-editor__input" />
            <view class="duration-editor__unit">秒钟</view>
          </view>
        </view>
        <view class="duration-editor__quick">
          <view
            v-for="seconds in [30, 45, 60, 90]"
            :key="seconds"
            class="duration-editor__quick-item btn-press"
            @tap="setQuickDuration(seconds)"
          >
            {{ formatDuration(seconds) }}
          </view>
        </view>
        <view class="duration-editor__actions">
          <view class="duration-editor__cancel btn-press" @tap="closeDurationEditor">取消</view>
          <view class="duration-editor__confirm btn-press" @tap="confirmDuration">确认时长</view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.template-edit {
  min-height: 100vh;

  &__shell {
    padding-bottom: 210rpx;
  }

  &__form {
    margin-top: 8rpx;
    padding: 22rpx 24rpx 20rpx;
    border-radius: 22rpx;
    background: var(--app-surface);
    border: 1rpx solid var(--app-border);
  }

  &__form-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__label,
  &__section-title {
    color: var(--app-text);
    font-size: 27rpx;
    font-weight: 900;
  }

  &__name-count,
  &__section-sub {
    color: var(--app-text-muted);
    font-size: 20rpx;
  }

  &__section-sub {
    margin-top: 6rpx;
  }

  &__input {
    margin-top: 12rpx;
    min-height: 72rpx;
    color: var(--app-text);
    font-size: 32rpx;
    font-weight: 800;
    border-bottom: 1rpx solid var(--app-border);
  }

  &__placeholder {
    color: var(--app-text-muted);
  }

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
    margin: 30rpx 0 18rpx;
  }

  &__add {
    min-width: 164rpx;
    height: 64rpx;
    padding: 0 20rpx;
    border-radius: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8rpx;
    background: linear-gradient(135deg, #ff501e, #ff9138);
    color: #fff;
    font-size: 22rpx;
    font-weight: 900;
    box-shadow: 0 10rpx 26rpx rgba(255, 80, 30, 0.18);
  }

  &__add-icon {
    font-size: 32rpx;
    font-weight: 500;
    line-height: 1;
  }

  &__items {
    display: flex;
    flex-direction: column;
    gap: 12rpx;
  }

  &__item {
    padding: 20rpx;
    border-radius: 22rpx;
    background: var(--app-surface);
    border: 1rpx solid var(--app-border);
  }

  &__item-main {
    display: flex;
    align-items: center;
    gap: 16rpx;
  }

  &__order {
    width: 58rpx;
    height: 58rpx;
    border-radius: 18rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 80, 30, 0.16);
    color: var(--app-accent);
    font-size: 24rpx;
    font-weight: 900;
    flex-shrink: 0;
  }

  &__body,
  &__exercise-body {
    flex: 1;
    min-width: 0;
  }

  &__name,
  &__exercise-name {
    color: var(--app-text);
    font-size: 26rpx;
    font-weight: 900;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    margin-top: 6rpx;
    color: var(--app-text-muted);
    font-size: 20rpx;
  }

  &__rest-pill {
    width: max-content;
    min-height: 52rpx;
    margin-top: 8rpx;
    padding: 0 16rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    color: var(--app-text-secondary);
    background: var(--app-bg);
    border: 1rpx solid var(--app-border);
    font-size: 20rpx;
    font-weight: 800;

    &--custom {
      color: var(--app-accent);
      background: var(--app-accent-soft);
      border-color: rgba(255, 91, 31, 0.25);
    }
  }

  &__sets {
    display: flex;
    align-items: center;
    gap: 8rpx;
    flex-shrink: 0;
  }

  &__step,
  &__mini,
  &__danger {
    min-width: 50rpx;
    height: 50rpx;
    border-radius: 15rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--app-bg);
    color: var(--app-text-secondary);
    font-size: 20rpx;
    font-weight: 800;
  }

  &__sets-value {
    min-width: 54rpx;
    text-align: center;
    color: var(--app-text-muted);
    font-size: 17rpx;

    text {
      display: block;
      color: var(--app-text);
      font-size: 27rpx;
      font-weight: 900;
      line-height: 1.1;
    }
  }

  &__targets {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10rpx;
    margin-top: 16rpx;

    &--single {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  &__target {
    min-width: 0;
    padding: 14rpx;
    border-radius: 16rpx;
    background: var(--app-bg);
    border: 1rpx solid var(--app-border);
  }

  &__target-label {
    color: var(--app-text-muted);
    font-size: 18rpx;
  }

  &__target-control {
    display: grid;
    grid-template-columns: 42rpx minmax(0, 1fr) 42rpx;
    align-items: center;
    gap: 6rpx;
    margin-top: 10rpx;
  }

  &__target-step {
    width: 42rpx;
    height: 42rpx;
    border-radius: 13rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--app-surface);
    color: var(--app-text-secondary);
    font-size: 22rpx;
  }

  &__target-value {
    min-width: 0;
    color: var(--app-text);
    font-size: 21rpx;
    font-weight: 900;
    text-align: center;
    white-space: nowrap;

    &--editable {
      color: #ff9b58;
      text-decoration: underline;
      text-decoration-color: rgba(255, 155, 88, 0.3);
      text-underline-offset: 6rpx;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8rpx;
    margin-top: 16rpx;
    padding-top: 14rpx;
    border-top: 1rpx solid var(--app-border);
  }

  &__sort-label {
    margin-right: auto;
    color: var(--app-text-muted);
    font-size: 19rpx;
  }

  &__mini {
    min-width: 68rpx;

    &--disabled {
      opacity: 0.32;
    }
  }

  &__danger {
    min-width: 68rpx;
    background: rgba(255, 80, 30, 0.14);
    color: #ff7440;
  }

  &__empty {
    min-height: 290rpx;
    padding: 42rpx 30rpx;
    border-radius: 22rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    background: var(--app-surface);
    border: 1rpx dashed var(--app-border-strong);
  }

  &__empty-icon {
    width: 74rpx;
    height: 74rpx;
    border-radius: 22rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-accent);
    background: var(--app-accent-soft);
    font-size: 44rpx;
    font-weight: 400;
  }

  &__empty-title {
    margin-top: 20rpx;
    color: var(--app-text);
    font-size: 27rpx;
    font-weight: 900;
  }

  &__empty-sub {
    max-width: 440rpx;
    margin-top: 10rpx;
    color: var(--app-text-muted);
    font-size: 21rpx;
    line-height: 1.55;
  }

  &__empty-action {
    min-width: 180rpx;
    height: 62rpx;
    margin-top: 24rpx;
    border-radius: 19rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-accent);
    background: var(--app-accent-soft);
    border: 1rpx solid rgba(255, 80, 30, 0.26);
    font-size: 22rpx;
    font-weight: 900;
  }

  &__footer,
  &__picker {
    position: fixed;
    left: 24rpx;
    right: 24rpx;
    z-index: 20;
  }

  &__footer {
    bottom: 0;
    left: 0;
    right: 0;
    padding: 16rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
    background: var(--app-surface-raised);
    border-top: 1rpx solid var(--app-border);
    backdrop-filter: blur(24rpx);
  }

  &__footer-summary {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12rpx;
    color: var(--app-text);
    font-size: 20rpx;
    font-weight: 800;

    text {
      color: var(--app-text-muted);
      font-weight: 500;
    }
  }

  &__picker-mask {
    position: fixed;
    inset: 0;
    z-index: 30;
    background: rgba(0, 0, 0, 0.62);
  }

  &__picker {
    top: 120rpx;
    bottom: 0;
    padding: 28rpx;
    border-radius: 36rpx 36rpx 0 0;
    background: var(--app-surface-raised);
    border: 1px solid var(--app-border);
    box-shadow: var(--app-shadow-focus);
  }

  &__picker-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__picker-title {
    color: var(--app-text);
    font-size: 34rpx;
    font-weight: 800;
  }

  &__picker-sub,
  &__exercise-meta,
  &__picker-footer {
    margin-top: 8rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
  }

  &__close {
    width: 68rpx;
    height: 68rpx;
    border-radius: 22rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--app-bg);
    color: var(--app-text);
    font-size: 36rpx;
  }

  &__search {
    margin-top: 24rpx;
    padding: 20rpx 24rpx;
  }

  &__search-input {
    color: var(--app-text);
    font-size: 26rpx;
  }

  &__categories {
    margin: 20rpx -28rpx;
    white-space: nowrap;
  }

  &__categories-inner {
    display: inline-flex;
    gap: 12rpx;
    padding: 0 28rpx;
  }

  &__category {
    padding: 14rpx 22rpx;
    border-radius: 999rpx;
    background: var(--app-bg);
    color: var(--app-text-secondary);
    font-size: 24rpx;

    &--active {
      background: linear-gradient(135deg, #ff501e, #ffa03c);
      color: #fff;
      font-weight: 700;
    }
  }

  &__exercise-list {
    height: calc(100vh - 430rpx);
  }

  &__exercise {
    display: flex;
    align-items: center;
    gap: 18rpx;
    padding: 18rpx;
    margin-bottom: 14rpx;
  }

  &__thumb,
  &__thumb-placeholder {
    width: 84rpx;
    height: 84rpx;
    border-radius: 22rpx;
    flex-shrink: 0;
  }

  &__thumb-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 80, 30, 0.14);
    color: var(--app-accent);
    font-size: 30rpx;
    font-weight: 800;
  }

  &__exercise-add {
    color: var(--app-accent);
    font-size: 24rpx;
    font-weight: 700;
  }

  &__picker-footer {
    padding: 20rpx 0;
    text-align: center;
  }
}

.duration-editor {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  z-index: 51;
  padding: 20rpx;
  border-radius: 34rpx;
  background: var(--app-surface-raised);
  border: 1rpx solid var(--app-border);
  box-shadow: var(--app-shadow-focus);
  backdrop-filter: blur(18rpx);

  &__mask {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(0, 0, 0, 0.64);
    backdrop-filter: blur(8rpx);
  }

  &__handle {
    width: 72rpx;
    height: 8rpx;
    margin: 0 auto 20rpx;
    border-radius: 999rpx;
    background: var(--app-border-strong);
  }

  &__head,
  &__actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16rpx;
  }

  &__title {
    color: var(--app-text);
    font-size: 32rpx;
    font-weight: 900;
  }

  &__sub {
    margin-top: 6rpx;
    color: var(--app-text-muted);
    font-size: 21rpx;
  }

  &__close {
    width: 58rpx;
    height: 58rpx;
    border-radius: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--app-text);
    background: var(--app-bg);
    font-size: 34rpx;
  }

  &__fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14rpx;
    margin-top: 24rpx;
  }

  &__field {
    padding: 18rpx 20rpx;
    border-radius: 22rpx;
    background: var(--app-bg);
    border: 1rpx solid var(--app-border);
  }

  &__input {
    height: 62rpx;
    color: var(--app-text);
    font-size: 36rpx;
    font-weight: 900;
    text-align: center;
  }

  &__unit {
    color: var(--app-text-muted);
    font-size: 20rpx;
    text-align: center;
  }

  &__quick {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10rpx;
    margin-top: 16rpx;
  }

  &__quick-item {
    min-height: 58rpx;
    border-radius: 18rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-accent);
    background: var(--app-accent-soft);
    border: 1rpx solid rgba(255, 80, 30, 0.2);
    font-size: 19rpx;
    font-weight: 800;
  }

  &__actions {
    margin-top: 22rpx;
  }

  &__cancel,
  &__confirm {
    min-height: 76rpx;
    border-radius: 22rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    font-size: 25rpx;
    font-weight: 900;
  }

  &__cancel {
    color: var(--app-text-secondary);
    background: var(--app-bg);
  }

  &__confirm {
    color: #fff;
    background: linear-gradient(135deg, #ff501e, #ff9138);
  }
}
</style>
