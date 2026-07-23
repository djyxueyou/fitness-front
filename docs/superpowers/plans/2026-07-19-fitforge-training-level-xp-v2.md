# FitForge Training Level XP V2 Implementation Plan

> 执行状态：已于 2026-07-19 落地有效训练、计划/PR 奖励、每日累计上限和训练修改/删除回滚。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace duration/streak-based XP with server-authoritative rewards for effective training, completed plan days, and PRs, capped at 26 XP per day with deletion rollback.

**Architecture:** Training save/update/delete remains the transaction boundary. `TrainingLevelService` reads persisted working-set, plan-day, and PR facts; `TrainingCommandService` invokes settlement after persistence and reversal before update/delete. XP logs keep per-training breakdown and idempotency while the daily unique constraint becomes a summed daily cap.

**Tech Stack:** Spring Boot 4, Java 17, MyBatis-Plus, MySQL, Maven, uni-app, Vue 3, TypeScript, Pinia, Vitest

## Global Constraints

- Effective training is either at least 3 completed non-warmup sets, or at least 15 minutes with at least 1 completed non-warmup set.
- Effective training grants 20 base XP.
- A verified completed plan day grants 4 XP.
- One or more PRs in the training grant 2 XP total.
- All training settlements for a user/date sum to at most 26 XP.
- Multiple trainings per day may settle until the remaining daily allowance reaches zero.
- One training record has at most one active XP log.
- Deleting a settled training removes its XP and recalculates the profile; no streak state remains.
- Existing level curve, stage names, badge names, and visual theme stay unchanged.
- Pre-launch migration may reset existing development XP profiles/logs rather than translating old duration/streak awards.
- Preserve unrelated dirty-worktree changes and update documentation/comments alongside code.

---

## File Structure

- `TrainingLevelConfig` defines V2 constants and keeps the existing curve/metadata.
- `TrainingLevelService` owns eligibility, daily cap, breakdown, idempotency, reversal, and profile recalculation.
- Training item/PR/plan-day mappers expose persisted facts; the client cannot claim a plan bonus or PR bonus.
- `TrainingCommandService` settles after create/update and reverses before update/delete.
- Settlement DTOs replace duration/streak bonuses with plan/PR bonuses.
- Frontend reward cards render the exact XP breakdown; profile/summary types contain no streak.

### Task 1: Migrate the XP schema and domain model to V2

**Files:**

- Create: `fitness-server/src/main/resources/db/migration/20260719_training_level_xp_v2.sql`
- Modify: `fitness-server/src/main/resources/db/schema.sql`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/traininglevel/config/TrainingLevelConfig.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/traininglevel/entity/TrainingLevelProfile.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/traininglevel/entity/TrainingLevelExpLog.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/traininglevel/dto/TrainingLevelProfileResponse.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/traininglevel/dto/TrainingLevelSettlementResponse.java`
- Test: `fitness-server/src/test/java/com/liftlog/modules/traininglevel/TrainingLevelConfigTest.java`
- Test: `fitness-server/src/test/java/com/liftlog/schema/SchemaSmokeTest.java`

**Interfaces:**

- Produces constants `MIN_EFFECTIVE_DURATION_SECONDS=900`, `MIN_EFFECTIVE_WORKING_SETS=3`, `BASE_EXP=20`, `PLAN_BONUS_EXP=4`, `PR_BONUS_EXP=2`, `DAILY_EXP_CAP=26`.
- Produces settlement fields `completedWorkingSets`, `baseExp`, `planBonusExp`, and `prBonusExp`.
- Removes profile streak fields and log duration/streak bonus fields.

- [ ] **Step 1: Update configuration and schema tests first**

```java
assertEquals(15 * 60, TrainingLevelConfig.MIN_EFFECTIVE_DURATION_SECONDS);
assertEquals(3, TrainingLevelConfig.MIN_EFFECTIVE_WORKING_SETS);
assertEquals(20, TrainingLevelConfig.BASE_EXP);
assertEquals(4, TrainingLevelConfig.PLAN_BONUS_EXP);
assertEquals(2, TrainingLevelConfig.PR_BONUS_EXP);
assertEquals(26, TrainingLevelConfig.DAILY_EXP_CAP);
```

Add schema assertions:

```java
assertFalse(sql.contains("current_streak_days"));
assertFalse(sql.contains("last_training_date"));
assertFalse(sql.contains("last_exp_granted_date"));
assertFalse(sql.contains("duration_bonus_exp"));
assertFalse(sql.contains("streak_bonus_exp"));
assertTrue(sql.contains("completed_working_sets"));
assertTrue(sql.contains("plan_bonus_exp"));
assertTrue(sql.contains("pr_bonus_exp"));
assertFalse(sql.contains("uk_training_level_exp_daily"));
```

- [ ] **Step 2: Run focused tests and verify they fail**

```bash
cd fitness-server
mvn -Dtest=TrainingLevelConfigTest,SchemaSmokeTest test
```

Expected: failures against old 30/60-minute and streak schema.

- [ ] **Step 3: Replace constants and DTO/entity fields**

Keep `requiredXpForNextLevel` and `metadataForLevel` byte-for-byte unless formatting requires movement. Change settlement response to:

```java
public record TrainingLevelSettlementResponse(
    Long trainingId,
    Boolean eligible,
    Boolean alreadySettled,
    Integer expGained,
    Integer completedWorkingSets,
    Integer baseExp,
    Integer planBonusExp,
    Integer prBonusExp,
    String reason,
    String message,
    Boolean upgraded,
    TrainingLevelStateResponse before,
    TrainingLevelStateResponse after
) {}
```

Remove `currentStreakDays` from profile response and remove streak/last-grant fields from `TrainingLevelProfile`. Replace log bonus fields with `completedWorkingSets`, `planBonusExp`, and `prBonusExp`.

- [ ] **Step 4: Add the pre-launch migration and align base schema**

```sql
DELETE FROM training_level_exp_log;

