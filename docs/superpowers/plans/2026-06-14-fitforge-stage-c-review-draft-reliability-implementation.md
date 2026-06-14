# FitForge Stage C Review and Draft Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提供可行动的周复盘和错过训练恢复流程，并将现有 6 小时草稿增强为 48 小时可靠草稿与保存失败手动重试。

**Architecture:** 周复盘聚合现有计划、训练、分析和 PR 数据；改期只作用于用户启用计划实例。草稿可靠性全部由现有单草稿 Store 承担，不新增后台同步队列、跨设备同步或冲突合并。

**Tech Stack:** uni-app、Vue 3、TypeScript、Pinia、Spring Boot、MyBatis Plus、MySQL、JUnit 5。

---

## File Map

### Frontend

- Create: `src/api/weekly-review.ts`
- Create: `src/pages/home/weekly-review.vue`
- Create: `src/components/overdue-workout-sheet/index.vue`
- Modify: `src/pages.json`
- Modify: `src/pages/home/index.vue`
- Modify: `src/pages/home/workout-calendar.vue`
- Modify: `src/pages/home/workout-summary.vue`
- Modify: `src/pages/home/workout-active.vue`
- Modify: `src/stores/workout.ts`
- Modify: `src/api/plan.ts`

### Backend

- Create: `modules/training/dto/WeeklyReviewResponse.java`
- Create: `modules/training/dto/WeeklyAttentionItemResponse.java`
- Create: `modules/training/dto/WeeklyNextActionResponse.java`
- Create: `modules/training/service/WeeklyReviewService.java`
- Create: `modules/plan/dto/ReschedulePlanDayRequest.java`
- Modify: `modules/training/controller/TrainingAnalyticsController.java`
- Modify: `modules/plan/controller/TrainingPlanController.java`
- Modify: `modules/plan/service/PlanScheduleService.java`
- Modify: `modules/plan/entity/UserTrainingPlanDayState.java`
- Modify: `src/main/resources/db/schema.sql`
- Create: `src/main/resources/db/migration/20260614_plan_day_reschedule.sql`

### Tests

- Create: `src/test/java/com/liftlog/modules/training/WeeklyReviewServiceTest.java`
- Modify: `src/test/java/com/liftlog/modules/plan/PlanScheduleServiceTest.java`
- Modify: `src/test/java/com/liftlog/schema/SchemaSmokeTest.java`

## Task 1: Build Weekly Review Aggregation

- [ ] Add weekly review response containing headline, recommendation, planned/completed counts, totals, PRs, attention items and next action.
- [ ] Reuse existing analytics and active-plan summary queries instead of duplicating raw calculations.
- [ ] Implement deterministic conclusions for complete, partial, low completion, free-training-only and no-training states.
- [ ] Add `GET /api/trainings/analytics/weekly-review?weekStart=YYYY-MM-DD`.
- [ ] Test all five states and week boundary behavior.
- [ ] Run:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=WeeklyReviewServiceTest,TrainingAnalyticsServiceTest" test
```

- [ ] Commit:

```powershell
git add src/main/java/com/liftlog/modules/training src/test/java/com/liftlog/modules/training
git commit -m "feat: add weekly training review"
```

## Task 2: Add Plan-Day Rescheduling

- [ ] Add nullable scheduled-date override to user plan-day state.
- [ ] Implement `POST /api/user/plans/active/days/{dayId}/reschedule`.
- [ ] Validate target date is within the active execution period.
- [ ] Return conflicts with existing scheduled days as explicit warnings; require confirmation to continue.
- [ ] Preserve original system plan day definition.
- [ ] Test reschedule, skip, restore and completion status interactions.
- [ ] Run:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=PlanScheduleServiceTest,SchemaSmokeTest" test
```

- [ ] Commit:

```powershell
git add src/main/java/com/liftlog/modules/plan src/main/resources/db src/test/java/com/liftlog/modules/plan src/test/java/com/liftlog/schema
git commit -m "feat: reschedule active plan days"
```

