<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import ExercisePicker from '@/components/exercise-picker/index.vue'
import PrimaryButton from '@/components/primary-button/index.vue'
import {
  createTemplate,
  updateTemplate,
  type TemplateDetailResponse,
  type UpsertTemplateItemRequest
} from '@/api/template'
import type { ExerciseSummary } from '@/api/exercise'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { ensureMembershipFeature } from '@/utils/membership-guard'
import { routes } from '@/utils/navigation'
import { useTemplateStore } from '@/stores/template'

interface EditableTemplateItem {
  exerciseId: number
  exerciseName: string
  targetSets: number
}

const templateStore = useTemplateStore()
const templateId = ref<number | null>(null)
const templateName = ref('')
const items = ref<EditableTemplateItem[]>([])
const saving = ref(false)
const loading = ref(false)

const pickerVisible = ref(false)

const isEditMode = computed(() => !!templateId.value)
const canSave = computed(() => templateName.value.trim() && items.value.length > 0 && !saving.value)

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
      targetSets: item.targetSets
    }))
  } catch (err) {
    uni.showToast({ title: '模板加载失败', icon: 'none' })
    console.error('[template-edit] load failed', err)
  } finally {
    loading.value = false
  }
}

async function saveTemplate() {
  if (!(await ensureMembershipFeature('自定义模板'))) return
  if (!canSave.value) {
    uni.showToast({ title: '请填写名称并至少添加一个动作', icon: 'none' })
    return
  }

  const payload = {
    name: templateName.value.trim(),
    items: items.value.map<UpsertTemplateItemRequest>((item) => ({
      exerciseId: item.exerciseId,
      targetSets: item.targetSets
    }))
  }

  saving.value = true
  try {
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

function addExercise(exercise: ExerciseSummary) {
  if (items.value.some((item) => item.exerciseId === exercise.id)) {
    uni.showToast({ title: '该动作已在模板中', icon: 'none' })
    return
  }
  items.value.push({
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    targetSets: 3
  })
  uni.showToast({ title: '已添加', icon: 'none' })
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
</script>

<template>
  <view class="template-edit">
    <scroll-view scroll-y class="page-scroll">
      <view class="page-shell template-edit__shell safe-bottom">
        <AppHeader
          :title="isEditMode ? '编辑模板' : '新建模板'"
          subtitle="选择动作并设置目标组数"
          show-back
          @back="goBack"
        />

        <view class="glass-card template-edit__form">
          <view class="template-edit__label">模板名称</view>
          <input
            v-model="templateName"
            class="template-edit__input"
            placeholder="请输入模板名称"
            placeholder-class="template-edit__placeholder"
          />
        </view>

        <view class="template-edit__toolbar">
          <view class="template-edit__section-title">动作列表</view>
          <view class="gradient-fire template-edit__add btn-press" @tap="openExercisePicker">
            + 添加动作
          </view>
        </view>

        <view v-if="items.length" class="template-edit__items">
          <view
            v-for="(item, index) in items"
            :key="`${item.exerciseId}-${index}`"
            class="glass-card template-edit__item"
          >
            <view class="template-edit__order">{{ index + 1 }}</view>
            <view class="template-edit__body">
              <view class="template-edit__name">{{ item.exerciseName }}</view>
              <view class="template-edit__sets">
                <view class="template-edit__step btn-press" @tap="adjustSets(index, -1)">-</view>
                <view class="template-edit__sets-text">{{ item.targetSets }} 组</view>
                <view class="template-edit__step btn-press" @tap="adjustSets(index, 1)">+</view>
              </view>
            </view>
            <view class="template-edit__actions">
              <view class="template-edit__mini btn-press" @tap="moveItem(index, -1)">上</view>
              <view class="template-edit__mini btn-press" @tap="moveItem(index, 1)">下</view>
              <view class="template-edit__danger btn-press" @tap="removeItem(index)">删</view>
            </view>
          </view>
        </view>
        <view v-else class="glass-card template-edit__empty">
          还没有动作，点击“添加动作”开始创建模板。
        </view>

        <view class="template-edit__footer-spacer" />
      </view>
    </scroll-view>

    <view class="template-edit__footer">
      <PrimaryButton @tap="saveTemplate">
        {{ saving ? '保存中...' : '保存到我的模板' }}
      </PrimaryButton>
    </view>

    <ExercisePicker
      :visible="pickerVisible"
      title="添加动作"
      subtitle="搜索并添加到当前模板"
      :selected-ids="items.map((item) => item.exerciseId)"
      @close="closeExercisePicker"
      @select="addExercise"
    />
  </view>
</template>

<style lang="scss" scoped>
.template-edit {
  min-height: 100vh;

  &__shell {
    padding-bottom: 160rpx;
  }

  &__form {
    padding: 24rpx;
  }

  &__label,
  &__section-title {
    color: #f5f5fa;
    font-size: 28rpx;
    font-weight: 800;
  }

  &__input {
    margin-top: 18rpx;
    min-height: 76rpx;
    color: #f5f5fa;
    font-size: 30rpx;
  }

  &__placeholder {
    color: #828296;
  }

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 32rpx 0 20rpx;
  }

  &__add {
    padding: 16rpx 22rpx;
    border-radius: 999rpx;
    color: #fff;
    font-size: 24rpx;
    font-weight: 700;
  }

  &__items {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 18rpx;
    padding: 22rpx;
  }

  &__order {
    width: 64rpx;
    height: 64rpx;
    border-radius: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 80, 30, 0.16);
    color: #ff501e;
    font-weight: 800;
  }

  &__body,
  &__exercise-body {
    flex: 1;
    min-width: 0;
  }

  &__name,
  &__exercise-name {
    color: #f5f5fa;
    font-size: 28rpx;
    font-weight: 700;
  }

  &__sets {
    display: flex;
    align-items: center;
    gap: 14rpx;
    margin-top: 14rpx;
  }

  &__step,
  &__mini,
  &__danger {
    min-width: 48rpx;
    height: 48rpx;
    border-radius: 16rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
    color: #f5f5fa;
    font-size: 22rpx;
  }

  &__sets-text {
    color: #a6a6b8;
    font-size: 24rpx;
  }

  &__actions {
    display: flex;
    gap: 8rpx;
  }

  &__danger {
    background: rgba(255, 80, 30, 0.14);
    color: #ff501e;
  }

  &__empty {
    padding: 28rpx;
    color: #828296;
    font-size: 24rpx;
  }

  &__footer,
  &__picker {
    position: fixed;
    left: 24rpx;
    right: 24rpx;
    z-index: 20;
  }

  &__footer {
    bottom: calc(24rpx + env(safe-area-inset-bottom));
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
    background: #101018;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  &__picker-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__picker-title {
    color: #f5f5fa;
    font-size: 34rpx;
    font-weight: 800;
  }

  &__picker-sub,
  &__exercise-meta,
  &__picker-footer {
    margin-top: 8rpx;
    color: #828296;
    font-size: 22rpx;
  }

  &__close {
    width: 68rpx;
    height: 68rpx;
    border-radius: 22rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
    color: #f5f5fa;
    font-size: 36rpx;
  }

  &__search {
    margin-top: 24rpx;
    padding: 20rpx 24rpx;
  }

  &__search-input {
    color: #f5f5fa;
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
    background: rgba(255, 255, 255, 0.08);
    color: #f5f5fa;
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
    color: #ff501e;
    font-size: 30rpx;
    font-weight: 800;
  }

  &__exercise-add {
    color: #ff501e;
    font-size: 24rpx;
    font-weight: 700;
  }

  &__picker-footer {
    padding: 20rpx 0;
    text-align: center;
  }
}
</style>
