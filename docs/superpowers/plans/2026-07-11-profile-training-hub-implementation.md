# FitForge Profile And Training Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the selected iOS-style “我的” page and replace the current “计划” Tab with a four-tab-compatible “训练” hub containing peer-level 计划、日历、历史 views and a peer-level 我的模板 entry.

**Architecture:** Keep `pages/plan/index.vue` as the tab root and use a small Pinia navigation store to carry a requested hub view across `uni.switchTab`, because tab switching cannot depend on query parameters. Extract the existing calendar/history body into reusable view components so the training tab and legacy secondary route share data behavior without duplication. Preserve all current plan API/authentication changes already present in the dirty worktree.

**Tech Stack:** uni-app, Vue 3 `<script setup>`, TypeScript strict mode, Pinia, scoped SCSS, existing theme variables.

## Global Constraints

- Preserve the existing four-item Tab Bar and rename only “计划” to “训练”.
- Training hub top-level views are exactly `plan | calendar | history`.
- “我的计划” and “我的模板” are peer-level user assets but do not share one list.
- “我的” must not expose history or template management.
- Preserve existing orange accent `#FF6418`, theme switching, auth behavior, draft behavior, and existing route constants.
- Do not add dependencies or change backend contracts.
- Preserve the user’s uncommitted changes in `src/api/plan.ts`, `src/stores/plan.ts`, `src/pages/plan/detail.vue`, and `src/pages/plan/index.vue`.

---

### Task 1: Training Hub Navigation State And Tab Label

**Files:**
- Create: `src/stores/training-hub.ts`
- Modify: `src/pages.json:343-373`
- Modify: `src/pages/home/index.vue:398-408`

**Interfaces:**
- Produces: `type TrainingHubView = 'plan' | 'calendar' | 'history'`
- Produces: `useTrainingHubStore().open(view)`, `consumeRequestedView()`, and `activeView`
- Consumes: existing `routes.planIndex` and `uni.switchTab`

- [ ] **Step 1: Capture the existing dirty-worktree boundary**

Run:

```bash
git diff -- src/api/plan.ts src/stores/plan.ts src/pages/plan/detail.vue src/pages/plan/index.vue
```

Expected: the anonymous recommended-plan access and authentication guards shown in the design-session diff remain present. Save no generated snapshot file; use this diff for comparison after each task.

- [ ] **Step 2: Add the typed training-hub navigation store**

Create `src/stores/training-hub.ts`:

```ts
import { ref } from 'vue'
import { defineStore } from 'pinia'

export type TrainingHubView = 'plan' | 'calendar' | 'history'

export const useTrainingHubStore = defineStore('training-hub', () => {
  const activeView = ref<TrainingHubView>('plan')
  const requestedView = ref<TrainingHubView | null>(null)

  function open(view: TrainingHubView) {
    requestedView.value = view
  }

  function setActiveView(view: TrainingHubView) {
    activeView.value = view
  }

  function consumeRequestedView() {
    const view = requestedView.value
    requestedView.value = null
    return view
  }

  return { activeView, open, setActiveView, consumeRequestedView }
})
```

- [ ] **Step 3: Rename the native tab and route home shortcuts through the store**

Change the second `tabBar.list` label in `src/pages.json` from `计划` to `训练`.

In `src/pages/home/index.vue`, import `useTrainingHubStore`, initialize `trainingHubStore`, and replace the two navigation functions with:

```ts
async function openTrainingHub(view: 'calendar' | 'history', authLabel: string) {
  const ok = await ensureFeatureAuth(authLabel)
  if (!ok) return
  trainingHubStore.open(view)
  uni.switchTab({ url: routes.planIndex })
}

async function goTrainingHistory() {
  await openTrainingHub('history', '训练记录')
}

async function goCalendar() {
  await openTrainingHub('calendar', '训练日历')
}
```

Keep `routes.workoutCalendar` for legacy secondary-page compatibility; add no new route.

- [ ] **Step 4: Run static checks**

Run:

```bash
npm run typecheck
```

Expected: PASS with exit code 0. If it fails because the store is not yet consumed, only unused-local errors may be resolved in this task; do not weaken TypeScript settings.

- [ ] **Step 5: Commit the navigation foundation**

