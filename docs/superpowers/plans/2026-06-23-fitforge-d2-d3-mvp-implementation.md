# FitForge D2 Pro Value And D3 Share MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete D2 contextual Pro value explanation and D3 lightweight share-card MVP without building public share links or social-feed behavior.

**Architecture:** Backend owns entitlement checks, Pro value context, share-preview data aggregation, and privacy filtering. Frontend consumes backend contracts, shows current iOS-light design surfaces, and only triggers copy/share actions. D3 MVP deliberately avoids share tokens, public links, revoke/expiry management, and copied shared-plan flows.

**Tech Stack:** Spring Boot 3, Java 17, MyBatis Plus, JUnit 5/Mockito, uni-app Vue 3, Pinia, TypeScript, SCSS.

---

## Scope Boundaries

- D2 includes contextual Pro copy for advanced analytics, progression recommendations, custom plans/templates, and generic membership entry.
- D2 does not change payment provider behavior or existing membership order flow.
- D3 includes workout summary share card, weekly review share card, and plan preview share card.
- D3 uses backend share-preview endpoints only. Do not add `share_token`, public routes, anonymous access, revoke/expiry fields, or shared-plan copy.
- Weekly review page routing and homepage weekly rhythm are intentionally unchanged.

## File Structure

### Backend

- Create: `fitness-server/src/main/java/com/liftlog/modules/membership/dto/MembershipValueResponse.java`
  - Returns backend-owned Pro explanation for an entry point.
- Modify: `fitness-server/src/main/java/com/liftlog/modules/membership/controller/MembershipController.java`
  - Adds `GET /api/membership/value?entryPoint=...`.
- Modify: `fitness-server/src/main/java/com/liftlog/modules/membership/service/MembershipService.java`
  - Maps entry points to value title, description, bullets, and target membership route context.
- Test: `fitness-server/src/test/java/com/liftlog/modules/membership/MembershipServiceTest.java`
  - Verifies known entry points and fallback copy.
- Create: `fitness-server/src/main/java/com/liftlog/modules/share/dto/ShareMetricResponse.java`
  - Metric label/value for share cards.
- Create: `fitness-server/src/main/java/com/liftlog/modules/share/dto/ShareItemResponse.java`
  - Optional list item for plan days or highlights.
- Create: `fitness-server/src/main/java/com/liftlog/modules/share/dto/SharePreviewResponse.java`
  - Backend-owned share card contract.
- Create: `fitness-server/src/main/java/com/liftlog/modules/share/service/SharePreviewService.java`
  - Builds privacy-filtered share previews.
- Create: `fitness-server/src/main/java/com/liftlog/modules/share/controller/SharePreviewController.java`
  - Adds authenticated preview endpoints.
- Test: `fitness-server/src/test/java/com/liftlog/modules/share/SharePreviewServiceTest.java`
  - Verifies privacy filtering and preview content.

### Frontend

- Create: `fitness-front/src/api/share.ts`
  - Typed API for backend share previews.
- Modify: `fitness-front/src/api/membership.ts`
  - Adds `fetchMembershipValue(entryPoint)`.
- Modify: `fitness-front/src/stores/membership-prompt.ts`
  - Loads backend value explanation when opening Pro prompt.
- Create: `fitness-front/src/components/share-card-sheet/index.vue`
  - Reusable bottom sheet for share-card preview, copy summary, and platform share trigger.
- Modify: `fitness-front/src/pages/home/workout-summary.vue`
  - Adds workout share entry.
- Modify: `fitness-front/src/pages/home/weekly-review.vue`
  - Adds weekly review share entry without changing its navigation.
- Modify: `fitness-front/src/pages/plan/detail.vue`
  - Adds plan preview share entry.
- Modify: `fitness-front/src/pages/profile/membership.vue`
  - Reads `entry` query and displays backend contextual value block before static benefits.

---

## Task 1: Backend Pro Value Contract

**Files:**
- Create: `fitness-server/src/main/java/com/liftlog/modules/membership/dto/MembershipValueResponse.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/membership/service/MembershipService.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/membership/controller/MembershipController.java`
- Test: `fitness-server/src/test/java/com/liftlog/modules/membership/MembershipServiceTest.java`

- [ ] **Step 1: Write failing tests for contextual Pro explanations**

