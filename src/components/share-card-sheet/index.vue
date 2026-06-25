<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref } from 'vue'
import type { SharePreviewResponse } from '@/api/share'
import { exerciseDefaultImageUrl } from '@/utils/static-assets'

const CANVAS_ID = 'shareCardCanvas'
const CARD_WIDTH = 375
const PREVIEW_MAX_ROWS = 6
const ROW_HEIGHT = 60
const DETAIL_LINE_HEIGHT = 22

interface ShareCardRow {
  title: string
  description: string
  thumbnailUrl?: string
  recordType?: string
  details?: string[]
}

const props = defineProps<{
  visible: boolean
  preview: SharePreviewResponse | null
  loading?: boolean
}>()

defineEmits<{
  close: []
  copy: []
}>()

const instance = getCurrentInstance()
const savingImage = ref(false)
const savedImage = ref(false)
const allRows = computed(() => collectShareRows(props.preview))
const previewRows = computed(() => allRows.value.slice(0, PREVIEW_MAX_ROWS))
const previewHiddenRowCount = computed(() => Math.max(0, allRows.value.length - PREVIEW_MAX_ROWS))
const canvasRows = computed(() => allRows.value)
const isActionListOnly = computed(() =>
  ['WORKOUT_SUMMARY', 'TEMPLATE_PREVIEW', 'PLAN_DAY_PREVIEW'].includes(props.preview?.type || '')
)
const canvasHeight = computed(() => {
  const baseHeight = isActionListOnly.value ? 194 : 232
  return baseHeight + canvasRows.value.reduce((total, row) => total + shareRowHeight(row), 0)
})

async function saveShareImage() {
  if (!props.preview || savingImage.value) return
  if (!isMiniProgram()) {
    uni.showToast({ title: '请在小程序端保存分享图，可先复制摘要', icon: 'none' })
    return
  }
  const proxy = instance?.proxy
  if (!proxy) return
  savingImage.value = true
  uni.showLoading({ title: '正在生成分享图...' })
  try {
    await nextTick()
    const imageMap = await loadRowImageMap(canvasRows.value)
    drawShareImage(props.preview, imageMap)
    await wait(280)
    const tempFilePath = await exportCanvas(proxy)
    await saveImage(tempFilePath)
    savedImage.value = true
    uni.hideLoading()
    uni.showToast({ title: '已保存到相册', icon: 'none' })
  } catch (err) {
    console.error('[share] save image failed', err)
    uni.hideLoading()
    const message = String((err as { errMsg?: string })?.errMsg || '')
    uni.showToast({
      title: message.includes('auth') || message.includes('authorize') ? '需要相册权限才能保存分享图' : '保存失败，可先复制摘要',
      icon: 'none'
    })
  } finally {
    savingImage.value = false
  }
}

function isMiniProgram() {
  const systemInfo = uni.getSystemInfoSync() as UniApp.GetSystemInfoResult & { uniPlatform?: string }
  return systemInfo.uniPlatform === 'mp-weixin' || typeof (globalThis as { wx?: unknown }).wx !== 'undefined'
}

function drawShareImage(preview: SharePreviewResponse, imageMap: Map<number, string>) {
  const proxy = instance?.proxy
  if (!proxy) return
  const ctx = uni.createCanvasContext(CANVAS_ID, proxy)
  const width = CARD_WIDTH
  const height = canvasHeight.value
  const padding = 24

  ctx.clearRect(0, 0, width, height)
  ctx.setFillStyle('#f3f6fb')
  ctx.fillRect(0, 0, width, height)

  drawRoundRect(ctx, 18, 18, width - 36, height - 36, 28, '#ffffff')
  drawRoundRect(ctx, padding + 4, padding + 2, 82, 26, 13, '#fff1e9')
  drawText(ctx, 'FitForge', padding + 17, padding + 21, 11, '#ff5b1f', 'bold')

  const header = shareImageHeader(preview)
  drawWrappedText(ctx, header.title, padding + 4, padding + 68, width - padding * 2 - 8, 24, 2, '#122033', 'bold')
  if (header.meta) {
    drawText(ctx, header.meta, padding + 4, padding + 104, 13, '#8491a3', 'bold')
  }

  const listTitleY = isActionListOnly.value ? padding + (header.meta ? 130 : 116) : padding + 152
  if (!isActionListOnly.value && preview.summary) {
    drawWrappedText(ctx, preview.summary, padding + 4, padding + 128, width - padding * 2 - 8, 15, 2, '#64748b')
  }
  drawText(ctx, '动作列表', padding + 4, listTitleY, 14, '#122033', 'bold')
  drawRows(ctx, canvasRows.value, padding + 4, listTitleY + 16, width - padding * 2 - 8, imageMap)

  ctx.draw()
}