UPDATE user_training_level_profile
SET total_exp = 0,
    level = 1,
    stage_code = 'STARTER',
    stage_name = '起步',
    badge_code = 'BRONZE',
    badge_name = '青铜',
    current_level_exp = 0,
    next_level_exp = 40;

ALTER TABLE user_training_level_profile
    DROP COLUMN current_streak_days,
    DROP COLUMN last_training_date,
    DROP COLUMN last_exp_granted_date;

ALTER TABLE training_level_exp_log
    DROP INDEX uk_training_level_exp_daily,
    DROP COLUMN duration_bonus_exp,
    DROP COLUMN streak_bonus_exp,
    ADD COLUMN completed_working_sets INT NOT NULL DEFAULT 0 AFTER duration_seconds,
    ADD COLUMN plan_bonus_exp INT NOT NULL DEFAULT 0 AFTER base_exp,
    ADD COLUMN pr_bonus_exp INT NOT NULL DEFAULT 0 AFTER plan_bonus_exp,
    ADD KEY idx_training_level_exp_user_date (user_id, grant_date, id);
```

Mirror the result in `schema.sql`, including comments that state “daily summed cap” rather than “daily once”.

- [ ] **Step 5: Run config and schema tests**

Expected: both selected tests pass.

### Task 2: Add persisted-fact mapper queries and XP V2 service tests

**Files:**

- Modify: `fitness-server/src/main/java/com/liftlog/modules/training/mapper/TrainingRecordItemMapper.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/training/mapper/TrainingRecordPrMapper.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/traininglevel/mapper/TrainingLevelExpLogMapper.java`
- Modify: `fitness-server/src/test/java/com/liftlog/modules/traininglevel/TrainingLevelServiceTest.java`

**Interfaces:**

- Produces `sumCompletedWorkingSetsByRecordId(Long recordId)`.
- Produces `countByRecordId(Long recordId)` for PR facts.
- Produces daily XP sum, user XP sum, and delete-by-training operations.

- [ ] **Step 1: Rewrite service tests around V2 rules**

Add independent tests for:

```java
// 3 sets, short duration: eligible base XP
when(itemMapper.sumCompletedWorkingSetsByRecordId(100L)).thenReturn(3);
when(prMapper.countByRecordId(100L)).thenReturn(0L);
assertEquals(20, service.settleTraining(1L, 100L).expGained());

