<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onMounted, ref, watch } from 'vue'
import type { BodyMetricTrendPoint } from '@/api/user'
import { useThemeStore } from '@/stores/theme'

const props = withDefaults(
  defineProps<{
    points: BodyMetricTrendPoint[]
    unit: string
    height?: number
    canvasId?: string
  }>(),
  {
    height: 220,
    canvasId: 'metricTrendCanvas'
  }
)

const instance = getCurrentInstance()
const themeStore = useThemeStore()
const canvasWidth = ref(320)
const canvasHeight = computed(() => props.height)
const selectedIndex = ref<number | null>(null)

const selectedPoint = computed(() => {
  if (selectedIndex.value === null) return null
  return props.points[selectedIndex.value] || null
})
const chartColors = computed(() =>
  themeStore.resolvedTheme === 'dark'
    ? {
        accent: '#ff7138',
        accentSoft: 'rgba(255, 113, 56, 0.28)',
        pointActive: '#f5f6f8',
        grid: 'rgba(255, 255, 255, 0.08)',
        muted: '#9399a6'
      }
    : {
        accent: '#ff6418',
        accentSoft: 'rgba(255, 100, 24, 0.22)',
        pointActive: '#ffffff',
        grid: 'rgba(31, 49, 72, 0.1)',
        muted: '#8491a3'
      }
)

watch(
  () => [props.points, selectedIndex.value, props.height, themeStore.resolvedTheme],
  () => {
    nextTick(drawChart)
  },
  { deep: true }
)

onMounted(() => {
  nextTick(measureAndDraw)
})

function measureAndDraw() {
  const proxy = instance?.proxy
  if (!proxy) return
  uni
    .createSelectorQuery()
    .in(proxy)
    .select('.metric-trend-chart__canvas')
    .boundingClientRect((rect) => {
      if (rect && !Array.isArray(rect) && rect.width) {
        canvasWidth.value = rect.width
      }
      drawChart()
    })
    .exec()
}

function drawChart() {
  const proxy = instance?.proxy
  if (!proxy) return

  const ctx = uni.createCanvasContext(props.canvasId, proxy)
  const width = canvasWidth.value
  const height = canvasHeight.value
  const padding = { top: 24, right: 18, bottom: 34, left: 38 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const points = props.points

  ctx.clearRect(0, 0, width, height)
  ctx.setFillStyle('rgba(255, 255, 255, 0)')
  ctx.fillRect(0, 0, width, height)

  drawGrid(ctx, width, padding, chartHeight)

  if (points.length < 2) {
    ctx.setFillStyle(chartColors.value.muted)
    ctx.setFontSize(13)
    ctx.setTextAlign('center')
    ctx.fillText('记录 2 次后生成趋势', width / 2, height / 2)
    ctx.draw()
    return
  }

  const values = points.map((point) => point.value)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const range = maxValue === minValue ? 1 : maxValue - minValue
  const coordinates = points.map((point, index) => {
    const x = padding.left + (chartWidth * index) / Math.max(points.length - 1, 1)
    const y = padding.top + chartHeight - ((point.value - minValue) / range) * chartHeight
    return { x, y }
  })

  ctx.setStrokeStyle(chartColors.value.accentSoft)
  ctx.setLineWidth(8)
  ctx.setLineCap('round')
  ctx.beginPath()
  coordinates.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y)
    else ctx.lineTo(point.x, point.y)
  })
  ctx.stroke()

  ctx.setStrokeStyle(chartColors.value.accent)
  ctx.setLineWidth(3)
  ctx.beginPath()
  coordinates.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y)
    else ctx.lineTo(point.x, point.y)
  })
  ctx.stroke()

  coordinates.forEach((point, index) => {
    const active = selectedIndex.value === index
    ctx.beginPath()
    ctx.setFillStyle(active ? chartColors.value.pointActive : chartColors.value.accent)
    ctx.arc(point.x, point.y, active ? 5 : 3, 0, Math.PI * 2)
    ctx.fill()
  })

  drawAxisLabels(ctx, points, padding, chartWidth, height, minValue, maxValue)
  ctx.draw()
}

function drawGrid(
  ctx: UniApp.CanvasContext,
  width: number,
  padding: { top: number; right: number; bottom: number; left: number },
  chartHeight: number
) {
  ctx.setStrokeStyle(chartColors.value.grid)
  ctx.setLineWidth(1)
  for (let i = 0; i < 4; i += 1) {
    const y = padding.top + (chartHeight * i) / 3
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(width - padding.right, y)
    ctx.stroke()
  }
}

function drawAxisLabels(
  ctx: UniApp.CanvasContext,
  points: BodyMetricTrendPoint[],
  padding: { top: number; right: number; bottom: number; left: number },
  chartWidth: number,
  height: number,
  minValue: number,
  maxValue: number
) {
  ctx.setFillStyle(chartColors.value.muted)
  ctx.setFontSize(10)
  ctx.setTextAlign('right')
  ctx.fillText(`${Number(maxValue.toFixed(1))}`, padding.left - 8, padding.top + 4)
  ctx.fillText(`${Number(minValue.toFixed(1))}`, padding.left - 8, height - padding.bottom)

  ctx.setTextAlign('center')
  const first = points[0]
  const last = points[points.length - 1]
  ctx.fillText(formatDate(first.date), padding.left, height - 10)
  ctx.fillText(formatDate(last.date), padding.left + chartWidth, height - 10)
}

function formatDate(date: string) {
  const parts = date.split('-')
  if (parts.length < 3) return date
  return `${Number(parts[1])}/${Number(parts[2])}`
}

function handleTouch(event: TouchEvent) {
  if (props.points.length < 2) return
  const touch = event.changedTouches?.[0] || event.touches?.[0]
  if (!touch) return
  const touchX = Number((touch as Touch & { x?: number }).x ?? touch.clientX)
  if (!Number.isFinite(touchX)) return
  const paddingLeft = 38
  const paddingRight = 18
  const chartWidth = canvasWidth.value - paddingLeft - paddingRight
  const ratio = Math.max(0, Math.min(1, (touchX - paddingLeft) / chartWidth))
  selectedIndex.value = Math.round(ratio * (props.points.length - 1))
}
</script>

<template>
  <view class="metric-trend-chart">
    <canvas
      class="metric-trend-chart__canvas"
      :canvas-id="canvasId"
      :style="{ height: `${height}px` }"
      @touchstart="handleTouch"
      @touchmove="handleTouch"
    />
    <view v-if="selectedPoint" class="metric-trend-chart__tooltip">
      <text>{{ selectedPoint.date }}</text>
      <text>{{ Number(selectedPoint.value) }}{{ unit || selectedPoint.unit }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.metric-trend-chart {
  position: relative;

  &__canvas {
    width: 100%;
    display: block;
  }

  &__tooltip {
    margin-top: 12rpx;
    min-height: 48rpx;
    padding: 0 18rpx;
    border-radius: 999rpx;
    display: inline-flex;
    align-items: center;
    gap: 12rpx;
    color: var(--app-accent);
    background: var(--app-accent-soft);
    border: 1rpx solid rgba(255, 80, 30, 0.28);
    font-size: 22rpx;
    font-weight: 800;
  }
}
</style>