```bash
git add src/stores/training-hub.ts src/pages.json src/pages/home/index.vue
git commit -m "feat: add training hub navigation"
```

---

### Task 2: Reusable Calendar And History Views

**Files:**
- Create: `src/components/training-hub/calendar-view.vue`
- Create: `src/components/training-hub/history-view.vue`
- Modify: `src/pages/home/workout-calendar.vue:1-460`

**Interfaces:**
- Produces: `calendar-view.vue` with no required props and internal month/date loading
- Produces: `history-view.vue` with no required props, internal filter/pagination, and exposed `loadMore(): void`
- Consumes: `fetchCalendarMonth`, `fetchCalendarDate`, `useTrainingStore`, and existing record/plan/template routes

- [ ] **Step 1: Extract the calendar behavior without changing its data contract**

Move the calendar-only state and functions from `workout-calendar.vue` into `calendar-view.vue`: `year`, `month`, `selectedDate`, `monthData`, `dateDetail`, `loadMonth`, `loadDate`, `changeMonth`, `selectDay`, `statusText`, and the existing detail navigation functions.

The component lifecycle must be:

```ts
onMounted(async () => {
  await loadMonth()
  await loadDate(selectedDate.value)
})
```

Copy the existing month summary, calendar grid, legend, selected-day detail template, and their scoped styles exactly before making visual changes.

- [ ] **Step 2: Extract history behavior and expose pagination**

Move history filters, `historySubtitle`, `fetchHistory`, `switchFilter`, `loadMore`, date formatting, and record-list rendering into `history-view.vue`.

Use:

```ts
onMounted(() => fetchHistory(true))
defineExpose({ loadMore })
```

The root page will call the exposed method only when the active training view is `history`.

- [ ] **Step 3: Reduce the legacy page to a compatibility wrapper**

Keep `/pages/home/workout-calendar` working for old links. Its wrapper retains `AppHeader`, back behavior, analysis action, and the existing `mode=records` query compatibility:

```vue
<CalendarView v-if="activeMode === 'calendar'" />
<HistoryView v-else ref="historyViewRef" />
```

Its existing two-way `日历 / 记录` control may remain only on this legacy secondary route; the training tab must not render that nested control.

- [ ] **Step 4: Verify extraction did not alter behavior**

Run:

```bash
npm run typecheck
npm run build:h5
```

Expected: both commands exit 0; calendar API imports exist only in `calendar-view.vue`, and history range logic exists only in `history-view.vue`.

- [ ] **Step 5: Commit the reusable views**

```bash
git add src/components/training-hub/calendar-view.vue src/components/training-hub/history-view.vue src/pages/home/workout-calendar.vue
git commit -m "refactor: extract training record views"
```

---

### Task 3: Convert Plan Tab Into The Training Hub

**Files:**
- Modify: `src/pages/plan/index.vue`
- Modify: `src/styles/tab-pages-light.scss`

**Interfaces:**
- Consumes: `useTrainingHubStore`, `CalendarView`, `HistoryView`, and `routes.templateManager`
- Produces: a tab root with `计划 / 日历 / 历史` peer views
- Preserves: all existing recommended-plan anonymous access and auth guards in the current dirty diff

- [ ] **Step 1: Add hub state consumption without overwriting existing plan changes**

Import the two extracted components and store. In `onShow`, consume a requested view before plan loading:

```ts
const trainingHubStore = useTrainingHubStore()
const hubTabs = [
  { key: 'plan' as const, label: '计划' },
  { key: 'calendar' as const, label: '日历' },
  { key: 'history' as const, label: '历史' }
]

onShow(async () => {
  const requested = trainingHubStore.consumeRequestedView()
  if (requested) trainingHubStore.setActiveView(requested)
  if (trainingHubStore.activeView !== 'plan') return

  if (!getToken()) {
    activeTab.value = 'recommended'
    activePlanSummary.value = null
    planStore.clearPersonalPlanState()
    await planStore.fetchRecommendedPlanList({ force: true })
    return
  }
  await loadAuthenticatedPlans()
})
```

Do not revert `getToken`, `fetchRecommendedPlanList`, `clearPersonalPlanState`, or any existing `ensureFeatureAuth` calls.

- [ ] **Step 2: Add the peer-level hub control**