## Task 3: Build Weekly Review and Overdue Resolution UI

- [ ] Add weekly review page with conclusion, metrics, week distribution, highlights, attention items and next action.
- [ ] Change home “本周节奏” to one conclusion plus one action.
- [ ] Add overdue resolution sheet with “今天补练、移动到其他日期、跳过并继续”.
- [ ] Keep “训练日历” as a separate action.
- [ ] Link review records to existing history detail page.
- [ ] Run:

```powershell
npm run typecheck
npm run build:h5
npm run build:mp-weixin
```

- [ ] Commit:

```powershell
git add src/api/weekly-review.ts src/pages/home/weekly-review.vue src/components/overdue-workout-sheet src/pages/home/index.vue src/pages.json src/api/plan.ts
git commit -m "feat: add weekly review and overdue recovery"
```

## Task 4: Align Calendar, History and Workout Summary

- [ ] Limit calendar markers to planned, completed and attention signals.
- [ ] Keep date details as the single place for plan-day and completed-record actions.
- [ ] Add current-week progress and next action to workout summary.
- [ ] Ensure weekly review, calendar and recent history all navigate to the existing history detail page.
- [ ] Run:

```powershell
npm run typecheck
npm run build:h5
```

- [ ] Commit:

```powershell
git add src/pages/home/workout-calendar.vue src/pages/home/workout-summary.vue src/pages/home/history-detail.vue
git commit -m "refactor: align review calendar and history"
```

## Task 5: Extend Draft Lifetime and Preserve Expired Drafts

- [ ] Change `WORKOUT_DRAFT_TTL_MS` from 6 hours to 48 hours.
- [ ] Replace automatic expired-draft deletion with an `EXPIRED` state.
- [ ] Add draft age and status to the store.
- [ ] Require restore or discard before starting a second workout.
- [ ] Preserve migration support for older draft versions.
- [ ] Verify old, active and expired drafts manually.
- [ ] Run:

```powershell
npm run typecheck
npm run build:mp-weixin
```

- [ ] Commit:

```powershell
git add src/stores/workout.ts src/components/workout-draft-fab src/components/workout-draft-prompt
git commit -m "feat: strengthen workout draft recovery"
```

## Task 6: Preserve Draft on Save Failure and Add Manual Retry

- [ ] Before submission, persist the complete save payload and original `clientRequestId`.
- [ ] On `saveTraining()` failure, keep current workout state and mark draft `SAVE_FAILED`.
- [ ] Show “训练已保存在本机”, “重新提交” and “稍后处理”.
- [ ] Retry with the original payload and `clientRequestId`.
- [ ] Clear draft and call `finishWorkout()` only after successful server response.
- [ ] Do not add automatic retry, background queue, multiple pending records or conflict UI.
- [ ] Run:

```powershell
npm run typecheck
npm run build:h5
npm run build:mp-weixin
```

- [ ] Commit:

```powershell
git add src/stores/workout.ts src/pages/home/workout-active.vue src/pages/home/index.vue
git commit -m "fix: retain workout draft after save failure"
```

## Task 7: Instrument Review and Draft Reliability

- [ ] Track weekly review views and next actions.
- [ ] Track overdue resolution type.
- [ ] Track draft restore, discard, save failure, retry click and retry success.
- [ ] Ensure events do not contain workout notes or arbitrary errors; map failures to controlled categories.
- [ ] Commit:

```powershell
git add src/pages/home src/stores/workout.ts src/api/product-event.ts
git commit -m "feat: measure retention and draft recovery"
```

## Task 8: Stage C Verification

- [ ] Run:

```powershell
mvn -f fitness-server/pom.xml test
npm run verify
npm run build:h5
npm run build:app-plus
```

- [ ] Manually verify: weekly review states, overdue actions, calendar navigation, 48-hour draft, expired draft confirmation, save failure, later retry and duplicate-save protection.
- [ ] Confirm no automatic sync queue or conflict behavior was introduced.

