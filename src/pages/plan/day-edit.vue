<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import AppHeader from '@/components/app-header/index.vue'
import MembershipRequiredModal from '@/components/membership-required-modal/index.vue'
import PrimaryButton from '@/components/primary-button/index.vue'
import { usePlanStore } from '@/stores/plan'
import { useTemplateStore } from '@/stores/template'
import { useThemeStore } from '@/stores/theme'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { ensureMembershipFeature } from '@/utils/membership-guard'
import { routes } from '@/utils/navigation'

const weekdays = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' }
]

const planStore = usePlanStore()
const templateStore = useTemplateStore()
const themeStore = useThemeStore()
const planId = ref<number | null>(null)
const dayId = ref<number | null>(null)
const planCycleWeeks = ref(4)
const title = ref('')
const weekIndex = ref(1)
const dayOfWeek = ref(1)
const templateId = ref<number | null>(null)
const sortOrder = ref(0)
const completed = ref(false)
const saving = ref(false)
const clientRequestId = `plan-day-${Date.now()}-${Math.random().toString(16).slice(2)}`

const isCreateMode = computed(() => !dayId.value)
const userTemplates = computed(() => templateStore.userItems)
const systemTemplates = computed(() => templateStore.systemItems)
const templates = computed(() => [...userTemplates.value, ...systemTemplates.value])
const selectedTemplateName = computed(
  () => templates.value.find((item) => item.id === templateId.value)?.name || '请选择训练模板'
)
const pageTitle = computed(() => (isCreateMode.value ? '新增训练日' : '编辑训练日'))
const actionText = computed(() => {
  if (completed.value) return '已完成，不能修改'
  if (saving.value) return '保存中...'
  return isCreateMode.value ? '保存训练日' : '保存修改'
})

onLoad((options) => {
  const id = Number(options?.id)
  const rawDayId = Number(options?.dayId)
  planId.value = Number.isFinite(id) && id > 0 ? id : null
  dayId.value = Number.isFinite(rawDayId) && rawDayId > 0 ? rawDayId : null
})

onShow(async () => {
  const ok = await ensureFeatureAuth('训练计划')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  await templateStore.fetchTemplates({ includeDetails: false }).catch((err) => {
    console.error('[plan] templates load failed', err)
  })
  await loadDay()
})

async function loadDay() {
  if (!planId.value) return
  try {
    const detail = await planStore.getDetail(planId.value, true)
    if (detail.planType === 'SYSTEM') {
      uni.showToast({ title: '系统计划不能编辑', icon: 'none' })
      uni.navigateBack()
      return
    }

    planCycleWeeks.value = Math.max(1, detail.cycleWeeks || 4)
    if (!dayId.value) {
      const lastDay = [...detail.days].sort(
        (a, b) =>
          b.weekIndex - a.weekIndex || b.dayOfWeek - a.dayOfWeek || b.sortOrder - a.sortOrder
      )[0]
      title.value = '训练日'
      weekIndex.value = Math.min(planCycleWeeks.value, lastDay?.weekIndex || 1)
      dayOfWeek.value = lastDay ? Math.min(7, lastDay.dayOfWeek + 1) : 1
      templateId.value = templates.value[0]?.id || null
      sortOrder.value = detail.days.length + 1
      completed.value = false
      return
    }

    const day = detail.days.find((item) => item.id === dayId.value)
    if (!day) {
      uni.showToast({ title: '训练日不存在', icon: 'none' })
      uni.navigateBack()
      return
    }
    title.value = day.title
    weekIndex.value = day.weekIndex
    dayOfWeek.value = day.dayOfWeek
    templateId.value = day.templateId
    sortOrder.value = day.sortOrder || 0
    completed.value = !!day.completed
  } catch (err) {
    uni.showToast({ title: '训练日加载失败', icon: 'none' })
    console.error('[plan] day load failed', err)
  }
}

function goBack() {
  uni.navigateBack()
}

function chooseTemplate(id: number) {
  if (completed.value) return
  templateId.value = id
}

function changeWeek(delta: number) {
  if (completed.value) return
  weekIndex.value = Math.min(planCycleWeeks.value, Math.max(1, weekIndex.value + delta))
}