Change the header title to `训练` and subtitle to `计划接下来怎么练，也看见每一次完成`. Immediately below it render:

```vue
<view class="training-hub__tabs">
  <view
    v-for="tab in hubTabs"
    :key="tab.key"
    class="training-hub__tab btn-press"
    :class="{ 'training-hub__tab--active': trainingHubStore.activeView === tab.key }"
    @tap="trainingHubStore.setActiveView(tab.key)"
  >
    {{ tab.label }}
  </view>
</view>
```

Wrap the existing plan content in `v-if="trainingHubStore.activeView === 'plan'"`, then render `CalendarView` and `HistoryView` as the other two mutually exclusive branches. Keep the draft FAB visible in all three branches.

- [ ] **Step 3: Add “我的模板” at the same information level as “我的计划”**

Above the existing recommended/mine plan list, add a two-entry asset group:

```vue
<view class="training-hub__asset-group">
  <view class="training-hub__asset-row btn-press" @tap="selectTab('mine')">
    <view>
      <view class="training-hub__asset-title">我的计划</view>
      <view class="training-hub__asset-subtitle">按周期推进训练安排</view>
    </view>
    <view class="training-hub__asset-value">{{ userPlanCount }} ›</view>
  </view>
  <view class="training-hub__asset-row btn-press" @tap="openMyTemplates">
    <view>
      <view class="training-hub__asset-title">我的模板</view>
      <view class="training-hub__asset-subtitle">重复使用动作组合</view>
    </view>
    <view class="training-hub__asset-value">›</view>
  </view>
</view>
```

Implement:

```ts
async function openMyTemplates() {
  if (!(await ensureFeatureAuth('我的模板'))) return
  uni.navigateTo({ url: routes.templateManager })
}
```

Do not mix template rows into `visiblePlans`.

- [ ] **Step 4: Style the hub as one iOS-style hierarchy**

Add scoped `.training-hub__tabs`, `.training-hub__tab`, `.training-hub__asset-group`, and `.training-hub__asset-row` rules. Use `var(--app-bg)`, `var(--app-surface)`, `var(--app-border)`, `var(--app-text)`, and `var(--app-accent)`; use separators and no new shadows.

Extend `tab-pages-light.scss` only for selectors that require light-theme overrides. Do not hardcode a white-only solution.

- [ ] **Step 5: Verify the dirty diff is preserved**

Run:

```bash
git diff HEAD~1 -- src/pages/plan/index.vue src/api/plan.ts src/stores/plan.ts src/pages/plan/detail.vue
npm run typecheck
```

Expected: the user’s anonymous recommended-plan and authentication changes are still visible, the new hub code is additive, and typecheck exits 0.

- [ ] **Step 6: Commit the training hub**

```bash
git add src/pages/plan/index.vue src/styles/tab-pages-light.scss
git commit -m "feat: turn plans into training hub"
```

---

### Task 4: Rebuild The Profile Tab From Selected Direction 1

**Files:**
- Modify: `src/pages/profile/index.vue`
- Modify: `src/styles/tab-pages-light.scss`

**Interfaces:**
- Consumes: existing profile/training-level stores and routes
- Produces: grouped sections containing only personal, health, account, and service destinations
- Preserves: level detail sheet, logout, draft FAB, auth flow, and data loading

- [ ] **Step 1: Replace Emoji-backed menu configuration**

Replace `quickItems` and `serviceItems` with two semantic arrays:

```ts
const healthItems = [
  { label: '个人资料', sub: '个人信息与训练方向', path: routes.profileEdit, icon: 'person' },
  { label: '身体指标', sub: '体脂、围度和心率记录', path: routes.profileBodyMetrics, icon: 'metrics' }
]

const accountItems = [
  { label: '会员中心', sub: '查看试用期、套餐和会员权益', path: routes.membership, icon: 'membership' },
  { label: '我的收藏', sub: '常用动作收藏', path: routes.favorites, icon: 'favorite' },
  { label: '设置', sub: '单位、休息与应用偏好', path: routes.settings, icon: 'settings' },
  { label: '关于', sub: '版本信息与相关协议', path: routes.about, icon: 'about' }
]
```

Delete `getToneBg`, history/template entries, tone properties, and Emoji stat icons.

