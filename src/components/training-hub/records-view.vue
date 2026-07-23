<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EmptyState from '@/components/empty-state/index.vue'
import TrainingRecordCard from '@/components/training-record-card/index.vue'
import {
  fetchCalendarDate,
  fetchCalendarMonth,
  type CalendarDateDetailResponse,
  type CalendarMonthResponse
} from '@/api/calendar'
import { routes } from '@/utils/navigation'
import { useTrainingStore } from '@/stores/training'
import { useThemeStore } from '@/stores/theme'

const trainingStore = useTrainingStore()
const themeStore = useThemeStore()
type ViewMode = 'calendar' | 'records'
type HistoryFilterKey = 'week' | 'month' | 'lastMonth' | 'year' | 'all'
const props = defineProps<{ mode: ViewMode }>()
const now = new Date()
const activeMode = ref<ViewMode>(props.mode)
const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1)
const selectedDate = ref(dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate()))
const monthData = ref<CalendarMonthResponse | null>(null)
const dateDetail = ref<CalendarDateDetailResponse | null>(null)
const loadingMonth = ref(false)
const loadingDate = ref(false)
let monthRequestId = 0
let dateRequestId = 0
const activeFilter = ref<HistoryFilterKey>('month')
const filters: Array<{ key: HistoryFilterKey; label: string }> = [
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'lastMonth', label: '上个月' },
  { key: 'year', label: '今年' },
  { key: 'all', label: '全部' }
]
const historyList = computed(() => trainingStore.history)
const firstDay = computed(() => new Date(year.value, month.value - 1, 1).getDay())
const daysInMonth = computed(() => new Date(year.value, month.value, 0).getDate())
const markerMap = computed(() =>
  Object.fromEntries((monthData.value?.days || []).map((day) => [day.date, day]))
)
const selectedTitle = computed(() => {
  if (!selectedDate.value) return '选择日期查看安排'
  const date = new Date(`${selectedDate.value}T00:00:00`)
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]}`
})

onMounted(async () => {
  if (activeMode.value === 'calendar') {
    await loadMonth()
    await loadDate(selectedDate.value)
  } else {
    fetchHistory(true)
  }
})

async function loadMonth() {
  const requestId = ++monthRequestId
  loadingMonth.value = true
  try {
    const result = await fetchCalendarMonth(year.value, month.value)
    if (requestId === monthRequestId) monthData.value = result
  } catch (err) {
    if (requestId === monthRequestId) monthData.value = null
    console.error('[calendar] month failed', err)
  } finally {
    if (requestId === monthRequestId) loadingMonth.value = false
  }
}

async function loadDate(date: string) {
  const requestId = ++dateRequestId
  loadingDate.value = true
  try {
    const result = await fetchCalendarDate(date)
    if (requestId === dateRequestId) dateDetail.value = result
  } catch (err) {
    if (requestId === dateRequestId) dateDetail.value = null
    console.error('[calendar] date failed', err)
  } finally {
    if (requestId === dateRequestId) loadingDate.value = false
  }
}

async function changeMonth(delta: number) {
  const next = new Date(year.value, month.value - 1 + delta, 1)
  year.value = next.getFullYear()
  month.value = next.getMonth() + 1
  selectedDate.value = dateKey(year.value, month.value, 1)
  dateDetail.value = null
  await loadMonth()
  await loadDate(selectedDate.value)
}

async function selectDay(day: number) {
  selectedDate.value = dateKey(year.value, month.value, day)
  await loadDate(selectedDate.value)
}

function dateKey(targetYear: number, targetMonth: number, day: number) {
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function statusText(status: string) {
  const labels: Record<string, string> = {
    TODAY_PENDING: '今日待训练',
    UPCOMING: '计划训练',
    OVERDUE: '待补练',
    SKIPPED: '已跳过本次安排',
    COMPLETED: '已按计划完成',
    COMPLETED_EARLY: '已提前完成',
    COMPLETED_LATE: '已补练完成'
  }
  return labels[status] || status
}

function openRecord(id?: number) {
  if (id) uni.navigateTo({ url: `${routes.historyDetail}?id=${id}` })
}

function openPlanDay(item: CalendarDateDetailResponse['planDays'][number]) {
  if (item.completedTrainingId) {
    openRecord(item.completedTrainingId)
    return
  }
  if (item.executionDayId) {
    uni.navigateTo({ url: `${routes.planExecutionDay}?dayId=${item.executionDayId}` })
  }
}

function switchFilter(key: HistoryFilterKey) {
  if (activeFilter.value === key) return
  activeFilter.value = key
  fetchHistory(true)
}

function fetchHistory(reset = false) {
  const range = getFilterRange(activeFilter.value)
  trainingStore.fetchHistory({ reset, startedFrom: range.startedFrom, startedTo: range.startedTo })
}

function loadMore() {
  if (activeMode.value !== 'records' || trainingStore.loading || !trainingStore.historyHasMore)
    return
  fetchHistory(false)
}

function formatHistoryDate(dateText: string) {
  const date = new Date(dateText)
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

function getFilterRange(key: HistoryFilterKey): { startedFrom?: string; startedTo?: string } {
  const today = new Date()
  if (key === 'all') return {}
  if (key === 'week') {
    const start = new Date(today)
    const day = start.getDay() || 7
    start.setDate(start.getDate() - day + 1)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return toRange(start, end)
  }
  if (key === 'lastMonth') {
    return toRange(
      new Date(today.getFullYear(), today.getMonth() - 1, 1),
      new Date(today.getFullYear(), today.getMonth(), 0)
    )
  }
  if (key === 'year') {
    return toRange(new Date(today.getFullYear(), 0, 1), new Date(today.getFullYear(), 11, 31))
  }
  return toRange(
    new Date(today.getFullYear(), today.getMonth(), 1),
    new Date(today.getFullYear(), today.getMonth() + 1, 0)
  )
}

function toRange(start: Date, end: Date) {
  return { startedFrom: toDateString(start), startedTo: toDateString(end) }
}

function toDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <view class="training-records" :class="themeStore.themeClass">
    <view class="calendar-page">
      <template v-if="activeMode === 'calendar'">
        <view class="month-row">
          <view class="month-button btn-press" @tap="changeMonth(-1)">‹</view>
          <view class="month-title">{{ year }} 年 {{ month }} 月</view>
          <view class="month-button btn-press" @tap="changeMonth(1)">›</view>
        </view>
        <view class="summary">
          <view
            ><strong class="summary__value">{{ monthData?.summary.plannedCount ?? 0 }}</strong
            ><text>本月计划</text></view
          >
          <view
            ><strong class="summary__value">{{ monthData?.summary.trainedDayCount ?? 0 }}</strong
            ><text>已训练天数</text></view
          >
          <view
            ><strong class="summary__value"
              >{{ monthData?.summary.completionRate ?? '--'
              }}{{ monthData?.summary.completionRate == null ? '' : '%' }}</strong
            ><text>已到期完成</text></view
          >
        </view>

        <view class="calendar-card">
          <view class="week-row"
            ><text v-for="label in ['日', '一', '二', '三', '四', '五', '六']" :key="label">{{
              label
            }}</text></view
          >
          <view class="day-grid">
            <view v-for="empty in firstDay" :key="`e-${empty}`" class="day day--empty" />
            <view
              v-for="day in daysInMonth"
              :key="day"
              class="day btn-press"
              :class="{
                'day--selected': selectedDate === dateKey(year, month, day),
                'day--planned': markerMap[dateKey(year, month, day)]?.hasPlan,
                'day--attention': markerMap[dateKey(year, month, day)]?.needsAttention
              }"
              @tap="selectDay(day)"
            >
              <text>{{ day }}</text>
              <view v-if="markerMap[dateKey(year, month, day)]?.hasTraining" class="day__dot" />
            </view>
          </view>
          <view v-if="loadingMonth" class="loading-line">正在加载月度安排...</view>
        </view>

        <view class="legend"
          ><view><i class="legend__plan" />计划日</view
          ><view><i class="legend__training" />已训练</view
          ><view><i class="legend__attention" />需处理</view></view
        >

        <view class="detail-head"
          ><view
            ><strong class="detail-head__title">{{ selectedTitle }}</strong
            ><text>当天安排和训练记录</text></view
          ></view
        >
        <view v-if="loadingDate" class="detail-empty">正在加载当天安排...</view>
        <template v-else>
          <view
            v-for="item in dateDetail?.planDays || []"
            :key="`p-${item.sourceType || 'PLAN_EXECUTION'}-${item.executionId}-${item.executionDayId}`"
            class="detail-card btn-press"
            @tap="openPlanDay(item)"
          >
            <image
              v-if="item.coverUrl"
              class="detail-card__cover"
              :src="item.coverUrl"
              mode="aspectFill"
            />
            <view v-else class="detail-card__icon detail-card__icon--plan">计</view>
            <view class="detail-card__body">
              <strong class="detail-card__title">{{ item.title }}</strong>
              <text v-if="item.completedTrainingId">
                {{ Math.round((item.durationSeconds || 0) / 60) }} min ·
                {{ item.totalSetCount || 0 }} 组 ·
                {{ Number(item.totalVolumeKg || 0).toFixed(0) }} kg
              </text>
              <text v-else>{{ item.planName }} · {{ item.templateName || '训练模板' }}</text>
            </view>
            <view class="status" :class="{ 'status--attention': item.status === 'OVERDUE' }">{{
              statusText(item.status)
            }}</view>
          </view>
          <TrainingRecordCard
            v-for="item in dateDetail?.trainingRecords || []"
            :key="`r-${item.id}`"
            class="calendar-record-card"
            :variant="themeStore.resolvedTheme"
            :name="item.trainingName"
            :cover-url="item.coverUrl"
            :cover-record-type="item.coverRecordType"
            :meta="`${Math.round(item.durationSeconds / 60)} min · ${item.totalSetCount} 组 · ${Number(item.totalVolumeKg || 0).toFixed(0)} kg`"
            @tap="openRecord(item.id)"
          />
          <view
            v-if="!dateDetail?.planDays.length && !dateDetail?.trainingRecords.length"
            class="detail-empty"
            >当天没有计划安排或训练记录</view
          >
        </template>
      </template>

      <template v-else>
        <scroll-view scroll-x class="record-filters">
          <view class="record-filters__inner">
            <view
              v-for="filter in filters"
              :key="filter.key"
              class="record-filter btn-press"
              :class="{ 'record-filter--active': activeFilter === filter.key }"
              @tap="switchFilter(filter.key)"
            >
              {{ filter.label }}
            </view>
          </view>
        </scroll-view>
        <view v-if="trainingStore.loading && !historyList.length" class="detail-empty"
          >正在加载训练记录...</view
        >
        <view v-else-if="trainingStore.historyError" class="record-state">
          <EmptyState
            icon="!"
            title="训练记录加载失败"
            description="网络或服务暂时异常，可以稍后重试。"
          />
          <view class="record-retry btn-press" @tap="fetchHistory(true)">重新加载</view>
        </view>
        <view v-else-if="!historyList.length" class="record-state">
          <EmptyState
            icon="—"
            title="当前范围没有训练记录"
            description="完成一次训练后，会在这里看到历史复盘。"
          />
        </view>
        <view v-else>
          <TrainingRecordCard
            v-for="item in historyList"
            :key="item.id"
            class="calendar-record-card"
            :variant="themeStore.resolvedTheme"
            :name="item.trainingName"
            :cover-url="item.coverUrl"
            :cover-record-type="item.coverRecordType"
            :meta="`${formatHistoryDate(item.startedAt)} · ${Math.round(item.durationSeconds / 60)} min · ${item.totalSetCount} 组`"
            @tap="openRecord(item.id)"
          />
          <view
            class="record-footer btn-press"
            :class="{ 'record-footer--enabled': trainingStore.historyHasMore }"
            @tap="loadMore"
          >
            {{
              trainingStore.loading
                ? '加载中...'
                : trainingStore.historyHasMore
                  ? '点击加载更多'
                  : '没有更多记录了'
            }}
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<style scoped lang="scss">
.training-records {
  width: 100%;
}

.calendar-page {
  padding-bottom: 24rpx;
}
.month-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}
.month-button {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
  border: 1rpx solid var(--app-border);
  background: var(--app-bg);
  color: var(--app-text-muted);
  font-size: 40rpx;
}
.month-title {
  color: var(--app-text);
  font-size: 34rpx;
  font-weight: 900;
}
.summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  margin-bottom: 22rpx;
}
.summary view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  color: var(--app-text-muted);
  font-size: 20rpx;
}
.summary__value {
  color: var(--app-text);
  font-size: 30rpx;
}
.calendar-card {
  position: relative;
  padding: 26rpx 20rpx 22rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 30rpx;
  background: var(--app-surface);
  box-shadow: var(--app-shadow-card);
}
.week-row,
.day-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8rpx;
}
.week-row text {
  text-align: center;
  color: var(--app-text-muted);
  font-size: 20rpx;
  padding-bottom: 14rpx;
}
.day {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid transparent;
  border-radius: 22rpx;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 24rpx;
  font-weight: 800;
}
.day--empty {
  opacity: 0;
}
.day--planned {
  border-color: rgba(255, 111, 55, 0.58);
}
.day--selected {
  background: var(--app-accent);
  border-color: var(--app-accent);
  color: #fff;
  box-shadow: var(--app-shadow-cta);
}
.day--attention:before {
  content: '';
  position: absolute;
  right: 8rpx;
  top: 8rpx;
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: #ffb02e;
}
.day__dot {
  position: absolute;
  bottom: 8rpx;
  width: 9rpx;
  height: 9rpx;
  border-radius: 50%;
  background: #43d9a1;
  box-shadow: 0 0 12rpx rgba(67, 217, 161, 0.42);
}
.loading-line,
.detail-empty {
  margin-top: 20rpx;
  padding: 28rpx;
  border-radius: 24rpx;
  border: 1rpx solid var(--app-border);
  background: var(--app-surface);
  color: var(--app-text-muted);
  text-align: center;
  font-size: 24rpx;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin: 18rpx 4rpx 34rpx;
  color: var(--app-text-muted);
  font-size: 20rpx;
}
.legend view {
  min-height: 44rpx;
  padding: 0 14rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.72);
}
.legend i {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
}
.legend__plan {
  border: 2rpx solid var(--app-accent);
}
.legend__training {
  background: #43d9a1;
}
.legend__attention {
  background: #ffb02e;
}
.detail-head {
  margin-bottom: 18rpx;
}
.detail-head view {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.detail-head__title {
  color: var(--app-text);
  font-size: 34rpx;
}
.detail-head text {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.detail-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 22rpx;
  margin-bottom: 14rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 26rpx;
  background: var(--app-surface);
  box-shadow: var(--app-shadow-card);
}
.detail-card__icon {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
  background: rgba(255, 84, 29, 0.18);
  color: var(--app-accent);
  font-weight: 900;
}
.detail-card__cover {
  width: 72rpx;
  height: 72rpx;
  border-radius: 22rpx;
  background: var(--app-bg);
  flex-shrink: 0;
}
.detail-card__icon--plan {
  background: rgba(63, 193, 142, 0.14);
  color: #43d9a1;
}
.detail-card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7rpx;
}
.detail-card__title {
  color: var(--app-text);
  font-size: 28rpx;
}
.detail-card__body text {
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.status {
  padding: 10rpx 14rpx;
  border-radius: 16rpx;
  background: rgba(62, 198, 146, 0.13);
  color: #43d9a1;
  font-size: 20rpx;
  font-weight: 800;
}
.status--attention {
  background: rgba(255, 176, 46, 0.12);
  color: #ffb02e;
}
.detail-card__arrow {
  color: var(--app-text-muted);
  font-size: 42rpx;
}
.record-filters {
  margin-bottom: 24rpx;
  white-space: nowrap;
}
.record-filters__inner {
  display: inline-flex;
  gap: 12rpx;
}
.record-filter {
  min-width: 112rpx;
  min-height: 62rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  border: 1rpx solid var(--app-border);
  background: var(--app-surface);
  color: var(--app-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 800;
}
.record-filter--active {
  background: linear-gradient(105deg, #f04b20, #e67523);
  color: #fff;
}
.record-state {
  padding-top: 48rpx;
}
.record-retry {
  margin: 24rpx auto 0;
  width: 220rpx;
  min-height: 68rpx;
  border-radius: 22rpx;
  background: linear-gradient(105deg, #f04b20, #e67523);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
}
.record-footer {
  padding: 24rpx;
  text-align: center;
  color: var(--app-text-muted);
  font-size: 22rpx;
}

.record-footer--enabled {
  color: var(--app-accent);
}
.calendar-record-card {
  margin-bottom: 14rpx;
}
</style>