function shareImageHeader(preview: SharePreviewResponse) {
  if (preview.type === 'WORKOUT_SUMMARY') {
    return {
      title: preview.visualTitle || preview.title || '训练记录',
      meta: workoutDurationText(preview)
    }
  }
  if (preview.type === 'TEMPLATE_PREVIEW') {
    return {
      title: preview.visualTitle || preview.title || '训练模板',
      meta: ''
    }
  }
  return {
    title: preview.visualTitle || preview.title || '训练分享',
    meta: preview.visualSubtitle || preview.subtitle || ''
  }
}

function workoutDurationText(preview: SharePreviewResponse) {
  const durationMetric = (preview.metrics || []).find((metric) => metric.label === '训练时长')
  return durationMetric?.value ? `训练时长 ${durationMetric.value}` : ''
}

function drawRows(ctx: UniApp.CanvasContext, rows: ShareCardRow[], x: number, y: number, width: number, imageMap: Map<number, string>) {
  let currentY = y
  rows.forEach((row, index) => {
    const rowHeight = shareRowHeight(row)
    const rowY = currentY
    drawRoundRect(ctx, x, rowY, width, rowHeight - 10, 14, '#f8fafc')
    const imagePath = imageMap.get(index)
    if (imagePath) {
      drawRoundRect(ctx, x + 10, rowY + 8, 34, 34, 10, '#eef2f7')
      ctx.drawImage(imagePath, x + 10, rowY + 8, 34, 34)
    } else {
      drawRoundRect(ctx, x + 10, rowY + 10, 28, 28, 14, '#fff1e9')
      drawText(ctx, String(index + 1), x + 24, rowY + 30, 12, '#ff5b1f', 'bold', 'center')
    }
    drawText(ctx, row.title, x + 54, rowY + 21, 13, '#122033', 'bold')
    drawText(ctx, row.description, x + 54, rowY + 39, 11, '#8491a3')
    drawRowDetails(ctx, row, x + 54, rowY + 48, width - 64)
    currentY += rowHeight
  })
}

function drawRowDetails(ctx: UniApp.CanvasContext, row: ShareCardRow, x: number, y: number, width: number) {
  const details = row.details || []
  if (!details.length) return
  const columnGap = 6
  const columnWidth = Math.floor((width - columnGap) / 2)
  details.forEach((detail, index) => {
    const column = index % 2
    const line = Math.floor(index / 2)
    const chipX = x + column * (columnWidth + columnGap)
    const chipY = y + line * DETAIL_LINE_HEIGHT
    drawRoundRect(ctx, chipX, chipY, columnWidth, 17, 8, '#eef2f7')
    drawText(ctx, detail, chipX + 7, chipY + 12, 8, '#64748b', 'bold')
  })
}

function shareRowHeight(row: ShareCardRow) {
  const detailLines = row.details?.length ? Math.ceil(row.details.length / 2) : 0
  return ROW_HEIGHT + detailLines * DETAIL_LINE_HEIGHT
}

function collectShareRows(preview: SharePreviewResponse | null): ShareCardRow[] {
  if (!preview) return []
  const sectionRows = (preview.sections || []).flatMap((section) => section.items || [])
  if (sectionRows.length) return sectionRows
  return preview.items || []
}

function shareRowImage(row: ShareCardRow) {
  return row.thumbnailUrl || defaultImageByRecordType(row.recordType)
}

function defaultImageByRecordType(recordType?: string) {
  if (recordType === 'DURATION') return exerciseDefaultImageUrl('duration.jpg')
  if (recordType === 'BODYWEIGHT_REPS') return exerciseDefaultImageUrl('bodyweight-reps.jpg')
  return exerciseDefaultImageUrl('weight-reps.jpg')
}