// 1 set, 15 minutes: eligible
record.setDurationSeconds(900);
when(itemMapper.sumCompletedWorkingSetsByRecordId(101L)).thenReturn(1);

// 2 sets under 15 minutes: ineligible
record.setDurationSeconds(899);
when(itemMapper.sumCompletedWorkingSetsByRecordId(102L)).thenReturn(2);

// valid plan day + PR: 26 XP
when(prMapper.countByRecordId(103L)).thenReturn(1L);
```

Also test multiple same-day settlements (20 then 6), cap reached returns 0, idempotent re-read, foreign training rejection, and deletion rollback/downgrade.

- [ ] **Step 2: Run the rewritten service test and verify compilation/behavior fails**

```bash
cd fitness-server
mvn -Dtest=TrainingLevelServiceTest test
```

- [ ] **Step 3: Add exact mapper queries**

```java
@Select("""
    SELECT COALESCE(SUM(completed_sets), 0)
    FROM training_record_item
    WHERE training_record_id = #{recordId}
    """)
Integer sumCompletedWorkingSetsByRecordId(Long recordId);
```

`completed_sets` is already populated from non-warmup sets by `TrainingCommandService`.

```java
@Select("SELECT COUNT(*) FROM training_record_pr WHERE training_record_id = #{recordId}")
Long countByRecordId(Long recordId);
```

Add log mapper methods:

```java
@Select("SELECT COALESCE(SUM(total_exp), 0) FROM training_level_exp_log WHERE user_id = #{userId} AND grant_date = #{grantDate}")
Integer sumTotalExpByUserIdAndGrantDate(Long userId, LocalDate grantDate);

@Select("SELECT COALESCE(SUM(total_exp), 0) FROM training_level_exp_log WHERE user_id = #{userId}")
Long sumTotalExpByUserId(Long userId);

@Delete("DELETE FROM training_level_exp_log WHERE training_id = #{trainingId}")
int deleteByTrainingId(Long trainingId);
```

Keep the unique per-training key and delete the old single-log-per-day mapper method.

### Task 3: Implement server-authoritative settlement and reversal

**Files:**

- Modify: `fitness-server/src/main/java/com/liftlog/modules/traininglevel/service/TrainingLevelService.java`
- Test: `fitness-server/src/test/java/com/liftlog/modules/traininglevel/TrainingLevelServiceTest.java`

**Interfaces:**

- Produces `settleTraining(Long userId, Long trainingId)` with V2 breakdown.
- Produces `reverseTraining(Long userId, Long trainingId)`.

- [ ] **Step 1: Implement eligibility and daily-cap calculation**

After validating record ownership, lock the profile, re-check the training log, then compute:

```java
int workingSets = nullToZero(itemMapper.sumCompletedWorkingSetsByRecordId(trainingId));
int durationSeconds = nullToZero(record.getDurationSeconds());
boolean eligible = workingSets >= TrainingLevelConfig.MIN_EFFECTIVE_WORKING_SETS
    || (durationSeconds >= TrainingLevelConfig.MIN_EFFECTIVE_DURATION_SECONDS && workingSets >= 1);