Add tests that call `membershipService.valueExplanation("advanced_analytics")` and `membershipService.valueExplanation("unknown")`.

Expected advanced analytics response:
- `entryPoint = "advanced_analytics"`
- title mentions `深度洞察`
- bullets include trend, attention, and next-step value

Expected fallback response:
- `entryPoint = "default"`
- title mentions `Pro`
- bullets are non-empty

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=MembershipServiceTest" test
```

Expected: compile/test failure because `MembershipValueResponse` and `valueExplanation` do not exist.

- [ ] **Step 3: Implement DTO and service mapping**

Create `MembershipValueResponse` as a Java record:

```java
public record MembershipValueResponse(
    String entryPoint,
    String title,
    String description,
    List<String> bullets,
    String primaryActionText
) {
}
```

Add `valueExplanation(String entryPoint)` to `MembershipService` with backend-owned mapping:
- `advanced_analytics`
- `progression_recommendation`
- `custom_plan`
- `custom_template`
- fallback `default`

- [ ] **Step 4: Add controller endpoint**

Add:

```java
@GetMapping("/value")
public ApiResponse<MembershipValueResponse> value(@RequestParam(defaultValue = "default") String entryPoint) {
    return ApiResponse.success(membershipService.valueExplanation(entryPoint));
}
```

- [ ] **Step 5: Verify backend Pro value tests pass**

Run:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=MembershipServiceTest" test
```

Expected: `MembershipServiceTest` passes.

---

## Task 2: Backend Share Preview MVP

**Files:**
- Create: `fitness-server/src/main/java/com/liftlog/modules/share/dto/ShareMetricResponse.java`
- Create: `fitness-server/src/main/java/com/liftlog/modules/share/dto/ShareItemResponse.java`
- Create: `fitness-server/src/main/java/com/liftlog/modules/share/dto/SharePreviewResponse.java`
- Create: `fitness-server/src/main/java/com/liftlog/modules/share/service/SharePreviewService.java`
- Create: `fitness-server/src/main/java/com/liftlog/modules/share/controller/SharePreviewController.java`
- Test: `fitness-server/src/test/java/com/liftlog/modules/share/SharePreviewServiceTest.java`

- [ ] **Step 1: Use the existing failing share-preview test**

`SharePreviewServiceTest` already covers:
- workout summary preview hides exact volume, weights, and notes
- weekly review preview hides volume
- plan preview exposes read-only overview and plan-day titles

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=SharePreviewServiceTest" test
```

Expected: compile failure until share DTOs and service are created.

- [ ] **Step 3: Implement share DTOs**

Create three Java records:

```java
public record ShareMetricResponse(String label, String value) {}
public record ShareItemResponse(String title, String description) {}
public record SharePreviewResponse(
    String type,
    String title,
    String subtitle,
    String summary,
    List<ShareMetricResponse> metrics,
    List<ShareItemResponse> items,
    String privacyNote,
    String copyText
) {}
```

- [ ] **Step 4: Implement `SharePreviewService`**

Methods:
- `workoutPreview(Long userId, Long trainingId)`
- `weeklyReviewPreview(Long userId, LocalDate weekStart)`
- `planPreview(Long userId, Long planId)`

Privacy rules:
- Workout and weekly previews must not expose exact weights, total volume, body metrics, notes, or limitations.
- Plan preview can expose plan name, goal, difficulty, weeks, and day titles.
- Copy text uses only returned safe fields.

- [ ] **Step 5: Implement controller endpoints**

Create `SharePreviewController` with authenticated endpoints:

```text
GET /api/share/preview/workouts/{trainingId}
GET /api/share/preview/weekly-review?weekStart=YYYY-MM-DD
GET /api/share/preview/plans/{planId}
```

Use `StpUtil.getLoginIdAsLong()` for owner context. No anonymous endpoint.

- [ ] **Step 6: Verify share service tests pass**

Run:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=SharePreviewServiceTest" test
```

Expected: tests pass.

---

## Task 3: Frontend Pro Value UI

**Files:**
- Modify: `fitness-front/src/api/membership.ts`
- Modify: `fitness-front/src/stores/membership-prompt.ts`
- Modify: `fitness-front/src/components/membership-required-modal/index.vue`
- Modify: `fitness-front/src/pages/profile/membership.vue`

