<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppActionSheet from '@/components/app-action-sheet/index.vue'
import AppHeader from '@/components/app-header/index.vue'
import MembershipRequiredModal from '@/components/membership-required-modal/index.vue'
import TemplateCover from '@/components/template-cover/index.vue'
import { ensureFeatureAuth } from '@/utils/auth-guard'
import { ensureMembershipFeature } from '@/utils/membership-guard'
import { routes } from '@/utils/navigation'
import { useTemplateStore } from '@/stores/template'
import { useThemeStore } from '@/stores/theme'
import type { Template } from '@/types/template'

interface ActionSheetItem {
  key: string
  label: string
  description?: string
  danger?: boolean
  primary?: boolean
}

const templateStore = useTemplateStore()
const themeStore = useThemeStore()
const editingId = ref<number | null>(null)
const editName = ref('')
const saving = ref(false)
const actionSheetVisible = ref(false)
const actionSheetTitle = ref('')
const actionSheetSubtitle = ref('')
const actionSheetItems = ref<ActionSheetItem[]>([])
const actionTarget = ref<Template | null>(null)

onShow(async () => {
  const ok = await ensureFeatureAuth('模板管理')
  if (!ok) {
    uni.switchTab({ url: routes.home })
    return
  }
  templateStore.fetchTemplates({ includeDetails: false })
})

function goBack() {
  uni.navigateBack()
}

async function createTemplate() {
  if (!(await ensureMembershipFeature('自定义模板'))) return
  uni.navigateTo({ url: routes.templateEdit })
}

function goDetail(id: number) {
  uni.navigateTo({ url: `${routes.templateDetail}?id=${id}` })
}

async function editTemplate(item: Template) {
  if (!(await ensureMembershipFeature('自定义模板'))) return
  if (item.templateType === 'SYSTEM') return
  uni.navigateTo({ url: `${routes.templateEdit}?id=${item.id}` })
}

async function startRename(item: Template) {
  if (!(await ensureMembershipFeature('自定义模板'))) return
  if (item.templateType === 'SYSTEM') return
  editingId.value = item.id
  editName.value = item.name
}

function cancelRename() {
  editingId.value = null
  editName.value = ''
}

async function saveRename() {
  if (!(await ensureMembershipFeature('自定义模板'))) return
  if (editingId.value === null || !editName.value.trim() || saving.value) return
  saving.value = true
  try {
    await templateStore.rename(editingId.value, editName.value.trim())
    cancelRename()
    uni.showToast({ title: '已重命名', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '重命名失败', icon: 'none' })
    console.error('[template] rename failed', err)
  } finally {
    saving.value = false
  }
}

async function duplicateTemplate(id: number) {
  if (!(await ensureMembershipFeature('自定义模板'))) return
  if (saving.value) return
  saving.value = true
  try {
    await templateStore.duplicate(id)
    uni.showToast({ title: '已复制到我的模板', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '复制失败', icon: 'none' })
    console.error('[template] duplicate failed', err)
  } finally {
    saving.value = false
  }
}

async function removeTemplate(id: number) {
  if (!(await ensureFeatureAuth('模板管理'))) return
  if (saving.value) return
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
    await templateStore.remove(id)
    uni.showToast({ title: '已删除', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '删除失败', icon: 'none' })
    console.error('[template] remove failed', err)
  } finally {
    saving.value = false
  }
}

function openUserTemplateActions(item: Template) {
  actionTarget.value = item
  actionSheetTitle.value = '管理我的模板'
  actionSheetSubtitle.value = item.name
  actionSheetItems.value = [
    { key: 'detail', label: '查看详情', description: '查看动作安排和目标组数' },
    { key: 'edit', label: '编辑内容', description: '调整动作、顺序和组数', primary: true },
    { key: 'rename', label: '重命名', description: '修改模板名称' },
    { key: 'duplicate', label: '复制副本', description: '复制一份新的自定义模板' },
    { key: 'delete', label: '删除模板', description: '删除后不可恢复', danger: true }
  ]
  actionSheetVisible.value = true
}

function closeActionSheet() {
  actionSheetVisible.value = false
}

