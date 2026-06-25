# FitForge D3 Share Experience Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade D3 sharing from a text-copy MVP into a clearer share-card experience with honest save-image semantics, training-record detail entry, and plan-day share preview.

**Architecture:** Backend remains the owner of share preview aggregation and privacy filtering. Frontend renders backend-safe preview data in the existing iOS-light Product Design direction and treats image saving as an explicit capability with a clear fallback toast until real canvas/image export is implemented. No public links, share tokens, anonymous routes, or shared-plan copy flows are introduced.

**Tech Stack:** Spring Boot 3, Java 17, JUnit 5/Mockito, uni-app Vue 3, Pinia, TypeScript, SCSS.

---

## Product Design Constraints

- Keep the current young, clean, iOS-light FitForge visual language.
- Reuse the current `ShareCardSheet` bottom sheet pattern.
- Use clear button semantics:
  - `复制摘要` copies safe backend text.
  - `保存分享图` does not copy text. Until image export exists, it shows an explicit fallback toast.
- Do not introduce a public link flow.
- Do not expose exact weights, total volume, notes, body metrics, or private execution progress unless a future backend contract explicitly allows it.

## File Structure

### Backend

- Modify: `fitness-server/src/main/java/com/liftlog/modules/share/dto/SharePreviewResponse.java`
  - Add optional visual fields for share-card/long-image rendering.
- Create: `fitness-server/src/main/java/com/liftlog/modules/share/dto/ShareSectionResponse.java`
  - Grouped visual section used for plan-day action rows.
- Create: `fitness-server/src/main/java/com/liftlog/modules/share/dto/ShareSectionItemResponse.java`
  - One row inside a visual share section.
- Modify: `fitness-server/src/main/java/com/liftlog/modules/share/service/SharePreviewService.java`
  - Add `planDayPreview(Long userId, Long planId, Long dayId)`.
  - Inject `TemplateQueryService` to read the training-day template actions.
- Modify: `fitness-server/src/main/java/com/liftlog/modules/share/controller/SharePreviewController.java`
  - Add `GET /api/share/preview/plans/{planId}/days/{dayId}`.
- Modify: `fitness-server/src/test/java/com/liftlog/modules/share/SharePreviewServiceTest.java`
  - Add plan-day share preview tests.

### Frontend

- Modify: `fitness-front/src/api/share.ts`
  - Add `ShareSectionResponse`, `ShareSectionItemResponse`, and `fetchPlanDaySharePreview`.
- Modify: `fitness-front/src/components/share-card-sheet/index.vue`
  - Render `sections`.
  - Change primary button copy to `保存分享图`.
  - Emit `save-image`.
- Modify: `fitness-front/src/pages/home/workout-summary.vue`
  - Rename handler from `shareText` to `saveShareImageFallback`.
- Modify: `fitness-front/src/pages/home/weekly-review.vue`
  - Same fallback behavior.
- Modify: `fitness-front/src/pages/plan/detail.vue`
  - Add plan-day share action to action sheet.
  - Fetch plan-day share preview and open share sheet.
  - Use fallback image-save behavior.
- Modify: `fitness-front/src/pages/home/history-detail.vue`
  - Add training record share entry.
  - Fetch workout share preview and open share sheet.

---

## Task 1: Backend Plan-Day Share Preview Contract

**Files:**
- Modify: `fitness-server/src/test/java/com/liftlog/modules/share/SharePreviewServiceTest.java`
- Create: `fitness-server/src/main/java/com/liftlog/modules/share/dto/ShareSectionResponse.java`
- Create: `fitness-server/src/main/java/com/liftlog/modules/share/dto/ShareSectionItemResponse.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/share/dto/SharePreviewResponse.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/share/service/SharePreviewService.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/share/controller/SharePreviewController.java`

- [ ] **Step 1: Add failing tests for plan-day share preview**

Append these imports to `SharePreviewServiceTest`:

```java
import com.liftlog.modules.template.dto.TemplateDetailResponse;
import com.liftlog.modules.template.dto.TemplateItemResponse;
import com.liftlog.modules.template.service.TemplateQueryService;
```

Add a `TemplateQueryService templateQueryService;` field.

Change setup to:

```java
templateQueryService = mock(TemplateQueryService.class);
service = new SharePreviewService(trainingQueryService, weeklyReviewService, trainingPlanService, templateQueryService);
```

Add this test:

```java
@Test
void shouldBuildPlanDayPreviewWithSafeActionRows() {
    when(trainingPlanService.detail(7L, 200L)).thenReturn(new TrainingPlanDetailResponse(
        200L,
        "新手全身 4 周计划",
        "SYSTEM",
        "健康",
        "入门",
        4,
        false,
        List.of(
            new TrainingPlanDayResponse(1L, 1, 1, "全身基础 A", 10L, "A", 1, false, null, null),
            new TrainingPlanDayResponse(2L, 1, 3, "器械全身 B", 11L, "B", 2, false, null, null)
        )
    ));
    when(templateQueryService.detail(7L, 10L)).thenReturn(new TemplateDetailResponse(
        10L,
        "A",
        "SYSTEM",
        "template",
        null,
        null,
        null,
        List.of(
            new TemplateItemResponse(101L, "俯卧撑", 1, 3, null, 12, null, null, 12, null,
                "BODYWEIGHT_REPS", "自重", null, null, null),
            new TemplateItemResponse(102L, "平板支撑", 2, 2, null, null, 45, null, null, 45,
                "DURATION", "自重", null, null, null)
        )
    ));

    SharePreviewResponse response = service.planDayPreview(7L, 200L, 1L);

    assertEquals("PLAN_DAY_PREVIEW", response.type());
    assertEquals("全身基础 A", response.title());
    assertEquals("第 1 周 · 周一", response.subtitle());
    assertEquals("2 个动作", response.metrics().get(1).value());
    assertEquals("动作安排", response.sections().get(0).title());
    assertEquals("俯卧撑", response.sections().get(0).items().get(0).title());
    assertEquals("自重次数 · 3 组 × 12 次", response.sections().get(0).items().get(0).description());
    assertFalse(response.copyText().contains("20.0 kg"));
}
```

Add this test:

```java
@Test
void shouldRejectPlanDayThatDoesNotBelongToPlanPreview() {
    when(trainingPlanService.detail(7L, 200L)).thenReturn(new TrainingPlanDetailResponse(
        200L,
        "新手全身 4 周计划",
        "SYSTEM",
        "健康",
        "入门",
        4,
        false,
        List.of(new TrainingPlanDayResponse(1L, 1, 1, "全身基础 A", 10L, "A", 1, false, null, null))
    ));

    assertThrows(BizException.class, () -> service.planDayPreview(7L, 200L, 999L));
}
```

Also import:

```java
import com.liftlog.common.exception.BizException;
import static org.junit.jupiter.api.Assertions.assertThrows;
```

- [ ] **Step 2: Run the failing backend test**

Run:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=SharePreviewServiceTest" test
```

Expected: compile failure because `ShareSectionResponse`, `ShareSectionItemResponse`, `sections()`, and `planDayPreview` do not exist.

- [ ] **Step 3: Create share section DTOs**

Create `fitness-server/src/main/java/com/liftlog/modules/share/dto/ShareSectionItemResponse.java`:

```java
package com.liftlog.modules.share.dto;

public record ShareSectionItemResponse(
    String title,
    String description
) {
}
```

Create `fitness-server/src/main/java/com/liftlog/modules/share/dto/ShareSectionResponse.java`:

```java
package com.liftlog.modules.share.dto;

import java.util.List;

public record ShareSectionResponse(
    String title,
    List<ShareSectionItemResponse> items
) {
}
```

- [ ] **Step 4: Extend `SharePreviewResponse`**

Change `fitness-server/src/main/java/com/liftlog/modules/share/dto/SharePreviewResponse.java` to:

```java
package com.liftlog.modules.share.dto;

import java.util.List;

public record SharePreviewResponse(
    String type,
    String title,
    String subtitle,
    String summary,
    List<ShareMetricResponse> metrics,
    List<ShareItemResponse> items,
    String privacyNote,
    String copyText,
    String visualTitle,
    String visualSubtitle,
    List<ShareSectionResponse> sections
) {
    public SharePreviewResponse(
        String type,
        String title,
        String subtitle,
        String summary,
        List<ShareMetricResponse> metrics,
        List<ShareItemResponse> items,
        String privacyNote,
        String copyText
    ) {
        this(type, title, subtitle, summary, metrics, items, privacyNote, copyText, title, subtitle, List.of());
    }
}
```

- [ ] **Step 5: Implement `planDayPreview`**

Update `SharePreviewService` imports:

```java
import com.liftlog.common.api.ApiCode;
import com.liftlog.common.exception.BizException;
import com.liftlog.modules.share.dto.ShareSectionItemResponse;
import com.liftlog.modules.share.dto.ShareSectionResponse;
import com.liftlog.modules.template.dto.TemplateDetailResponse;
import com.liftlog.modules.template.dto.TemplateItemResponse;
import com.liftlog.modules.template.service.TemplateQueryService;
```

Add field and constructor parameter:

```java
private final TemplateQueryService templateQueryService;