- [ ] **Step 2: Restructure the top into one grouped summary**

Add the page title `我的`. Make the identity row open `routes.profileEdit`. Keep the level area independently clickable for `openLevelDetail`. Render the three metrics as a border-separated row inside the same summary surface; each metric contains only value and label.

Do not change level computations, `TrainingLevelBadge`, progress percentage, or sheet behavior.

- [ ] **Step 3: Render native-style grouped rows**

Render `健康资料` and `账户与服务` section labels followed by one white grouped surface each. Every row uses the existing `openPage(item.path)`, has a minimum `88rpx` height, a subtle divider except on the final row, and an explicit chevron.

Use CSS-based masks or existing static icon files only if a coherent local icon set exists. If no coherent set exists, omit leading icons rather than using Emoji, text glyphs, handcrafted SVG, or mixed icon styles.

- [ ] **Step 4: Replace the profile layout styles**

Remove `profile__quick-grid`, colored icon tiles, nested-card shadows, gradient hero background, and per-stat rounded cards. Use:

```scss
.profile__summary,
.profile__group {
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-radius-lg);
  background: var(--app-surface);
  box-shadow: none;
  overflow: hidden;
}
```

Keep level-sheet styles intact except where selectors were shared with the removed layout.

- [ ] **Step 5: Verify behavior and formatting**

Run:

```bash
npm run format -- src/pages/profile/index.vue src/styles/tab-pages-light.scss
npm run typecheck
```

Expected: no `quickItems`, `getToneBg`, `历史记录`, `模板管理`, or Emoji stat icons remain in the profile root; typecheck exits 0.

- [ ] **Step 6: Commit the profile redesign**

```bash
git add src/pages/profile/index.vue src/styles/tab-pages-light.scss
git commit -m "feat: simplify profile tab"
```

---

### Task 5: Cross-Platform Verification And Visual QA

**Files:**
- Modify only files with defects found during verification.

**Interfaces:**
- Consumes: completed Tasks 1–4
- Produces: verified H5 and WeChat Mini Program builds

- [ ] **Step 1: Run repository verification**

Run:

```bash
npm run format:check
npm run typecheck
npm run build:h5
npm run build:mp-weixin
```

Expected: every command exits 0.

- [ ] **Step 2: Start H5 for visual inspection**

Run:

```bash
npm run dev:h5
```

Expected: Vite reports a local URL and the app renders without console errors.

- [ ] **Step 3: Inspect the selected visual target at a mobile viewport**

Using the in-app Browser, verify:

- Tab Bar reads `首页 / 训练 / 动作库 / 我的`.
- Training defaults to 计划 and switches to 日历 and 历史 without nested segmented controls.
- Home calendar and history shortcuts land on the requested training view.
- 我的 matches selected direction 1: one summary group, two list groups, no history/template entry, no Emoji, no nested cards.
- Light and dark themes have readable contrast.
- 390px and 320px widths have no clipping, overlap, or Tab Bar obstruction.

- [ ] **Step 4: Compare against the selected generated reference**

Use the selected generated image:

```text
/Users/zengyang/.codex/generated_images/019f4f22-031d-7052-b0d2-8555e316d990/exec-c47cb5c1-a160-4705-bcf9-46d85d21b32a.png
```

Compare spacing, hierarchy, grouped surfaces, typography, and accent usage. Preserve product functionality over any inaccurate generated text or icon detail.

- [ ] **Step 5: Confirm unrelated user changes remain intact**

Run:

```bash
git status --short
git diff a9d5e30..HEAD -- src/api/plan.ts src/stores/plan.ts src/pages/plan/detail.vue src/pages/plan/index.vue
```

Expected: no unrelated file is reverted or overwritten, and all pre-existing anonymous-access/auth changes remain represented.

- [ ] **Step 6: Commit verification fixes if needed**

If visual or build fixes were required:

```bash
git add src/pages.json src/pages/home/index.vue src/pages/home/workout-calendar.vue src/pages/plan/index.vue src/pages/profile/index.vue src/stores/training-hub.ts src/components/training-hub/calendar-view.vue src/components/training-hub/history-view.vue src/styles/tab-pages-light.scss
git commit -m "fix: polish training hub responsive layout"
```

If no fixes were required, do not create an empty commit.