function chooseWeekday(value: number) {
  if (completed.value) return
  dayOfWeek.value = value
}

async function saveDay() {
  if (!planId.value || saving.value || completed.value) return
  if (!title.value.trim()) {
    uni.showToast({ title: '请输入训练日标题', icon: 'none' })
    return
  }
  if (!templateId.value) {
    uni.showToast({ title: '请选择训练模板', icon: 'none' })
    return
  }

  saving.value = true
  try {
    if (!(await ensureMembershipFeature('自定义训练计划'))) return
    const payload = {
      title: title.value.trim(),
      weekIndex: weekIndex.value,
      dayOfWeek: dayOfWeek.value,
      templateId: templateId.value,
      sortOrder: sortOrder.value
    }
    if (dayId.value) {
      await planStore.updateDay(planId.value, dayId.value, payload)
    } else {
      await planStore.createDay(planId.value, { ...payload, clientRequestId })
    }
    uni.showToast({ title: isCreateMode.value ? '已新增训练日' : '已更新训练日', icon: 'none' })
    uni.redirectTo({ url: `${routes.planDetail}?id=${planId.value}` })
  } catch (err) {
    uni.showToast({ title: '保存失败', icon: 'none' })
    console.error('[plan] day save failed', err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
    <view
      class="page-shell plan-day-edit operation-page safe-bottom"
      :class="themeStore.themeClass"
    >
      <AppHeader
        :title="pageTitle"
        subtitle="选择训练日位置和使用的模板"
        show-back
        @back="goBack"
      />

      <view v-if="completed" class="glass-card plan-day-edit__locked">
        已完成训练日不能修改，避免影响历史记录。
      </view>

      <view class="glass-card plan-day-edit__form">
        <view class="plan-day-edit__field">
          <view class="plan-day-edit__label">训练日标题</view>
          <input
            v-model="title"
            class="plan-day-edit__input"
            :disabled="completed"
            placeholder="例如：推力训练"
            placeholder-class="plan-day-edit__placeholder"
          />
        </view>

        <view class="plan-day-edit__section-head">安排</view>
        <view class="plan-day-edit__week-card">
          <view>
            <view class="plan-day-edit__muted">第几周</view>
            <view class="plan-day-edit__week-value">第 {{ weekIndex }} 周</view>
          </view>
          <view class="plan-day-edit__stepper">
            <button
              class="plan-day-edit__step btn-press"
              :disabled="completed || weekIndex <= 1"
              @tap="changeWeek(-1)"
            >
              -
            </button>
            <button
              class="plan-day-edit__step btn-press"
              :disabled="completed || weekIndex >= planCycleWeeks"
              @tap="changeWeek(1)"
            >
              +
            </button>
          </view>
        </view>

        <view class="plan-day-edit__weekday-row">
          <button
            v-for="item in weekdays"
            :key="item.value"
            class="plan-day-edit__weekday btn-press"
            :class="{ 'plan-day-edit__weekday--active': dayOfWeek === item.value }"
            :disabled="completed"
            @tap="chooseWeekday(item.value)"
          >
            {{ item.label }}
          </button>
        </view>

        <view class="plan-day-edit__selected">当前模板：{{ selectedTemplateName }}</view>
      </view>

      <view class="plan-day-edit__section-title">选择训练模板</view>

      <view class="plan-day-edit__template-group">
        <view class="plan-day-edit__group-title">我的模板</view>
        <view v-if="!userTemplates.length" class="glass-card plan-day-edit__empty">
          还没有我的模板，可从系统模板复制后编辑。
        </view>
        <view
          v-for="item in userTemplates"
          :key="item.id"
          class="glass-card plan-day-edit__template btn-press"
          :class="{ 'plan-day-edit__template--active': item.id === templateId }"
          @tap="chooseTemplate(item.id)"
        >
          <view>
            <view class="plan-day-edit__template-name">{{ item.name }}</view>
            <view class="plan-day-edit__template-meta">我的模板 · {{ item.exercises }} 个动作</view>
          </view>
          <view class="plan-day-edit__template-check">
            {{ item.id === templateId ? '已选' : '选择' }}
          </view>
        </view>
      </view>

      <view class="plan-day-edit__template-group">
        <view class="plan-day-edit__group-title">系统模板</view>
        <view
          v-for="item in systemTemplates"
          :key="item.id"
          class="glass-card plan-day-edit__template btn-press"
          :class="{ 'plan-day-edit__template--active': item.id === templateId }"
          @tap="chooseTemplate(item.id)"
        >
          <view>
            <view class="plan-day-edit__template-name">{{ item.name }}</view>
            <view class="plan-day-edit__template-meta">系统模板 · {{ item.exercises }} 个动作</view>
          </view>
          <view class="plan-day-edit__template-check">
            {{ item.id === templateId ? '已选' : '选择' }}
          </view>
        </view>
      </view>

      <view class="plan-day-edit__footer">
        <PrimaryButton :disabled="saving || completed" :loading="saving" @tap="saveDay">
          {{ actionText }}
        </PrimaryButton>
      </view>
    </view>
  </scroll-view>
  <MembershipRequiredModal />
</template>

<style lang="scss" scoped>
.plan-day-edit {
  padding-bottom: 150rpx;

  &__locked,
  &__form {
    margin-top: 24rpx;
    padding: 26rpx;
  }

  &__locked {
    color: var(--app-success);
    border-color: rgba(80, 220, 180, 0.2);
  }

  &__field + &__field {
    margin-top: 24rpx;
  }

  &__label,
  &__section-title,
  &__section-head,
  &__group-title {
    color: var(--app-text);
    font-size: 24rpx;
    font-weight: 900;
  }

  &__section-head {
    margin-top: 26rpx;
  }

  &__input {
    margin-top: 12rpx;
    min-height: 76rpx;
    padding: 0 22rpx;
    border-radius: 22rpx;
    border: 1rpx solid var(--app-border);
    background: var(--app-bg);
    color: var(--app-text-secondary);
    font-size: 26rpx;
  }

  &__placeholder,
  &__muted {
    color: var(--app-text-muted);
  }

  &__week-card {
    min-height: 92rpx;
    margin-top: 14rpx;
    padding: 18rpx 20rpx;
    border-radius: 24rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18rpx;
    background: var(--app-bg);
    border: 1rpx solid var(--app-border);
  }

  &__week-value {
    margin-top: 6rpx;
    color: var(--app-text);
    font-size: 30rpx;
    font-weight: 900;
  }

  &__stepper {
    display: flex;
    gap: 12rpx;
  }

  &__step {
    width: 64rpx;
    height: 64rpx;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-accent);
    background: var(--app-accent-soft);
    font-size: 34rpx;
    font-weight: 900;

    &::after {
      border: 0;
    }

    &[disabled] {
      color: var(--app-text-muted);
      background: var(--app-bg);
    }
  }

  &__weekday-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12rpx;
    margin-top: 16rpx;
  }

  &__weekday {
    min-height: 64rpx;
    margin: 0;
    padding: 0;
    border: 1rpx solid var(--app-border);
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-text-secondary);
    background: var(--app-bg);
    font-size: 22rpx;
    font-weight: 900;

    &::after {
      border: 0;
    }

    &--active {
      color: var(--app-accent);
      background: var(--app-accent-soft);
      border-color: rgba(255, 100, 24, 0.32);
    }
  }

  &__selected {
    margin-top: 24rpx;
    color: var(--app-accent);
    font-size: 23rpx;
  }

  &__section-title {
    margin-top: 30rpx;
  }

  &__template-group {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
    margin-top: 16rpx;
  }

  &__group-title {
    color: var(--app-text-muted);
    letter-spacing: 3rpx;
    text-transform: uppercase;
  }

  &__template,
  &__empty {
    padding: 24rpx;
  }

  &__template {
    display: flex;
    justify-content: space-between;
    gap: 18rpx;
    align-items: center;

    &--active {
      border-color: rgba(255, 80, 30, 0.34);
      background: var(--app-surface-warm);
    }
  }

  &__template-name {
    color: var(--app-text);
    font-size: 27rpx;
    font-weight: 900;
  }

  &__template-meta,
  &__empty {
    margin-top: 8rpx;
    color: var(--app-text-muted);
    font-size: 22rpx;
  }

  &__template-check {
    color: var(--app-accent);
    font-size: 22rpx;
    font-weight: 900;
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