public SharePreviewService(TrainingQueryService trainingQueryService,
                           WeeklyReviewService weeklyReviewService,
                           TrainingPlanService trainingPlanService,
                           TemplateQueryService templateQueryService) {
    this.trainingQueryService = trainingQueryService;
    this.weeklyReviewService = weeklyReviewService;
    this.trainingPlanService = trainingPlanService;
    this.templateQueryService = templateQueryService;
}
```

Add method:

```java
public SharePreviewResponse planDayPreview(Long userId, Long planId, Long dayId) {
    TrainingPlanDetailResponse plan = trainingPlanService.detail(userId, planId);
    TrainingPlanDayResponse day = (plan.days() == null ? List.<TrainingPlanDayResponse>of() : plan.days()).stream()
        .filter(item -> item.id().equals(dayId))
        .findFirst()
        .orElseThrow(() -> new BizException(ApiCode.NOT_FOUND.code(), "plan day not found"));
    TemplateDetailResponse template = templateQueryService.detail(userId, day.templateId());
    List<TemplateItemResponse> templateItems = template.items() == null ? List.of() : template.items();
    List<ShareSectionItemResponse> actionRows = templateItems.stream()
        .sorted((left, right) -> safeInt(left.sortOrder()) - safeInt(right.sortOrder()))
        .map(item -> new ShareSectionItemResponse(
            displayText(item.exerciseName(), "训练动作"),
            actionDescription(item)
        ))
        .toList();
    List<ShareMetricResponse> metrics = List.of(
        new ShareMetricResponse("周期", "第 " + safeInt(day.weekIndex()) + " 周"),
        new ShareMetricResponse("动作", actionRows.size() + " 个"),
        new ShareMetricResponse("训练日", weekday(day.dayOfWeek()))
    );
    String subtitle = "第 " + safeInt(day.weekIndex()) + " 周 · " + weekday(day.dayOfWeek());
    String summary = displayText(plan.name(), "训练计划") + " · " + actionRows.size() + " 个动作";
    List<ShareSectionResponse> sections = List.of(new ShareSectionResponse("动作安排", actionRows));
    return new SharePreviewResponse(
        "PLAN_DAY_PREVIEW",
        displayText(day.title(), "训练日"),
        subtitle,
        summary,
        metrics,
        List.of(),
        "训练日预览只展示动作安排，不包含个人训练记录。",
        copyText(displayText(day.title(), "训练日"), summary, metrics),
        displayText(day.title(), "训练日"),
        subtitle,
        sections
    );
}
```

Add helper methods:

```java
private String actionDescription(TemplateItemResponse item) {
    String type = recordTypeLabel(item.recordType());
    int sets = safeInt(item.targetSets());
    if ("DURATION".equalsIgnoreCase(item.recordType())) {
        return type + " · " + sets + " 组 × " + safeInt(item.effectiveTargetDurationSeconds() == null
            ? item.targetDurationSeconds()
            : item.effectiveTargetDurationSeconds()) + " 秒";
    }
    Integer reps = item.effectiveTargetReps() == null ? item.targetReps() : item.effectiveTargetReps();
    return type + " · " + sets + " 组 × " + safeInt(reps) + " 次";
}

private String recordTypeLabel(String recordType) {
    if ("DURATION".equalsIgnoreCase(recordType)) {
        return "计时";
    }
    if ("BODYWEIGHT_REPS".equalsIgnoreCase(recordType)) {
        return "自重次数";
    }
    return "重量次数";
}
```

- [ ] **Step 6: Add controller endpoint**

Add to `SharePreviewController`:

```java
@GetMapping("/plans/{planId}/days/{dayId}")
public ApiResponse<SharePreviewResponse> planDay(@PathVariable Long planId, @PathVariable Long dayId) {
    return ApiResponse.success(sharePreviewService.planDayPreview(currentUserId(), planId, dayId));
}
```

- [ ] **Step 7: Run share preview tests**

Run:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=SharePreviewServiceTest" test
```

Expected: all `SharePreviewServiceTest` tests pass.

---

## Task 2: Frontend Share API And Sheet Semantics

**Files:**
- Modify: `fitness-front/src/api/share.ts`
- Modify: `fitness-front/src/components/share-card-sheet/index.vue`
- Modify: `fitness-front/src/pages/home/workout-summary.vue`
- Modify: `fitness-front/src/pages/home/weekly-review.vue`
- Modify: `fitness-front/src/pages/plan/detail.vue`

- [ ] **Step 1: Extend frontend share types**

Update `fitness-front/src/api/share.ts`:

```ts
export interface ShareSectionItemResponse {
  title: string
  description: string
}

export interface ShareSectionResponse {
  title: string
  items: ShareSectionItemResponse[]
}

export interface SharePreviewResponse {
  type: string
  title: string
  subtitle: string
  summary: string
  metrics: ShareMetricResponse[]
  items: ShareItemResponse[]
  privacyNote: string
  copyText: string
  visualTitle?: string
  visualSubtitle?: string
  sections?: ShareSectionResponse[]
}
```

Add:

```ts
export function fetchPlanDaySharePreview(planId: number | string, dayId: number | string) {
  return request<SharePreviewResponse>({
    url: `/api/share/preview/plans/${planId}/days/${dayId}`
  })
}
```

- [ ] **Step 2: Update `ShareCardSheet` emits and sections rendering**

In `fitness-front/src/components/share-card-sheet/index.vue`, change emits to:

```ts
defineEmits<{
  close: []
  copy: []
  saveImage: []
}>()
```

Change title rendering inside card:

```vue
<view class="share-sheet__card-subtitle">{{ preview.visualSubtitle || preview.subtitle }}</view>
<view class="share-sheet__card-title">{{ preview.visualTitle || preview.title }}</view>
```

After `preview.items` block, add:

```vue
<view v-if="preview.sections?.length" class="share-sheet__sections">
  <view v-for="section in preview.sections" :key="section.title" class="share-sheet__section">
    <view class="share-sheet__section-title">{{ section.title }}</view>
    <view
      v-for="item in section.items"
      :key="`${section.title}-${item.title}-${item.description}`"
      class="share-sheet__section-item"
    >
      <view class="share-sheet__section-item-title">{{ item.title }}</view>
      <view class="share-sheet__section-item-desc">{{ item.description }}</view>
    </view>
  </view>
</view>
```

Change primary action:

```vue
<view class="gradient-fire share-sheet__primary btn-press" @tap="$emit('saveImage')">
  保存分享图
</view>
```

Add styles:

```scss
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

&__section-item {
  margin-top: 10rpx;
  padding: 16rpx 18rpx;
  border-radius: 20rpx;
  background: var(--app-bg);
}

&__section-item-title {
  color: var(--app-text);
  font-size: 24rpx;
  font-weight: 900;
}

&__section-item-desc {
  margin-top: 6rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
  line-height: 1.45;
}
```

- [ ] **Step 3: Replace old `@share` listeners**

In `workout-summary.vue`, `weekly-review.vue`, and `plan/detail.vue`, replace:

```vue
@share="shareText"
```

with:

```vue
@save-image="saveShareImageFallback"
```

Rename each `shareText()` function to:

```ts
function saveShareImageFallback() {
  uni.showToast({ title: '分享图保存能力开发中，可先复制摘要', icon: 'none' })
}
```

Keep `copyShareText()` unchanged.

- [ ] **Step 4: Run frontend typecheck**

Run:

```powershell
npm run typecheck
```

Expected: no TypeScript errors.

---

## Task 3: Training Record Detail Share Entry

**Files:**
- Modify: `fitness-front/src/pages/home/history-detail.vue`

- [ ] **Step 1: Add imports and share state**

Add imports:

```ts
import ShareCardSheet from '@/components/share-card-sheet/index.vue'
import { fetchWorkoutSharePreview, type SharePreviewResponse } from '@/api/share'
```

Add refs after `loading`:

```ts
const shareVisible = ref(false)
const shareLoading = ref(false)
const sharePreview = ref<SharePreviewResponse | null>(null)
```

- [ ] **Step 2: Add share functions**

Add after `goBack()`:

```ts
async function openShareCard() {
  if (!trainingId.value) {
    uni.showToast({ title: '训练记录不存在', icon: 'none' })
    return
  }
  shareVisible.value = true
  shareLoading.value = true
  try {
    sharePreview.value = await fetchWorkoutSharePreview(trainingId.value)
  } catch (err) {
    shareVisible.value = false
    uni.showToast({ title: '分享预览生成失败', icon: 'none' })
    console.error('[share] workout detail preview failed', err)
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

function saveShareImageFallback() {
  uni.showToast({ title: '分享图保存能力开发中，可先复制摘要', icon: 'none' })
}
```

- [ ] **Step 3: Add share button below `AppHeader`**

After `AppHeader`, add:

```vue
<view v-if="detail" class="history-detail__share-row">
  <view class="history-detail__share btn-press" @tap="openShareCard">分享训练</view>
</view>
```

- [ ] **Step 4: Mount share sheet**

Before `</template>`, after `</scroll-view>`, add:

```vue
<ShareCardSheet
  :visible="shareVisible"
  :preview="sharePreview"
  :loading="shareLoading"
  @close="closeShareCard"
  @copy="copyShareText"
  @save-image="saveShareImageFallback"
/>
```

- [ ] **Step 5: Add styles**

Add to `.history-detail` styles:

```scss
&__share-row {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 18rpx;
}

&__share {
  min-height: 58rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: var(--app-accent-soft);
  color: var(--app-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 23rpx;
  font-weight: 900;
}
```

- [ ] **Step 6: Run frontend typecheck**

Run:

```powershell
npm run typecheck
```

Expected: no TypeScript errors.

---

## Task 4: Plan-Day Share Entry

**Files:**
- Modify: `fitness-front/src/pages/plan/detail.vue`

- [ ] **Step 1: Import plan-day share API**

Change the existing share import:

```ts
import { fetchPlanDaySharePreview, fetchPlanSharePreview, type SharePreviewResponse } from '@/api/share'
```

- [ ] **Step 2: Add plan-day share action to action sheet**

In `openDayActions(day)`, add this action as a non-danger secondary action whenever a day menu is opened:

For the completed branch, add after `open-record`:

```ts
{
  key: 'share-day',
  label: '分享训练日',
  description: '生成这个训练日的动作安排分享图。'
}
```

For the active startable branch, add after `start-day`:

```ts
{
  key: 'share-day',
  label: '分享训练日',
  description: '生成这个训练日的动作安排分享图。'
}
```

For the editable branch, add after `edit-day`:

```ts
{
  key: 'share-day',
  label: '分享训练日',
  description: '生成这个训练日的动作安排分享图。'
}
```

For the restore branch, add after `unskip-day`:

```ts
{
  key: 'share-day',
  label: '分享训练日',
  description: '生成这个训练日的动作安排分享图。'
}
```

- [ ] **Step 3: Add plan-day share handler**

Add before `handleSheetSelect`:

```ts
async function openPlanDayShareCard(day: TrainingPlanDayResponse) {
  if (!detail.value) return
  shareVisible.value = true
  shareLoading.value = true
  try {
    sharePreview.value = await fetchPlanDaySharePreview(detail.value.id, day.id)
  } catch (err) {
    shareVisible.value = false
    uni.showToast({ title: '分享预览生成失败', icon: 'none' })
    console.error('[share] plan day preview failed', err)
  } finally {
    shareLoading.value = false
  }
}
```

- [ ] **Step 4: Wire action selection**

In `handleSheetSelect(item)`, after `if (!day) return`, add:

```ts
if (item.key === 'share-day') {
  await openPlanDayShareCard(day)
  return
}
```

- [ ] **Step 5: Update share sheet listener**

Change plan detail `ShareCardSheet`:

```vue
@save-image="saveShareImageFallback"
```

and ensure the page has:

```ts
function saveShareImageFallback() {
  uni.showToast({ title: '分享图保存能力开发中，可先复制摘要', icon: 'none' })
}
```

- [ ] **Step 6: Run frontend typecheck**

Run:

```powershell
npm run typecheck
```

Expected: no TypeScript errors.

---

## Task 5: Final Verification

**Files:**
- All files changed in Tasks 1-4.

- [ ] **Step 1: Run backend focused tests**

Run:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=SharePreviewServiceTest" test
```

Expected: all share preview tests pass.

- [ ] **Step 2: Run backend related tests**

Run:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=TrainingPlanServiceTest,TrainingQueryServiceTest" test
```

Expected: plan and training detail tests pass.

- [ ] **Step 3: Run frontend checks**

Run:

```powershell
npm run typecheck
npm run build:mp-weixin
```

Expected: typecheck passes; mp-weixin build completes. Existing Sass deprecation warnings are acceptable if build succeeds.

- [ ] **Step 4: Confirm no public share system was added**

Run:

```powershell
rg -n "share_token|ShareToken|shared-preview|public share|revoke|expires_at|anonymous" fitness-server/src fitness-front/src
```

Expected: no new public share implementation. Existing unrelated membership expiration fields may appear and should be noted as unrelated.

- [ ] **Step 5: H5 smoke check**

Run:

```powershell
npm run dev:h5
```

Open `http://localhost:5173/` if browser tooling is available. Verify:

- Training record detail has `分享训练`.
- Share sheet primary action reads `保存分享图`.
- Clicking `保存分享图` shows `分享图保存能力开发中，可先复制摘要`.
- Plan-day action sheet includes `分享训练日`.

If browser tooling is unavailable, verify the dev server returns `200`:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:5173/ | Select-Object -ExpandProperty StatusCode
```

Expected: `200`.