```

For eligible records, use the inherited `UserTrainingPlanExecutionDayMapper.selectById` and grant the plan bonus only when `executionDayId` resolves to a day whose `completedTrainingRecordId` equals this training ID. Set PR bonus when persisted PR count is greater than zero.

```java
int theoretical = BASE_EXP + planBonusExp + prBonusExp;
int awardedToday = nullToZero(logMapper.sumTotalExpByUserIdAndGrantDate(userId, grantDate));
int totalExp = Math.max(0, Math.min(theoretical, DAILY_EXP_CAP - awardedToday));
```

Use reason `VALID_TRAINING` when XP is granted, `INEFFECTIVE_TRAINING` when ineligible, and `DAILY_CAP_REACHED` when eligible but no allowance remains.

- [ ] **Step 2: Persist one log per eligible training even when daily cap grants zero**

Persisting the zero-XP log keeps the training idempotent. Store working sets and theoretical component values, but `totalExp` is the capped actual award. Update profile only by actual `totalExp`.

- [ ] **Step 3: Implement reversal and profile recalculation**

```java
@Transactional
public void reverseTraining(Long userId, Long trainingId) {
    TrainingLevelExpLog log = logMapper.selectByTrainingId(trainingId);
    if (log == null) return;
    if (!userId.equals(log.getUserId())) {
        throw new BizException(ApiCode.NOT_FOUND.code(), "training XP log not found");
    }
    TrainingLevelProfile profile = profileMapper.selectByUserIdForUpdate(userId);
    logMapper.deleteByTrainingId(trainingId);
    if (profile == null) return;
    long totalExp = nullToZero(logMapper.sumTotalExpByUserId(userId));
    TrainingLevelStateResponse state = stateFromTotalExp(totalExp);
    profile.setTotalExp(totalExp);
    applyState(profile, state);
    profileMapper.updateById(profile);
}
```

The early return after log deletion handles the no-profile case without attempting a null profile update.

- [ ] **Step 4: Remove all streak and duration-bonus helpers**

Delete `nextStreak`, `streakBonus`, duration-bonus branches, and profile streak initialization/mapping. Keep level curve and progress calculation.

- [ ] **Step 5: Run service tests**

```bash
cd fitness-server
mvn -Dtest=TrainingLevelServiceTest,TrainingLevelConfigTest test
```

Expected: all V2 eligibility, cap, idempotency, bonus, and reversal tests pass.

### Task 4: Make training persistence settle and reverse XP atomically

**Files:**

- Modify: `fitness-server/src/main/java/com/liftlog/modules/training/dto/SaveTrainingResponse.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/training/service/TrainingCommandService.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/training/mapper/TrainingRecordMapper.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/user/dto/UserSummaryResponse.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/user/service/UserProfileService.java`
- Test: `fitness-server/src/test/java/com/liftlog/modules/training/TrainingCommandServiceTest.java`
- Test: `fitness-server/src/test/java/com/liftlog/modules/user/UserProfileServiceTest.java`

**Interfaces:**

- Adds `TrainingLevelSettlementResponse levelSettlement` to save response.
- Create settles after sets and PRs are persisted.
- Update reverses old settlement, rewrites data, then settles again.
- Delete reverses before deleting training facts.
- User summary no longer calculates or returns a streak.

- [ ] **Step 1: Add failing command-service interaction tests**

Verify ordering with Mockito `InOrder`:

```java
inOrder.verify(trainingRecordPrMapper).insert(any());
inOrder.verify(trainingLevelService).settleTraining(userId, trainingId);
```

For update/delete, verify `reverseTraining(userId, trainingId)` runs before record data deletion. Verify the returned save response contains the settlement.

- [ ] **Step 2: Run command tests and verify missing integration fails**

```bash
cd fitness-server
mvn -Dtest=TrainingCommandServiceTest test
```

- [ ] **Step 3: Inject level service and wire transaction flow**

After create persists record, plan-day completion, items, sets, and PRs:

```java
TrainingLevelSettlementResponse settlement = trainingLevelService.settleTraining(userId, record.getId());
return toResponse(record.getId(), request, metrics, prs, settlement);
```

For idempotent client-request replay, call settle again; it returns the stored settlement. For update, reverse before changing persisted facts and settle after new facts exist. For delete, reverse before deleting PRs/sets/items/record.

- [ ] **Step 4: Remove streak calculation from user summary**

Reduce the summary record to `totalSessions`, `totalVolumeKg`, and `lastTrainingAt`. Remove `computeStreakDays` and the `selectTrainingDatesDesc` mapper query, then update `UserProfileServiceTest` to assert the three-field summary only.

- [ ] **Step 5: Run command, level, and user tests together**

```bash
cd fitness-server
mvn -Dtest=TrainingCommandServiceTest,TrainingLevelServiceTest,UserProfileServiceTest test
```

Expected: all selected tests pass and transaction interactions occur in the asserted order.

### Task 5: Update frontend XP contracts and remove streak UI

**Files:**

- Modify: `fitness-front/src/api/training-level.ts`
- Modify: `fitness-front/src/api/training.ts`
- Modify: `fitness-front/src/api/user.ts`
- Modify: `fitness-front/src/stores/profile.ts`
- Modify: `fitness-front/src/stores/workout.ts`
- Modify: `fitness-front/src/pages/profile/index.vue`
- Modify: `fitness-front/src/pages/home/history-detail.vue`
- Modify: `fitness-front/src/components/training-level-reward-card/index.vue`
- Modify: `fitness-front/src/components/training-level-upgrade-modal/index.vue`
- Modify: `fitness-front/src/utils/training-level-presentation.ts`
- Test: `fitness-front/src/utils/__tests__/training-level-presentation.test.ts`

**Interfaces:**

- Frontend settlement uses `completedWorkingSets`, `planBonusExp`, and `prBonusExp`.
- User summary and level profile contain no streak fields.

- [ ] **Step 1: Rewrite presentation tests for XP breakdown**

```ts
expect(buildXpBreakdown({ baseExp: 20, planBonusExp: 4, prBonusExp: 2 })).toEqual([
  { label: '有效训练', exp: 20 },
  { label: '完成计划', exp: 4 },
  { label: '刷新纪录', exp: 2 }
])
```

Add a test that zero-valued bonus rows are omitted and that `DAILY_CAP_REACHED` produces “今日 XP 已达上限”. Remove streak presentation assertions.

- [ ] **Step 2: Run the presentation test and verify old fields fail**

```bash
cd fitness-front
npm run test:run -- src/utils/__tests__/training-level-presentation.test.ts
```

- [ ] **Step 3: Update API/store contracts**

Replace `durationBonusExp`/`streakBonusExp` with `completedWorkingSets`/`planBonusExp`/`prBonusExp`. Remove `currentStreakDays` from training-level profile and user summary, then remove the Pinia ref, refresh/reset mapping, and exports. Add optional `levelSettlement` to `SaveTrainingResponse` and completed-summary state.

- [ ] **Step 4: Render XP detail and remove streak copy**

In the reward card, render non-zero rows from `buildXpBreakdown`. The profile level explanation must say:

```text
有效训练 +20 XP
完成当天计划 +4 XP
本次训练刷新 PR +2 XP
每日最多获得 26 XP
```

Remove “连续训练”, streak day counters, 30-minute threshold, and 60-minute bonus copy from profile, reward card, upgrade modal, and history detail.

- [ ] **Step 5: Run frontend tests and build**

```bash
cd fitness-front
npm run test:run -- src/utils/__tests__/training-level-presentation.test.ts
npm run typecheck
npm run build:mp-weixin
```

Expected: test, typecheck, and mini-program build pass.

### Task 6: Synchronize level documentation and verify the subsystem

**Files:**

- Modify: `PRODUCT.md`
- Modify: `fitness-server/README.md`
- Modify: `fitness-server/src/main/resources/db/schema.sql`

- [ ] **Step 1: Update current level rules and migration notes**

Document effective-training alternatives, `20 + 4 + 2`, the 26 daily summed cap, multiple settlements per day, idempotency, and delete rollback. Mark old duration/streak rules as superseded rather than silently leaving conflicting statements.

- [ ] **Step 2: Run stale-symbol searches**

```bash
rg -n "MIN_EFFECTIVE_DURATION_SECONDS = 30|LONG_TRAINING_SECONDS|LONG_DURATION_BONUS_EXP|currentStreakDays|streakBonusExp|连续有效训练" fitness-front/src fitness-server/src/main/java fitness-server/src/test PRODUCT.md
rg -n "current_streak_days|streak_bonus_exp" fitness-server/src/main/resources/db/schema.sql
```

Expected: no matches. Historical migrations may retain the old schema because the V2 migration removes it in sequence.

- [ ] **Step 3: Run backend level/training/schema verification**

```bash
cd fitness-server
mvn -Dtest=TrainingLevelConfigTest,TrainingLevelServiceTest,TrainingCommandServiceTest,SchemaSmokeTest test
```

Expected: zero failures.

- [ ] **Step 4: Run frontend verification**

```bash
cd fitness-front
npm run test:run -- src/utils/__tests__/training-level-presentation.test.ts
npm run typecheck
```

Expected: zero failures.

- [ ] **Step 5: Commit backend, frontend, and documentation changes narrowly**

Use separate child-repository commits with only the listed files. Update root `PRODUCT.md` even though the workspace root has no Git repository.