async function loadRowImageMap(rows: ShareCardRow[]) {
  const entries = await Promise.all(
    rows.map(async (row, index) => {
      const path = await loadImagePath(shareRowImage(row))
      return [index, path] as const
    })
  )
  return new Map(entries.filter((entry): entry is readonly [number, string] => Boolean(entry[1])))
}

function loadImagePath(src: string) {
  return new Promise<string | null>((resolve) => {
    uni.getImageInfo({
      src,
      success: (res) => resolve(res.path),
      fail: () => resolve(null)
    })
  })
}

function drawWrappedText(
  ctx: UniApp.CanvasContext,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  maxLines: number,
  color: string,
  weight = 'normal'
) {
  ctx.setFontSize(fontSize)
  ctx.setFillStyle(color)
  ;(ctx as UniApp.CanvasContext & { font?: string }).font = `${weight === 'bold' ? 'bold ' : ''}${fontSize}px sans-serif`
  const chars = text.split('')
  const lines: string[] = []
  let current = ''
  chars.forEach((char) => {
    const next = current + char
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current)
      current = char
      return
    }
    current = next
  })
  if (current) lines.push(current)
  lines.slice(0, maxLines).forEach((line, index) => {
    const suffix = index === maxLines - 1 && lines.length > maxLines ? '...' : ''
    ctx.fillText(`${line}${suffix}`, x, y + index * (fontSize + 8))
  })
}

function drawText(
  ctx: UniApp.CanvasContext,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  color: string,
  weight = 'normal',
  align: 'left' | 'center' | 'right' = 'left'
) {
  ctx.setFillStyle(color)
  ctx.setFontSize(fontSize)
  ctx.setTextAlign(align)
  ;(ctx as UniApp.CanvasContext & { font?: string }).font = `${weight === 'bold' ? 'bold ' : ''}${fontSize}px sans-serif`
  ctx.fillText(text, x, y)
  ctx.setTextAlign('left')
}

function drawRoundRect(
  ctx: UniApp.CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.arc(x + width - radius, y + radius, radius, -Math.PI / 2, 0)
  ctx.lineTo(x + width, y + height - radius)
  ctx.arc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2)
  ctx.lineTo(x + radius, y + height)
  ctx.arc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI)
  ctx.lineTo(x, y + radius)
  ctx.arc(x + radius, y + radius, radius, Math.PI, (Math.PI * 3) / 2)
  ctx.closePath()
  ctx.setFillStyle(fillStyle)
  ctx.fill()
}

function exportCanvas(proxy: NonNullable<ReturnType<typeof getCurrentInstance>>['proxy']) {
  return new Promise<string>((resolve, reject) => {
    uni.canvasToTempFilePath(
      {
        canvasId: CANVAS_ID,
        width: CARD_WIDTH,
        height: canvasHeight.value,
        destWidth: CARD_WIDTH * 3,
        destHeight: canvasHeight.value * 3,
        success: (res) => resolve(res.tempFilePath),
        fail: reject
      },
      proxy
    )
  })
}

function saveImage(filePath: string) {
  return new Promise<void>((resolve, reject) => {
    uni.saveImageToPhotosAlbum({
      filePath,
      success: () => resolve(),
      fail: reject
    })
  })
}

function wait(duration: number) {
  return new Promise((resolve) => setTimeout(resolve, duration))
}
</script>