function handleTemplateAction(action: ActionSheetItem) {
  const item = actionTarget.value
  closeActionSheet()
  if (!item) return
  if (action.key === 'detail') goDetail(item.id)
  if (action.key === 'edit') editTemplate(item)
  if (action.key === 'rename') startRename(item)
  if (action.key === 'duplicate') duplicateTemplate(item.id)
  if (action.key === 'delete') removeTemplate(item.id)
}
</script>

<template>
  <view class="template-manager-page operation-page" :class="themeStore.themeClass">
    <scroll-view scroll-y class="page-scroll" :class="themeStore.themeClass">
      <view class="page-shell template-manager safe-bottom" :class="themeStore.themeClass">
        <AppHeader title="模板管理" subtitle="管理自己的训练模板" show-back @back="goBack" />

        <view class="template-manager__toolbar">
          <view class="template-manager__toolbar-copy">
            <view class="template-manager__toolbar-title">
              我的模板 <text>{{ templateStore.userItems.length }}</text>
            </view>
            <view class="template-manager__toolbar-sub">用于快速开始重复训练</view>
          </view>
          <view class="template-manager__create btn-press" @tap="createTemplate">+ 新建模板</view>
        </view>

        <view class="template-manager__list">
          <view v-if="!templateStore.userItems.length" class="glass-card template-manager__empty">
            还没有自定义模板。可以点击“新建模板”创建。
          </view>

          <view
            v-for="item in templateStore.userItems"
            :key="item.id"
            class="template-manager__item"
          >
            <template v-if="editingId === item.id">
              <input v-model="editName" class="template-manager__input" focus />
              <view class="template-manager__rename-actions">
                <view
                  class="template-manager__small-btn template-manager__small-btn--primary"
                  @tap="saveRename"
                >
                  保存
                </view>
                <view class="template-manager__small-btn" @tap="cancelRename">取消</view>
              </view>
            </template>

            <template v-else>
              <view
                class="template-manager__menu btn-press"
                @tap.stop="openUserTemplateActions(item)"
              >
                ...
              </view>
              <view class="template-manager__row">
                <view class="template-manager__main" @tap="goDetail(item.id)">
                  <TemplateCover
                    :name="item.name"
                    :url="item.coverUrl"
                    :record-type="item.coverRecordType"
                  />
                  <view class="template-manager__body">
                    <view class="template-manager__name">{{ item.name }}</view>
                    <view class="template-manager__meta">
                      {{ item.exercises }} 个动作 · {{ item.duration }} min
                    </view>
                    <view class="template-manager__desc">
                      {{ item.description || '自定义训练模板，可自由调整动作和目标。' }}
                    </view>
                  </view>
                  <view class="template-manager__arrow" />
                </view>
              </view>
            </template>
          </view>
        </view>
      </view>
    </scroll-view>

    <AppActionSheet
      :class="themeStore.themeClass"
      :visible="actionSheetVisible"
      :title="actionSheetTitle"
      :subtitle="actionSheetSubtitle"
      :items="actionSheetItems"
      @close="closeActionSheet"
      @select="handleTemplateAction"
    />
  </view>
  <MembershipRequiredModal />
</template>