- [ ] **Step 1: Add typed membership value API**

Add `MembershipValueResponse` and `fetchMembershipValue(entryPoint)`.

- [ ] **Step 2: Update membership prompt store**

`open(featureName, description?, entryPoint?)` should:
- set existing fallback immediately
- request backend value if `entryPoint` is provided
- replace modal copy with backend `title`, `description`, and `bullets`
- keep fallback if request fails

- [ ] **Step 3: Update modal UI**

Render optional bullets under description. Keep current bottom sheet visual language and CTA.

- [ ] **Step 4: Update membership page**

Read `entry` from `onLoad(options)`. Fetch backend value. Render a top `membership__value` card before static benefits.

- [ ] **Step 5: Wire known entry points**

Update existing Pro entry calls:
- advanced analytics: `advanced_analytics`
- progression recommendations: `progression_recommendation`
- custom plan: `custom_plan`
- custom template: `custom_template`

- [ ] **Step 6: Verify frontend typing**

Run:

```powershell
npm run typecheck
```

Expected: no TypeScript errors.

---

## Task 4: Frontend Share Card Sheet

**Files:**
- Create: `fitness-front/src/api/share.ts`
- Create: `fitness-front/src/components/share-card-sheet/index.vue`
- Modify: `fitness-front/src/pages/home/workout-summary.vue`
- Modify: `fitness-front/src/pages/home/weekly-review.vue`
- Modify: `fitness-front/src/pages/plan/detail.vue`

- [ ] **Step 1: Add typed share API**

Add `SharePreviewResponse`, `ShareMetricResponse`, `ShareItemResponse`, and three fetch functions.

- [ ] **Step 2: Create `ShareCardSheet` component**

Props:
- `visible`
- `preview`
- `loading`

Emits:
- `close`
- `copy`
- `share`

UI:
- bottom sheet
- card preview with title, subtitle, summary, metrics, items, privacy note
- secondary button `复制摘要`
- primary button `分享`

- [ ] **Step 3: Add workout summary share entry**

On workout summary:
- show `生成分享卡`
- fetch `/api/share/preview/workouts/{trainingId}`
- open `ShareCardSheet`
- copy `preview.copyText` via `uni.setClipboardData`

- [ ] **Step 4: Add weekly review share entry**

On weekly review:
- show `分享本周复盘`
- fetch weekly review preview
- open `ShareCardSheet`

- [ ] **Step 5: Add plan detail share entry**

On plan detail:
- show `分享计划`
- fetch plan preview
- open `ShareCardSheet`

- [ ] **Step 6: Add platform share fallback**

For MVP, the `share` action should:
- call `uni.setClipboardData({ data: preview.copyText })`
- show toast `已复制分享文案`

Do not add public links or token URLs.

- [ ] **Step 7: Verify frontend build**

Run:

```powershell
npm run typecheck
npm run build:mp-weixin
```

Expected: typecheck and mp-weixin build pass.

---

## Task 5: Final Verification

**Files:**
- All files changed in Tasks 1-4.

- [ ] **Step 1: Run focused backend tests**

Run:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=MembershipServiceTest,SharePreviewServiceTest" test
```

Expected: all focused tests pass.

- [ ] **Step 2: Run broader backend tests touched by dependencies**

Run:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=TrainingQueryServiceTest,WeeklyReviewServiceTest,TrainingPlanServiceTest" test
```

Expected: all tests pass.

- [ ] **Step 3: Run frontend checks**

Run:

```powershell
npm run typecheck
npm run build:mp-weixin
```

Expected: no TypeScript errors; mp-weixin build completes.

- [ ] **Step 4: Manual H5/mobile verification**

Run dev H5 and verify:
- advanced analytics Pro prompt shows contextual value
- membership page shows entry-context value card
- workout summary share sheet opens and copies safe text
- plan detail share sheet opens and does not expose private user data
- weekly review share sheet opens if navigated directly

- [ ] **Step 5: Confirm exclusions**

Check code search confirms no new public share system:

```powershell
rg -n "share_token|ShareToken|shared-preview|public share|revoke|expires_at" fitness-server/src fitness-front/src
```

Expected: no new production implementation of token/public-link share.