<template>
  <view v-if="visible" class="share-sheet">
    <view class="share-sheet__mask" @tap="$emit('close')" />
    <view class="share-sheet__panel">
      <view class="share-sheet__handle" />
      <view class="share-sheet__header">
        <view>
          <view class="share-sheet__eyebrow">SHARE CARD</view>
          <view class="share-sheet__title">生成分享卡</view>
        </view>
        <view class="share-sheet__close btn-press" @tap="$emit('close')">×</view>
      </view>

      <view v-if="loading" class="share-sheet__loading">正在生成分享预览...</view>

      <scroll-view v-else-if="preview" scroll-y class="share-sheet__body">
        <view class="share-sheet__card">
          <view class="share-sheet__card-subtitle">{{ preview.visualSubtitle || preview.subtitle }}</view>
          <view class="share-sheet__card-title">{{ preview.visualTitle || preview.title }}</view>
          <view v-if="!isActionListOnly" class="share-sheet__summary">{{ preview.summary }}</view>

          <view v-if="!isActionListOnly && preview.metrics.length" class="share-sheet__metrics">
            <view v-for="metric in preview.metrics" :key="metric.label" class="share-sheet__metric">
              <view class="share-sheet__metric-label">{{ metric.label }}</view>
              <view class="share-sheet__metric-value">{{ metric.value }}</view>
            </view>
          </view>

          <view v-if="!isActionListOnly && preview.items.length" class="share-sheet__items">
            <view v-for="item in preview.items" :key="`${item.title}-${item.description}`" class="share-sheet__item">
              <view class="share-sheet__item-title">{{ item.title }}</view>
              <view class="share-sheet__item-desc">{{ item.description }}</view>
            </view>
          </view>

          <view v-if="allRows.length" class="share-sheet__sections">
            <view class="share-sheet__section">
              <view class="share-sheet__section-title">动作列表</view>
              <view
                v-for="item in previewRows"
                :key="`${item.title}-${item.description}`"
                class="share-sheet__section-item"
              >
                <image
                  class="share-sheet__section-thumb"
                  :src="shareRowImage(item)"
                  mode="aspectFill"
                />
                <view class="share-sheet__section-body">
                  <view class="share-sheet__section-item-title">{{ item.title }}</view>
                  <view class="share-sheet__section-item-desc">{{ item.description }}</view>
                  <view v-if="item.details?.length" class="share-sheet__set-details">
                    <view
                      v-for="detail in item.details"
                      :key="`${item.title}-${detail}`"
                      class="share-sheet__set-detail"
                    >
                      {{ detail }}
                    </view>
                  </view>
                </view>
              </view>
              <view v-if="previewHiddenRowCount" class="share-sheet__section-more">
                预览仅展示前 {{ PREVIEW_MAX_ROWS }} 个动作，保存分享图会展示完整列表。
              </view>
            </view>
          </view>

          <view class="share-sheet__privacy">{{ preview.privacyNote }}</view>
        </view>
      </scroll-view>

      <view v-else class="share-sheet__loading">暂无分享预览</view>

      <view class="share-sheet__actions">
        <view
          class="share-sheet__secondary btn-press"
          @tap="savedImage ? $emit('close') : $emit('copy')"
        >
          {{ savedImage ? '关闭' : '复制摘要' }}
        </view>
        <view class="gradient-fire share-sheet__primary btn-press" @tap="saveShareImage">
          {{ savingImage ? '生成中...' : savedImage ? '再次保存' : '保存分享图' }}
        </view>
      </view>

      <canvas
        class="share-sheet__canvas"
        :canvas-id="CANVAS_ID"
        :style="{ width: `${CARD_WIDTH}px`, height: `${canvasHeight}px` }"
      />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.share-sheet {
  position: fixed;
  inset: 0;
  z-index: 9998;

  &__mask {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.52);
    backdrop-filter: blur(10rpx);
  }

  &__panel {
    position: absolute;
    left: 24rpx;
    right: 24rpx;
    bottom: calc(24rpx + env(safe-area-inset-bottom));
    max-height: 86vh;
    padding: 24rpx;
    border-radius: 36rpx;
    border: 1px solid var(--app-border);
    background: var(--app-surface-raised);
    box-shadow: var(--app-shadow-focus);
    display: flex;
    flex-direction: column;
  }

  &__handle {
    width: 72rpx;
    height: 8rpx;
    margin: 0 auto 22rpx;
    border-radius: 999rpx;
    background: var(--app-border-strong);
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
    flex-shrink: 0;
  }

  &__eyebrow {
    color: var(--app-accent);
    font-size: 20rpx;
    font-weight: 900;
    letter-spacing: 1rpx;
  }

  &__title {
    margin-top: 6rpx;
    color: var(--app-text);
    font-size: 34rpx;
    font-weight: 900;
  }

  &__close {
    width: 58rpx;
    height: 58rpx;
    border-radius: 999rpx;
    background: var(--app-bg);
    color: var(--app-text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 38rpx;
    font-weight: 700;
  }

  &__loading {
    margin-top: 20rpx;
    padding: 34rpx;
    border-radius: 28rpx;
    background: var(--app-bg);
    color: var(--app-text-secondary);
    font-size: 26rpx;
    text-align: center;
  }

  &__body {
    height: min(760rpx, 56vh);
    margin-top: 22rpx;
  }

  &__card {
    padding: 28rpx;
    border-radius: 30rpx;
    border: 1px solid rgba(255, 80, 30, 0.2);
    background:
      radial-gradient(circle at 14% 0%, rgba(255, 80, 30, 0.14), transparent 42%),
      var(--app-surface);
  }

  &__card-subtitle {
    color: var(--app-text-muted);
    font-size: 22rpx;
    font-weight: 700;
  }

  &__card-title {
    margin-top: 10rpx;
    color: var(--app-text);
    font-size: 38rpx;
    font-weight: 900;
  }

  &__summary {
    margin-top: 10rpx;
    color: var(--app-text-secondary);
    font-size: 25rpx;
    line-height: 1.5;
  }

  &__metrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12rpx;
    margin-top: 22rpx;
  }

  &__metric {
    padding: 18rpx 14rpx;
    border-radius: 22rpx;
    background: var(--app-bg);
  }

  &__metric-label {
    color: var(--app-text-muted);
    font-size: 20rpx;
  }

  &__metric-value {
    margin-top: 8rpx;
    color: var(--app-text);
    font-size: 26rpx;
    font-weight: 900;
  }

  &__items {
    display: flex;
    flex-direction: column;
    gap: 10rpx;
    margin-top: 22rpx;
  }

  &__sections {
    display: flex;
    flex-direction: column;
    gap: 14rpx;
    margin-top: 22rpx;
  }

  &__section-title {
    color: var(--app-text);
    font-size: 24rpx;
    font-weight: 900;
  }

  &__item {
    padding: 16rpx 18rpx;
    border-radius: 20rpx;
    background: var(--app-bg);
  }

  &__section-item {
    margin-top: 10rpx;
    padding: 16rpx 18rpx;
    border-radius: 20rpx;
    background: var(--app-bg);
    display: flex;
    align-items: center;
    gap: 16rpx;
  }

  &__section-thumb {
    width: 72rpx;
    height: 72rpx;
    border-radius: 18rpx;
    flex-shrink: 0;
    background: var(--app-border);
  }

  &__section-body {
    min-width: 0;
    flex: 1;
  }

  &__section-more {
    margin-top: 12rpx;
    padding: 16rpx 18rpx;
    border-radius: 20rpx;
    background: var(--app-accent-soft);
    color: var(--app-accent);
    font-size: 21rpx;
    line-height: 1.45;
    font-weight: 800;
  }

  &__set-details {
    display: flex;
    flex-wrap: wrap;
    gap: 8rpx;
    margin-top: 10rpx;
  }

  &__set-detail {
    padding: 6rpx 10rpx;
    border-radius: 999rpx;
    background: rgba(226, 232, 240, 0.72);
    color: var(--app-text-secondary);
    font-size: 20rpx;
    font-weight: 800;
    line-height: 1.2;
  }

  &__item-title {
    color: var(--app-text);
    font-size: 24rpx;
    font-weight: 900;
  }

  &__section-item-title {
    color: var(--app-text);
    font-size: 24rpx;
    font-weight: 900;
  }

  &__item-desc,
  &__section-item-desc,
  &__privacy {
    margin-top: 6rpx;
    color: var(--app-text-muted);
    font-size: 21rpx;
    line-height: 1.45;
  }

  &__actions {
    display: grid;
    grid-template-columns: 1fr 1.2fr;
    gap: 16rpx;
    margin-top: 22rpx;
    flex-shrink: 0;
  }

  &__secondary,
  &__primary {
    min-height: 88rpx;
    border-radius: 26rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 27rpx;
    font-weight: 900;
  }

  &__secondary {
    color: var(--app-text-secondary);
    background: var(--app-bg);
    border: 1px solid var(--app-border);
  }

  &__primary {
    color: #fff;
  }

  &__canvas {
    position: fixed;
    left: -9999px;
    top: -9999px;
    pointer-events: none;
  }
}
</style>