<style lang="scss" scoped>
.template-manager {
  &__toolbar {
    padding: 8rpx 0 24rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
  }

  &__toolbar-copy {
    min-width: 0;
    flex: 1;
  }

  &__toolbar-title {
    color: #f5f5fa;
    font-size: 30rpx;
    font-weight: 900;

    text {
      margin-left: 8rpx;
      color: #ff8d4e;
    }
  }

  &__toolbar-sub {
    margin-top: 8rpx;
    color: #828296;
    font-size: 21rpx;
  }

  &__create {
    min-width: 190rpx;
    height: 70rpx;
    padding: 0 24rpx;
    border-radius: 22rpx;
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    font-weight: 900;
  }

  &__tabs {
    margin-bottom: 22rpx;
    padding: 6rpx;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6rpx;
    border-radius: 22rpx;
    background: rgba(255, 255, 255, 0.04);
    border: 1rpx solid rgba(255, 255, 255, 0.075);
  }

  &__tab {
    min-height: 66rpx;
    border-radius: 17rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9292a5;
    font-size: 23rpx;
    font-weight: 900;

    &--active {
      color: #fff;
      background: linear-gradient(135deg, rgba(255, 80, 30, 0.92), rgba(255, 140, 40, 0.78));
      box-shadow: 0 8rpx 24rpx rgba(255, 80, 30, 0.2);
    }
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 12rpx;
  }

  &__item {
    position: relative;
    min-height: 146rpx;
    padding: 20rpx 76rpx 20rpx 20rpx;
    border-radius: 22rpx;
    background: rgba(255, 255, 255, 0.035);
    border: 1rpx solid rgba(255, 255, 255, 0.075);

    &--system {
      padding: 20rpx 166rpx 20rpx 20rpx;
    }
  }

  &__row,
  &__main {
    display: flex;
    align-items: center;
    gap: 18rpx;
  }

  &__main {
    min-height: 106rpx;
  }

  &__row {
    justify-content: space-between;
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__icon {
    width: 68rpx;
    height: 68rpx;
    border-radius: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20rpx;
    font-weight: 900;
    flex-shrink: 0;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__arrow {
    position: absolute;
    right: 28rpx;
    bottom: 26rpx;
    width: 14rpx;
    height: 14rpx;
    flex-shrink: 0;
    border-top: 3rpx solid rgba(255, 255, 255, 0.9);
    border-right: 3rpx solid rgba(255, 255, 255, 0.9);
    transform: rotate(45deg);

    &--action {
      position: static;
      width: 14rpx;
      height: 14rpx;
      margin: 0 4rpx 0 2rpx;
      padding: 8rpx;
      background-clip: content-box;
    }
  }

  &__name {
    padding-right: 76rpx;
    color: #f5f5fa;
    font-size: 27rpx;
    font-weight: 900;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta,
  &__desc {
    margin-top: 6rpx;
    color: #828296;
    font-size: 20rpx;
    line-height: 1.45;
  }

  &__desc {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__menu,
  &__small-btn {
    min-width: 72rpx;
    min-height: 56rpx;
    padding: 0 18rpx;
    border-radius: 999rpx;
    background: rgba(255, 255, 255, 0.07);
    color: #f5f5fa;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22rpx;
    font-weight: 900;
    flex-shrink: 0;

    &--primary {
      min-width: 96rpx;
      background: rgba(255, 80, 30, 0.14);
      color: #ff7a32;
      border: 1px solid rgba(255, 80, 30, 0.2);
    }
  }

  &__menu:not(&__menu--primary) {
    position: absolute;
    top: 18rpx;
    right: 18rpx;
    width: 58rpx;
    min-width: 58rpx;
    min-height: 50rpx;
    padding: 0;
    color: #ff9b58;
    font-size: 28rpx;
    letter-spacing: 2rpx;
  }

  &__item-actions {
    position: absolute;
    right: 18rpx;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 10rpx;
  }

  &__helper {
    margin-top: 8rpx;
    min-height: 98rpx;
    padding: 18rpx 22rpx;
    border-radius: 22rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
    background: rgba(255, 80, 30, 0.065);
    border: 1rpx solid rgba(255, 80, 30, 0.18);
  }

  &__helper-title {
    color: #f5f5fa;
    font-size: 23rpx;
    font-weight: 900;
  }

  &__helper-sub {
    margin-top: 6rpx;
    color: #9a8490;
    font-size: 20rpx;
  }

  &__helper-arrow {
    color: #ff8d4e;
    font-size: 38rpx;
  }

  &__rename-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
    margin-top: 22rpx;
  }

  &__small-btn--primary {
    background: linear-gradient(135deg, #ff501e, #ffa03c);
    color: #fff;
  }

  &__input {
    min-height: 78rpx;
    color: #f5f5fa;
    font-size: 30rpx;
    font-weight: 800;
    border-bottom: 1px solid rgba(255, 80, 30, 0.6);
  }

  &__empty {
    padding: 26rpx;
    border-radius: 22rpx;
    color: #828296;
    font-size: 24rpx;
    line-height: 1.6;
  }
}
</style>
