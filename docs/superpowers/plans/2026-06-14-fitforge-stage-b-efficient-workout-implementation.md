# FitForge Stage B Efficient Workout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有训练执行页中增加可选 RIR、可解释渐进建议和高频效率工具，同时保持基础记录路径简单。

**Architecture:** 训练组保存扩展 effort 与 setType；新增规则驱动的推荐服务，使用历史表现和最近 effort 生成下一次建议。计算器保留在前端本地，超级组关系只属于当前训练草稿，不改变模板和计划定义。

**Tech Stack:** uni-app、Vue 3、TypeScript、Pinia、Spring Boot、MyBatis Plus、JUnit 5。

---

## File Map

### Frontend

- Create: `src/api/progression.ts`
- Create: `src/components/effort-picker/index.vue`
- Create: `src/components/progression-recommendation/index.vue`
- Create: `src/components/plate-calculator/index.vue`
- Create: `src/components/rest-timer/index.vue`
- Modify: `src/stores/workout.ts`
- Modify: `src/pages/home/workout-active.vue`
- Modify: `src/components/exercise-picker/index.vue`
- Modify: `src/api/training.ts`

### Backend

- Create: `modules/training/dto/ExerciseProgressionRecommendationResponse.java`
- Create: `modules/training/dto/RecommendationFeedbackRequest.java`
- Create: `modules/training/service/ProgressionRecommendationService.java`
- Create: `modules/training/controller/ProgressionRecommendationController.java`
- Modify: `modules/training/dto/SaveTrainingSetRequest.java`
- Modify: `modules/training/entity/TrainingRecordSet.java`
- Modify: `modules/training/service/TrainingCommandService.java`
- Modify: `src/main/resources/db/schema.sql`
- Create: `src/main/resources/db/migration/20260614_training_effort_and_recommendation.sql`

### Tests

- Create: `src/test/java/com/liftlog/modules/training/ProgressionRecommendationServiceTest.java`
- Modify: `src/test/java/com/liftlog/modules/training/TrainingCommandServiceTest.java`
- Modify: `src/test/java/com/liftlog/schema/SchemaSmokeTest.java`

## Task 1: Persist Set Type and Effort

- [ ] Add `set_type` and nullable `effort` to training record sets.
- [ ] Accept `NORMAL`, `WARMUP`, `DROP`, `FAILURE` and the five approved effort values.
- [ ] Keep effort optional and preserve existing clients that omit it.
- [ ] Exclude warm-up sets from work-set completion and progression inputs.
- [ ] Add service tests for omitted effort, valid effort and invalid values.
- [ ] Run:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=TrainingCommandServiceTest,SchemaSmokeTest" test
```

- [ ] Commit:

```powershell
git add src/main/java/com/liftlog/modules/training src/main/resources/db src/test/java/com/liftlog/modules/training src/test/java/com/liftlog/schema
git commit -m "feat: persist workout set effort"
```

## Task 2: Implement Progression Recommendation Rules

- [ ] Implement separate rules for weighted reps, bodyweight reps and duration exercises.
- [ ] Return no recommendation when no valid history exists.
- [ ] Include recommendation ID, rule version, reason code, reason text and confidence.
- [ ] Add endpoint for recommendation lookup by exercise and endpoint for feedback.
- [ ] Test successful progression, maintain, conservative regression, insufficient data and warm-up exclusion.
- [ ] Run:

```powershell
mvn -f fitness-server/pom.xml "-Dtest=ProgressionRecommendationServiceTest,TrainingQueryServiceTest" test
```

- [ ] Commit:

```powershell
git add src/main/java/com/liftlog/modules/training src/test/java/com/liftlog/modules/training
git commit -m "feat: recommend explainable workout progression"
```

## Task 3: Extend Workout Store Without Breaking Drafts

- [ ] Bump workout draft version and migrate older drafts with default `NORMAL` set type and empty effort.
- [ ] Add recommendation map, superset group ID and configurable adjustment steps to store state.
- [ ] Add actions to apply recommendation, apply last performance, set effort and create/remove supersets.
- [ ] Ensure all new mutations call `persistDraft()`.
- [ ] Verify an existing version-3 draft restores successfully after migration.
- [ ] Run:

```powershell
npm run typecheck
npm run build:h5
```

- [ ] Commit:

```powershell
git add src/stores/workout.ts src/api/training.ts src/api/progression.ts
git commit -m "feat: extend active workout state"
```

## Task 4: Add Optional Effort Picker and Recommendation Card

- [ ] Show effort picker only after completing a work set and only when enabled or manually opened.
- [ ] Do not block the next set when the picker is ignored.
- [ ] Show recommendation reason above current work sets.
- [ ] Allow apply to unfinished sets, keep current values or adjust manually.
- [ ] Mark applied recommendations as overridden when the user changes applied values.
- [ ] Run:

```powershell
npm run typecheck
npm run build:mp-weixin
```

- [ ] Commit:

```powershell
git add src/components/effort-picker src/components/progression-recommendation src/pages/home/workout-active.vue src/stores/workout.ts
git commit -m "feat: add effort and progression workout UI"
```

## Task 5: Add Fast Recording Tools

- [ ] Add “沿用上次” for unfinished sets without overwriting explicit template targets unless confirmed.
- [ ] Support configurable quick increments for weight, reps and duration.
- [ ] Generate up to three warm-up sets from first work-set weight.
- [ ] Add local plate calculator with bar weight and available plate sizes.
- [ ] Add action replacement filtered by primary muscle and equipment.
- [ ] Preserve completed sets unless the user confirms their removal.
- [ ] Run:

```powershell
npm run typecheck
npm run build:h5
npm run build:mp-weixin
```

- [ ] Commit:

```powershell
git add src/components/plate-calculator src/components/exercise-picker src/pages/home/workout-active.vue src/stores/workout.ts
git commit -m "feat: add workout recording shortcuts"
```

## Task 6: Add Superset and Rest Timer Behavior

- [ ] Allow two or more current-workout exercises to share a superset group ID.
- [ ] Move the next primary action to the next unfinished exercise in the group.
- [ ] Start full rest timer only after the last exercise in the superset round.
- [ ] Keep timer running while navigating within the app.
- [ ] Support pause, add 30 seconds and finish now.
- [ ] Fall back to in-app feedback when vibration or notifications are unavailable.
- [ ] Run:

```powershell
npm run typecheck
npm run build:app-plus
```

- [ ] Commit:

```powershell
git add src/components/rest-timer src/pages/home/workout-active.vue src/stores/workout.ts
git commit -m "feat: add supersets and rest timer"
```

## Task 7: Instrument Recommendation Quality

- [ ] Track recommendation viewed, applied, dismissed and overridden.
- [ ] Track effort recorded, last-performance applied, warm-up generation, plate calculator use and superset creation.
- [ ] Do not include user notes, exact injury data or arbitrary text in events.
- [ ] Verify event failures do not interrupt set completion.
- [ ] Commit:

```powershell
git add src/pages/home/workout-active.vue src/api/product-event.ts src/main/java/com/liftlog/modules/training
git commit -m "feat: measure workout recommendation usage"
```

## Task 8: Stage B Verification

- [ ] Run:

```powershell
mvn -f fitness-server/pom.xml test
npm run verify
npm run build:h5
npm run build:app-plus
```

- [ ] Manually verify weighted, bodyweight and duration workouts.
- [ ] Verify old drafts migrate, warm-up sets do not affect progress, recommendation failures do not block training, and effort remains optional.

