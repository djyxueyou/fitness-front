<script setup lang="ts">
import { ref } from 'vue'
import AppActionSheet from '@/components/app-action-sheet/index.vue'
import ExerciseThumbnail from '@/components/exercise-thumbnail/index.vue'
import type { Exercise } from '@/types/exercise'

interface ActionSheetItem {
  key: string
  label: string
  description?: string
  danger?: boolean
  primary?: boolean
}

const props = defineProps<{
  exercise: Exercise
  customActions?: boolean
}>()

const actionSheetVisible = ref(false)

const customActionItems: ActionSheetItem[] = [
  {
    key: 'rename',
    label: '重命名',
    description: '修改动作名称和记录类型',
    primary: true
  },
  {
    key: 'delete',
    label: '删除动作',
    description: '仅删除当前账号下的自定义动作',
    danger: true
  }
]

const emit = defineEmits<{
  select: [number]
  favorite: [number]
  rename: [number]
  delete: [number]
}>()

const levelColorMap: Record<string, string> = {
  初级: '#50c8ff',
  中级: '#ffa03c',
  高级: '#ff501e'
}

function openCustomActions() {
  actionSheetVisible.value = true
}

function handleCustomAction(item: ActionSheetItem) {
  actionSheetVisible.value = false
  if (item.key === 'rename') emit('rename', props.exercise.id)
  if (item.key === 'delete') emit('delete', props.exercise.id)
}
</script>

<template>
  <view class="exercise-item-wrap">
    <view class="glass-card exercise-item btn-press" @tap="emit('select', exercise.id)">
      <ExerciseThumbnail
        :name="exercise.name"
        :record-type="exercise.recordType"
        :url="exercise.thumbnailUrl"
        size="large"
      />

      <view class="exercise-item__body">
        <view class="exercise-item__top">
          <view class="exercise-item__name">{{ exercise.name }}</view>
          <view
            class="exercise-item__favorite"
            :class="{ 'exercise-item__favorite--active': exercise.favorited }"
            @tap.stop="emit('favorite', exercise.id)"
          >
            {{ exercise.favorited ? '♥' : '♡' }}
          </view>
        </view>

        <view class="exercise-item__meta">
          {{ exercise.category || '未分类' }} · {{ exercise.muscle || '未设置肌群' }} ·
          {{ exercise.equipment || '未设置器械' }}
        </view>

        <view class="exercise-item__tags">
          <view
            class="exercise-item__level"
            :style="{
              color: levelColorMap[exercise.level] || '#ffa03c',
              background: `${levelColorMap[exercise.level] || '#ffa03c'}22`
            }"
          >
            {{ exercise.level || '未设置' }}
          </view>
          <view
            v-if="customActions && exercise.exerciseType === 'USER'"
            class="exercise-item__manage btn-press"
            @tap.stop="openCustomActions"
          >
            管理
          </view>
        </view>
      </view>
    </view>

    <AppActionSheet
      :visible="actionSheetVisible"
      title="管理自定义动作"
      :subtitle="exercise.name"
      :items="customActionItems"
      @close="actionSheetVisible = false"
      @select="handleCustomAction"
    />
  </view>
</template>

<style lang="scss" scoped>
.exercise-item-wrap {
  display: block;
}

.exercise-item {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 24rpx 22rpx;

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__top {
    display: flex;
    align-items: flex-start;
    gap: 12rpx;
  }

  &__name {
    flex: 1;
    min-width: 0;
    color: #f5f5fa;
    font-size: 30rpx;
    font-weight: 900;
    line-height: 1.25;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__meta {
    margin-top: 8rpx;
    color: #8f8fa3;
    font-size: 22rpx;
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__tags {
    margin-top: 12rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10rpx;
  }

  &__favorite {
    width: 46rpx;
    height: 46rpx;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9a9aab;
    font-size: 32rpx;
    transition:
      color 0.2s ease,
      text-shadow 0.2s ease;

    &--active {
      color: #ff4d4f;
      text-shadow: 0 0 12rpx rgba(255, 77, 79, 0.5);
    }
  }

  &__level,
  &__manage {
    min-height: 44rpx;
    padding: 0 14rpx;
    border-radius: 999rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20rpx;
    font-weight: 800;
  }

  &__manage {
    color: #f5f5fa;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
}
</style>
