# FitForge Free Plan, Home Rhythm, and Plan Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让免费用户可靠地拥有 1 个“我的计划”，开放首页基础本周节奏，并修复系统计划保存/停用、计划中心跳转和模板写后刷新问题。

**Architecture:** MySQL 是会员额度与计划状态的唯一事实来源；低频计划写操作通过会员快速放行、免费用户行锁和索引计数保证一致性，不引入 Redis 计数。首页新增固定当前自然周的单查询聚合接口；前端只编排导航、错误反馈和缓存，不自行裁决额度。

**Tech Stack:** Java 17、Spring Boot 4、MyBatis-Plus、MySQL、JUnit 5、Mockito、uni-app、Vue 3、TypeScript、Pinia、Vitest、SCSS

**Status:** 2026-07-20 实现及自动化验证完成，外部验收待办。后端 focused/full、前端 full tests/verify 和数据库索引验证已完成；并发 API 与六项手工 UI 场景因缺少安全可用的免费测试账号/token，待真实免费测试账号/token 外部验收。

**Verification results (2026-07-20):**

- 后端 focused：48 tests，0 failures/errors/skips；后端 full：221 tests，0 failures/errors/skips。Homebrew JDK 17 环境通过 Surefire `argLine` 加载项目解析出的 Byte Buddy agent 1.17.8。
- 前端 full tests：30 files、108 tests 全部通过；`npm run verify` 的 Prettier、TypeScript 和微信小程序构建全部通过。
- 发布验证中修正一处 Task 8 generation 重构后的陈旧源码字符串契约，测试专用提交为 `c83c0ba`；业务源码未因该集成修复改动。
- 本地 development `fitness` 库已应用 `20260720_free_plan_quota_and_home_weekly_rhythm.sql`，仅新增 `saved_from_execution_id` 与两个索引，未修改业务数据。
- `idx_training_record_user_started` 已进入周查询 `possible_keys`，强制选择时使用 `user_id + started_at` 复合 range scan；由于当前周代表用户只有 2 条记录，优化器自然选择更窄的 `idx_training_record_started_at`，生产数据量下仍需复核自然选中情况。
- 额度查询自然选择 `idx_user_plan_definition_saved` 并显示 `Using index`。
- 环境中不存在 `PLAN_TEST_TOKEN`，因此未猜测 token、未创建并发测试计划；并发 API 验收与六项真实账号 UI 手工验收保持外部待验收状态。

**Current product truth:**

- 首页“本周节奏”是免费基础反馈；周统计详情、历史周趋势、周报和高级分析属于 Pro。
- 免费用户可拥有 1 个有效“我的计划”，Pro 数量不限。
- 系统计划执行不占额度，保存为独立副本后才占额度。
- 计划额度由 MySQL 事务、用户行锁和索引计数保证，不使用 Redis 计数。
- 当前安排支持停用；首页选择计划根据“我的计划”数量进入系统或我的子页。

## Global Constraints

- 后端统一裁决会员状态、免费额度、计划来源、可编辑性、保存幂等和当前计划状态。
- 免费用户最多拥有 1 个满足 `user_id = 当前用户 AND is_saved = 1 AND status = 'ACTIVE'` 的“我的计划”；Pro 数量不限。
- 系统计划运行时定义、已归档计划和历史创建次数不占免费额度。
- 手动创建、复制和“存为我的计划”共用同一后端额度规则；删除、启用和停用始终免费。
- 同一免费用户并发创建最终最多新增 1 个有效“我的计划”。
- 不引入 Redis 额度计数、Redis 分布式锁、用户计划数量冗余字段或异步复制队列。
- 首页“本周节奏”免费；任意日期范围周统计、历史周趋势、周报和高级分析继续属于 Pro。
- 首页本周范围由 `BusinessClock` 在服务端计算，客户端不得传日期参数。
- 写接口无权限统一返回 `40311`，额度文案固定为“免费版最多可拥有 1 个我的计划，删除已有计划或开通 Pro 后可继续。”
- 用户资产不因会员到期被删除；超额免费用户可查看、启用、停用和删除，但不能新增、复制或编辑。
- 前端使用 `src/` 真实构建目录、语义化主题变量和统一 `src/api/http.ts` 请求封装。
- 前端和后端是两个独立 Git 仓库；所有提交必须使用路径限定，保留现有未提交和已暂存改动。
- 不实现产品事件漏斗、计划/周报公开分享、二维码、归因、自动会员试用或连续训练等级规则。

---

### Task 1: Add plan provenance and supporting indexes

**Files:**
- Create: `fitness-server/src/main/resources/db/migration/20260720_free_plan_quota_and_home_weekly_rhythm.sql`
- Modify: `fitness-server/src/main/resources/db/schema.sql`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/plan/entity/UserTrainingPlanDefinition.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/plan/mapper/UserTrainingPlanDefinitionMapper.java`
- Test: `fitness-server/src/test/java/com/liftlog/schema/SchemaSmokeTest.java`

**Interfaces:**
- Produces: `savedFromExecutionId` entity property.
- Produces: `countActiveSavedByUserId(Long)` and `selectActiveSavedByExecution(Long, Long)` mapper methods.
- Produces: `idx_training_record_user_started (user_id, started_at)` for Task 4.

- [ ] **Step 1: Write the failing schema assertions**

Add to `SchemaSmokeTest.schemaShouldContainCoreTables()`:

```java
assertTrue(sql.contains("saved_from_execution_id BIGINT NULL"));
assertTrue(sql.contains("UNIQUE KEY uk_user_plan_saved_execution (user_id, saved_from_execution_id)"));
assertTrue(sql.contains("KEY idx_training_record_user_started (user_id, started_at)"));
```

- [ ] **Step 2: Run the schema test and verify it fails**

Run:

```bash
cd fitness-server
mvn -Dtest=SchemaSmokeTest test
```

Expected: FAIL because the new column and indexes do not exist.

- [ ] **Step 3: Add the migration and schema definitions**

Create `20260720_free_plan_quota_and_home_weekly_rhythm.sql`:

```sql
ALTER TABLE user_training_plan_definition
    ADD COLUMN saved_from_execution_id BIGINT NULL COMMENT '生成当前已保存副本的计划执行ID' AFTER source_generation_version,
    ADD UNIQUE KEY uk_user_plan_saved_execution (user_id, saved_from_execution_id);

ALTER TABLE training_record
    ADD KEY idx_training_record_user_started (user_id, started_at);
```

Apply the same column and keys to `schema.sql`. Keep the existing `idx_user_plan_definition_saved` index; do not add another quota-count index.

- [ ] **Step 4: Map the new column and add indexed mapper queries**

Add the field and accessors to `UserTrainingPlanDefinition`:

```java
private Long savedFromExecutionId;

public Long getSavedFromExecutionId() { return savedFromExecutionId; }
public void setSavedFromExecutionId(Long savedFromExecutionId) {
    this.savedFromExecutionId = savedFromExecutionId;
}
```

Update `UserTrainingPlanDefinitionMapper`:

```java
@Select("""
    SELECT * FROM user_training_plan_definition
    WHERE user_id = #{userId}
      AND is_saved = 1
      AND status = 'ACTIVE'
    ORDER BY updated_at DESC, id DESC
    """)
List<UserTrainingPlanDefinition> selectSavedByUserId(@Param("userId") Long userId);

@Select("""
    SELECT COUNT(*) FROM user_training_plan_definition
    WHERE user_id = #{userId}
      AND is_saved = 1
      AND status = 'ACTIVE'
    """)
Long countActiveSavedByUserId(@Param("userId") Long userId);

@Select("""
    SELECT * FROM user_training_plan_definition
    WHERE user_id = #{userId}
      AND saved_from_execution_id = #{executionId}
      AND is_saved = 1
      AND status = 'ACTIVE'
    LIMIT 1
    """)
UserTrainingPlanDefinition selectActiveSavedByExecution(@Param("userId") Long userId,
                                                        @Param("executionId") Long executionId);
```

- [ ] **Step 5: Re-run the schema test**

Run `mvn -Dtest=SchemaSmokeTest test` from `fitness-server`.

Expected: PASS.

- [ ] **Step 6: Commit the database contract**

```bash
cd fitness-server
git add src/main/resources/db/migration/20260720_free_plan_quota_and_home_weekly_rhythm.sql \
  src/main/resources/db/schema.sql \
  src/main/java/com/liftlog/modules/plan/entity/UserTrainingPlanDefinition.java \
  src/main/java/com/liftlog/modules/plan/mapper/UserTrainingPlanDefinitionMapper.java \
  src/test/java/com/liftlog/schema/SchemaSmokeTest.java
git commit --only -m "feat: add saved plan provenance indexes" -- \
  src/main/resources/db/migration/20260720_free_plan_quota_and_home_weekly_rhythm.sql \
  src/main/resources/db/schema.sql \
  src/main/java/com/liftlog/modules/plan/entity/UserTrainingPlanDefinition.java \
  src/main/java/com/liftlog/modules/plan/mapper/UserTrainingPlanDefinitionMapper.java \
  src/test/java/com/liftlog/schema/SchemaSmokeTest.java
```

### Task 2: Centralize the backend free-plan quota

**Files:**
- Create: `fitness-server/src/main/java/com/liftlog/modules/plan/service/UserPlanQuotaService.java`
- Create: `fitness-server/src/test/java/com/liftlog/modules/plan/UserPlanQuotaServiceTest.java`

**Interfaces:**
- Consumes: `MembershipService.isActive(Long)`, `UserMapper.selectByIdForUpdate(Long)`, `countActiveSavedByUserId(Long)`.
- Produces: `requireCanCreate(Long)`, `lockUser(Long)`, `requireCanCreateAfterLock(Long)`, and `requireCanEdit(Long)`.

- [ ] **Step 1: Write failing quota tests**

Create `UserPlanQuotaServiceTest` with these cases:

```java
class UserPlanQuotaServiceTest {
    private MembershipService membershipService;
    private UserMapper userMapper;
    private UserTrainingPlanDefinitionMapper definitionMapper;
    private UserPlanQuotaService service;

    @BeforeEach
    void setUp() {
        membershipService = mock(MembershipService.class);
        userMapper = mock(UserMapper.class);
        definitionMapper = mock(UserTrainingPlanDefinitionMapper.class);
        service = new UserPlanQuotaService(membershipService, userMapper, definitionMapper);
    }

    @Test
    void proCreateSkipsLockAndCount() {
        when(membershipService.isActive(7L)).thenReturn(true);
        service.requireCanCreate(7L);
        verifyNoInteractions(userMapper, definitionMapper);
    }

    @Test
    void freeCreateLocksBeforeIndexedCount() {
        when(membershipService.isActive(7L)).thenReturn(false);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(new User());
        when(definitionMapper.countActiveSavedByUserId(7L)).thenReturn(0L);
        service.requireCanCreate(7L);
        InOrder order = inOrder(userMapper, definitionMapper);
        order.verify(userMapper).selectByIdForUpdate(7L);
        order.verify(definitionMapper).countActiveSavedByUserId(7L);
    }

    @Test
    void freeSecondPlanUsesUnifiedMembershipError() {
        when(membershipService.isActive(7L)).thenReturn(false);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(new User());
        when(definitionMapper.countActiveSavedByUserId(7L)).thenReturn(1L);
        BizException error = assertThrows(BizException.class, () -> service.requireCanCreate(7L));
        assertEquals(40311, error.getCode());
        assertEquals("免费版最多可拥有 1 个我的计划，删除已有计划或开通 Pro 后可继续。", error.getMessage());
    }

    @Test
    void expiredOverQuotaUserCannotEdit() {
        when(membershipService.isActive(7L)).thenReturn(false);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(new User());
        when(definitionMapper.countActiveSavedByUserId(7L)).thenReturn(2L);
        BizException error = assertThrows(BizException.class, () -> service.requireCanEdit(7L));
        assertEquals(40311, error.getCode());
    }
}
```

- [ ] **Step 2: Run the new test and verify it fails**

Run `mvn -Dtest=UserPlanQuotaServiceTest test`.

Expected: compilation failure because `UserPlanQuotaService` does not exist.

- [ ] **Step 3: Implement the quota service**

Create:

```java
@Service
public class UserPlanQuotaService {
    static final long FREE_PLAN_LIMIT = 1L;
    static final String FREE_PLAN_MESSAGE =
        "免费版最多可拥有 1 个我的计划，删除已有计划或开通 Pro 后可继续。";

    private final MembershipService membershipService;
    private final UserMapper userMapper;
    private final UserTrainingPlanDefinitionMapper definitionMapper;

    public UserPlanQuotaService(MembershipService membershipService,
                                UserMapper userMapper,
                                UserTrainingPlanDefinitionMapper definitionMapper) {
        this.membershipService = membershipService;
        this.userMapper = userMapper;
        this.definitionMapper = definitionMapper;
    }

    public void requireCanCreate(Long userId) {
        if (membershipService.isActive(userId)) return;
        lockUser(userId);
        requireFreeCreateSlot(userId);
    }

    public void lockUser(Long userId) {
        if (userMapper.selectByIdForUpdate(userId) == null) {
            throw new BizException(ApiCode.UNAUTHORIZED.code(), "user not found");
        }
    }

    public void requireCanCreateAfterLock(Long userId) {
        if (membershipService.isActive(userId)) return;
        requireFreeCreateSlot(userId);
    }

    public void requireCanEdit(Long userId) {
        if (membershipService.isActive(userId)) return;
        lockUser(userId);
        long count = nullToZero(definitionMapper.countActiveSavedByUserId(userId));
        if (count > FREE_PLAN_LIMIT) {
            throw new BizException(ApiCode.MEMBERSHIP_REQUIRED.code(),
                "当前我的计划数量超过免费额度，请删除到 1 个或开通 Pro 后编辑。");
        }
    }

    private void requireFreeCreateSlot(Long userId) {
        if (nullToZero(definitionMapper.countActiveSavedByUserId(userId)) >= FREE_PLAN_LIMIT) {
            throw new BizException(ApiCode.MEMBERSHIP_REQUIRED.code(), FREE_PLAN_MESSAGE);
        }
    }

    private long nullToZero(Long value) {
        return value == null ? 0L : value;
    }
}
```

- [ ] **Step 4: Run the quota tests**

Run `mvn -Dtest=UserPlanQuotaServiceTest test`.

Expected: PASS. Mockito verification confirms Pro does not count or lock, and free writes lock before counting.

- [ ] **Step 5: Commit the quota service**

```bash
cd fitness-server
git add src/main/java/com/liftlog/modules/plan/service/UserPlanQuotaService.java \
  src/test/java/com/liftlog/modules/plan/UserPlanQuotaServiceTest.java
git commit --only -m "feat: centralize free plan quota" -- \
  src/main/java/com/liftlog/modules/plan/service/UserPlanQuotaService.java \
  src/test/java/com/liftlog/modules/plan/UserPlanQuotaServiceTest.java
```

### Task 3: Enforce quota, idempotent save, and server-derived saved state

**Files:**
- Modify: `fitness-server/src/main/java/com/liftlog/modules/plan/service/UserPlanService.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/plan/service/PlanExecutionService.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/plan/dto/ActiveExecutionResponse.java`
- Test: `fitness-server/src/test/java/com/liftlog/modules/plan/UserPlanServiceTest.java`
- Test: `fitness-server/src/test/java/com/liftlog/modules/plan/PlanExecutionServiceTest.java`

**Interfaces:**
- Consumes: Task 1 mapper methods and Task 2 quota methods.
- Produces: `ActiveExecutionResponse.savedDefinitionId()` and idempotent `saveExecutionAsMyPlan`.

- [ ] **Step 1: Extend service tests before production changes**

Replace the mocked `MembershipService` constructor argument in `UserPlanServiceTest` with a stored `UserPlanQuotaService quotaService` mock. Add tests:

```java
@Test
void firstFreeCreateUsesQuotaService() {
    when(definitionDayMapper.selectByDefinitionId(100L)).thenReturn(List.of());
    service.create(7L, new CreateTrainingPlanRequest("我的计划", null, null, 4));
    verify(quotaService).requireCanCreate(7L);
}

@Test
void repeatedExecutionSaveReturnsExistingDefinitionWithoutCloning() {
    UserTrainingPlanExecution execution = ownedSystemExecution(500L, 7L, 10L, 1009L);
    UserTrainingPlanDefinition source = unsavedSystemDefinition(10L, 7L, 1009L);
    UserTrainingPlanDefinition existing = savedDefinition(88L, 7L, 500L);
    when(executionMapper.selectById(500L)).thenReturn(execution);
    when(definitionMapper.selectById(10L)).thenReturn(source);
    when(definitionMapper.selectActiveSavedByExecution(7L, 500L)).thenReturn(existing);
    when(definitionDayMapper.selectByDefinitionId(88L)).thenReturn(List.of());

    var detail = service.saveExecutionAsMyPlan(7L, 500L);

    assertEquals(88L, detail.id());
    verify(quotaService).lockUser(7L);
    verify(definitionMapper, never()).insert(any());
}

@Test
void deleteClearsExecutionProvenanceAndDoesNotRequireMembership() {
    UserTrainingPlanDefinition definition = savedDefinition(88L, 7L, 500L);
    when(definitionMapper.selectById(88L)).thenReturn(definition);
    service.delete(7L, 88L);
    assertEquals(0, definition.getIsSaved());
    assertEquals("ARCHIVED", definition.getStatus());
    assertNull(definition.getSavedFromExecutionId());
    verify(quotaService, never()).requireCanEdit(any());
}

private static UserTrainingPlanExecution ownedSystemExecution(Long id,
                                                               Long userId,
                                                               Long definitionId,
                                                               Long systemPlanId) {
    UserTrainingPlanExecution execution = new UserTrainingPlanExecution();
    execution.setId(id);
    execution.setUserId(userId);
    execution.setDefinitionId(definitionId);
    execution.setSourceSystemPlanId(systemPlanId);
    return execution;
}

private static UserTrainingPlanDefinition unsavedSystemDefinition(Long id,
                                                                   Long userId,
                                                                   Long systemPlanId) {
    UserTrainingPlanDefinition definition = new UserTrainingPlanDefinition();
    definition.setId(id);
    definition.setUserId(userId);
    definition.setOriginType("SYSTEM");
    definition.setIsSaved(0);
    definition.setSourceSystemPlanId(systemPlanId);
    definition.setName("系统计划");
    definition.setCycleWeeks(4);
    definition.setStatus("ACTIVE");
    return definition;
}

private static UserTrainingPlanDefinition savedDefinition(Long id,
                                                           Long userId,
                                                           Long executionId) {
    UserTrainingPlanDefinition definition = new UserTrainingPlanDefinition();
    definition.setId(id);
    definition.setUserId(userId);
    definition.setOriginType("SYSTEM_COPY");
    definition.setIsSaved(1);
    definition.setIsEditable(1);
    definition.setSavedFromExecutionId(executionId);
    definition.setName("已保存计划");
    definition.setCycleWeeks(4);
    definition.setStatus("ACTIVE");
    return definition;
}
```

Add a `PlanExecutionServiceTest` assertion that `active(7L).savedDefinitionId()` equals the ID returned by `selectActiveSavedByExecution(7L, executionId)`.

- [ ] **Step 2: Run focused plan tests and verify failure**

Run:

```bash
cd fitness-server
mvn -Dtest=UserPlanServiceTest,PlanExecutionServiceTest test
```

Expected: compilation/assertion failures for the new quota dependency and `savedDefinitionId`.

- [ ] **Step 3: Replace direct membership checks in `UserPlanService`**

Inject `UserPlanQuotaService` instead of `MembershipService`, then use:

```java
quotaService.requireCanCreate(userId); // create, copy
quotaService.requireCanEdit(userId);   // update, createDay, updateDay, deleteDay
```

Remove membership checks from `delete`. Keep `activate` and execution stop free.

- [ ] **Step 4: Make execution saving source-safe and idempotent**

Implement this order inside the existing `@Transactional saveExecutionAsMyPlan`:

```java
UserTrainingPlanExecution execution = requireOwnedExecution(userId, executionId);
UserTrainingPlanDefinition source = requireOwnedDefinition(userId, execution.getDefinitionId());
if (!"SYSTEM".equals(source.getOriginType())
    || !Integer.valueOf(0).equals(source.getIsSaved())
    || execution.getSourceSystemPlanId() == null) {
    throw new BizException(ApiCode.BAD_REQUEST.code(), "only active system plan executions can be saved");
}

quotaService.lockUser(userId);
UserTrainingPlanDefinition existing =
    definitionMapper.selectActiveSavedByExecution(userId, executionId);
if (existing != null) {
    return toDetail(existing, activeExecution(userId, existing.getId()));
}
quotaService.requireCanCreateAfterLock(userId);

UserTrainingPlanDefinition copy = copyDefinition(source, userId,
    uniqueCopyName(userId, source.getName()), "SYSTEM_COPY", 1, 1, executionId);
```

Add the ownership helpers rather than duplicating the checks:

```java
private UserTrainingPlanExecution requireOwnedExecution(Long userId, Long executionId) {
    UserTrainingPlanExecution execution = executionMapper.selectById(executionId);
    if (execution == null || !userId.equals(execution.getUserId())) {
        throw new BizException(ApiCode.NOT_FOUND.code(), "plan execution not found");
    }
    return execution;
}

private UserTrainingPlanDefinition requireOwnedDefinition(Long userId, Long definitionId) {
    UserTrainingPlanDefinition definition = definitionMapper.selectById(definitionId);
    if (definition == null || !userId.equals(definition.getUserId())) {
        throw new BizException(ApiCode.NOT_FOUND.code(), "plan definition not found");
    }
    return definition;
}
```

Extend `copyDefinition(...)` with a final `Long savedFromExecutionId` parameter and set it before insert. Pass `null` from ordinary copy paths. In `delete`, set `savedFromExecutionId` to `null` before `updateById`.

- [ ] **Step 5: Return persisted saved state with the active execution**

Add `Long savedDefinitionId` after `sourceSystemPlanId` in `ActiveExecutionResponse`.

In `PlanExecutionService.toActiveResponse`:

```java
UserTrainingPlanDefinition saved = execution.getSourceSystemPlanId() == null
    ? null
    : definitionMapper.selectActiveSavedByExecution(execution.getUserId(), execution.getId());

return new ActiveExecutionResponse(
    execution.getId(),
    execution.getDefinitionId(),
    execution.getSourceSystemPlanId(),
    saved == null ? null : saved.getId(),
    definition == null ? null : definition.getName(),
    execution.getStatus(),
    currentWeek(execution, definition, BusinessClock.today()),
    definition == null ? null : definition.getCycleWeeks(),
    execution.getScheduleStartDate(),
    execution.getScheduleEndDate(),
    days.stream()
        .map(day -> toDayResponse(
            day,
            itemsByDayId.getOrDefault(day.getId(), List.of()),
            exercisesById
        ))
        .toList()
);
```

- [ ] **Step 6: Run focused plan tests**

Run `mvn -Dtest=UserPlanQuotaServiceTest,UserPlanServiceTest,PlanExecutionServiceTest test`.

Expected: PASS, including quota delegation, source rejection, idempotency, provenance clearing, and response state.

- [ ] **Step 7: Commit the backend plan behavior**

```bash
cd fitness-server
git add src/main/java/com/liftlog/modules/plan/service/UserPlanService.java \
  src/main/java/com/liftlog/modules/plan/service/PlanExecutionService.java \
  src/main/java/com/liftlog/modules/plan/dto/ActiveExecutionResponse.java \
  src/test/java/com/liftlog/modules/plan/UserPlanServiceTest.java \
  src/test/java/com/liftlog/modules/plan/PlanExecutionServiceTest.java
git commit --only -m "feat: enforce free plan quota and save idempotency" -- \
  src/main/java/com/liftlog/modules/plan/service/UserPlanService.java \
  src/main/java/com/liftlog/modules/plan/service/PlanExecutionService.java \
  src/main/java/com/liftlog/modules/plan/dto/ActiveExecutionResponse.java \
  src/test/java/com/liftlog/modules/plan/UserPlanServiceTest.java \
  src/test/java/com/liftlog/modules/plan/PlanExecutionServiceTest.java
```

### Task 4: Add the free one-query home weekly rhythm endpoint

**Files:**
- Create: `fitness-server/src/main/java/com/liftlog/modules/training/dto/HomeWeeklyRhythmResponse.java`
- Create: `fitness-server/src/main/java/com/liftlog/modules/training/model/HomeWeeklyRhythmStat.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/training/mapper/TrainingRecordMapper.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/training/service/TrainingQueryService.java`
- Modify: `fitness-server/src/main/java/com/liftlog/modules/training/controller/TrainingController.java`
- Test: `fitness-server/src/test/java/com/liftlog/modules/training/TrainingQueryServiceTest.java`

**Interfaces:**
- Produces: `GET /api/trainings/home/weekly-rhythm`.
- Produces: `HomeWeeklyRhythmResponse(weekStart, weekEnd, sessionCount, totalVolumeKg, totalDurationSeconds, trainedDates)`.

- [ ] **Step 1: Write a deterministic failing service test**

Add:

```java
@Test
void shouldReturnFreeHomeWeeklyRhythmFromOneAggregate() {
    LocalDate today = LocalDate.of(2026, 7, 23);
    LocalDateTime start = LocalDate.of(2026, 7, 20).atStartOfDay();
    LocalDateTime end = LocalDate.of(2026, 7, 27).atStartOfDay();
    HomeWeeklyRhythmStat stat = new HomeWeeklyRhythmStat();
    stat.setSessionCount(2L);
    stat.setTotalVolumeKg(new BigDecimal("3200.00"));
    stat.setTotalDurationSeconds(5400L);
    stat.setTrainedDatesCsv("2026-07-20,2026-07-23");
    when(recordMapper.selectHomeWeeklyRhythm(7L, start, end)).thenReturn(stat);

    HomeWeeklyRhythmResponse response = trainingQueryService.weeklyRhythm(7L, today);

    assertEquals(LocalDate.of(2026, 7, 20), response.weekStart());
    assertEquals(LocalDate.of(2026, 7, 26), response.weekEnd());
    assertEquals(2L, response.sessionCount());
    assertEquals(List.of(LocalDate.of(2026, 7, 20), LocalDate.of(2026, 7, 23)),
        response.trainedDates());
    verify(recordMapper).selectHomeWeeklyRhythm(7L, start, end);
}
```

Add a second test where the mapper returns `null` or zero fields and assert non-null zero values plus an empty date list.

- [ ] **Step 2: Run the test and verify failure**

Run `mvn -Dtest=TrainingQueryServiceTest test`.

Expected: compilation failure for the new DTO/model/method.

- [ ] **Step 3: Add the projection and single aggregate query**

Create the projection:

```java
public class HomeWeeklyRhythmStat {
    private Long sessionCount;
    private BigDecimal totalVolumeKg;
    private Long totalDurationSeconds;
    private String trainedDatesCsv;

    public Long getSessionCount() { return sessionCount; }
    public void setSessionCount(Long sessionCount) { this.sessionCount = sessionCount; }
    public BigDecimal getTotalVolumeKg() { return totalVolumeKg; }
    public void setTotalVolumeKg(BigDecimal totalVolumeKg) {
        this.totalVolumeKg = totalVolumeKg;
    }
    public Long getTotalDurationSeconds() { return totalDurationSeconds; }
    public void setTotalDurationSeconds(Long totalDurationSeconds) {
        this.totalDurationSeconds = totalDurationSeconds;
    }
    public String getTrainedDatesCsv() { return trainedDatesCsv; }
    public void setTrainedDatesCsv(String trainedDatesCsv) {
        this.trainedDatesCsv = trainedDatesCsv;
    }
}
```

Add to `TrainingRecordMapper`:

```java
@Select("""
    SELECT COUNT(*) AS session_count,
           COALESCE(SUM(total_volume_kg), 0) AS total_volume_kg,
           COALESCE(SUM(duration_seconds), 0) AS total_duration_seconds,
           GROUP_CONCAT(
               DISTINCT DATE_FORMAT(started_at, '%Y-%m-%d')
               ORDER BY DATE_FORMAT(started_at, '%Y-%m-%d')
               SEPARATOR ','
           ) AS trained_dates_csv
    FROM training_record
    WHERE user_id = #{userId}
      AND started_at >= #{start}
      AND started_at < #{end}
    """)
HomeWeeklyRhythmStat selectHomeWeeklyRhythm(@Param("userId") Long userId,
                                            @Param("start") LocalDateTime start,
                                            @Param("end") LocalDateTime end);
```

- [ ] **Step 4: Add the response and service mapping**

Create:

```java
public record HomeWeeklyRhythmResponse(
    LocalDate weekStart,
    LocalDate weekEnd,
    Long sessionCount,
    BigDecimal totalVolumeKg,
    Long totalDurationSeconds,
    List<LocalDate> trainedDates
) {}
```

Add to `TrainingQueryService`:

```java
public HomeWeeklyRhythmResponse weeklyRhythm(Long userId) {
    return weeklyRhythm(userId, BusinessClock.today());
}

public HomeWeeklyRhythmResponse weeklyRhythm(Long userId, LocalDate today) {
    LocalDate weekStart = BusinessClock.weekStart(today);
    LocalDate nextWeek = weekStart.plusWeeks(1);
    HomeWeeklyRhythmStat stat = trainingRecordMapper.selectHomeWeeklyRhythm(
        userId, weekStart.atStartOfDay(), nextWeek.atStartOfDay());
    String csv = stat == null ? null : stat.getTrainedDatesCsv();
    List<LocalDate> dates = csv == null || csv.isBlank()
        ? List.of()
        : Arrays.stream(csv.split(",")).map(LocalDate::parse).toList();
    return new HomeWeeklyRhythmResponse(
        weekStart,
        nextWeek.minusDays(1),
        stat == null || stat.getSessionCount() == null ? 0L : stat.getSessionCount(),
        stat == null || stat.getTotalVolumeKg() == null ? BigDecimal.ZERO : stat.getTotalVolumeKg(),
        stat == null || stat.getTotalDurationSeconds() == null ? 0L : stat.getTotalDurationSeconds(),
        dates
    );
}
```

- [ ] **Step 5: Expose the endpoint without membership checking**

Add to `TrainingController`:

```java
@GetMapping("/home/weekly-rhythm")
public ApiResponse<HomeWeeklyRhythmResponse> homeWeeklyRhythm() {
    return ApiResponse.success(trainingQueryService.weeklyRhythm(currentUserId()));
}
```

Do not call `membershipService.requireActive`. Keep the existing range-based `/stats/summary` check unchanged.

- [ ] **Step 6: Run training tests**

Run `mvn -Dtest=TrainingQueryServiceTest test`.

Expected: PASS with one mapper invocation per response.

- [ ] **Step 7: Commit the endpoint**

```bash
cd fitness-server
git add src/main/java/com/liftlog/modules/training/dto/HomeWeeklyRhythmResponse.java \
  src/main/java/com/liftlog/modules/training/model/HomeWeeklyRhythmStat.java \
  src/main/java/com/liftlog/modules/training/mapper/TrainingRecordMapper.java \
  src/main/java/com/liftlog/modules/training/service/TrainingQueryService.java \
  src/main/java/com/liftlog/modules/training/controller/TrainingController.java \
  src/test/java/com/liftlog/modules/training/TrainingQueryServiceTest.java
git commit --only -m "feat: add free home weekly rhythm aggregate" -- \
  src/main/java/com/liftlog/modules/training/dto/HomeWeeklyRhythmResponse.java \
  src/main/java/com/liftlog/modules/training/model/HomeWeeklyRhythmStat.java \
  src/main/java/com/liftlog/modules/training/mapper/TrainingRecordMapper.java \
  src/main/java/com/liftlog/modules/training/service/TrainingQueryService.java \
  src/main/java/com/liftlog/modules/training/controller/TrainingController.java \
  src/test/java/com/liftlog/modules/training/TrainingQueryServiceTest.java
```

### Task 5: Consume the weekly rhythm efficiently on Home

**Files:**
- Modify: `fitness-front/src/api/training.ts`
- Modify: `fitness-front/src/pages/home/index.vue`
- Create: `fitness-front/src/utils/__tests__/home-weekly-rhythm.test.ts`

**Interfaces:**
- Consumes: Task 4 `HomeWeeklyRhythmResponse`.
- Produces: `fetchHomeWeeklyRhythm()` and a membership-independent Home card.

- [ ] **Step 1: Add a failing source-contract test**

Create:

```ts
// @ts-ignore -- Vitest runs in Node; production tsconfig omits Node types.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rootUrl = new URL('../../../', import.meta.url)
const readSource = (path: string) => readFileSync(new URL(path, rootUrl), 'utf8')

describe('home weekly rhythm contract', () => {
  it('uses one free aggregate instead of membership-gated summary and weekly history', () => {
    const home = readSource('src/pages/home/index.vue')
    expect(home).toContain('fetchHomeWeeklyRhythm')
    expect(home).not.toContain('fetchTrainingSummary')
    expect(home).not.toContain('weekHistory')
    expect(home).not.toContain("v-else-if=\"!membershipStore.active\"")
    expect(home).toContain('查看本周完成情况')
  })
})
```

- [ ] **Step 2: Run the test and verify failure**

Run `npm run test:run -- src/utils/__tests__/home-weekly-rhythm.test.ts` from `fitness-front`.

Expected: FAIL because Home still uses the Pro-gated two-request flow.

- [ ] **Step 3: Add the API contract**

Add to `src/api/training.ts`:

```ts
export interface HomeWeeklyRhythmResponse {
  weekStart: string
  weekEnd: string
  sessionCount: number
  totalVolumeKg: number
  totalDurationSeconds: number
  trainedDates: string[]
}

export function fetchHomeWeeklyRhythm() {
  return request<HomeWeeklyRhythmResponse>({
    url: '/api/trainings/home/weekly-rhythm',
    method: 'GET'
  })
}
```

- [ ] **Step 4: Replace Home state and requests**

Use one state object:

```ts
const weeklyRhythm = ref<HomeWeeklyRhythmResponse | null>(null)
const weekSessions = computed(() =>
  weeklyRhythm.value ? `${weeklyRhythm.value.sessionCount} 次` : '--'
)
const totalVolume = computed(() =>
  weeklyRhythm.value
    ? `${formatCompactWeight(weeklyRhythm.value.totalVolumeKg, weightUnit.value)} ${weightUnit.value}`
    : '--'
)
const totalDuration = computed(() =>
  weeklyRhythm.value ? `${Math.round(weeklyRhythm.value.totalDurationSeconds / 60)} min` : '--'
)
```

Build the seven dots from `new Set(weeklyRhythm.value?.trainedDates || [])`. Remove `membershipStore`, `fetchTrainingSummary`, `getCurrentWeekRange`, and the weekly history request. Fetch `fetchHomeWeeklyRhythm()` in parallel with current plan and recent history, and set `weeklyRhythm.value = null` only on its own failure.

Replace the logged-in card condition with:

```vue
<view v-else class="home-page__week-panel">
```

Change the section subtitle to `查看本周完成情况`. Keep `goTrend()` membership-gated.

- [ ] **Step 5: Run the contract test and typecheck**

Run:

```bash
cd fitness-front
npm run test:run -- src/utils/__tests__/home-weekly-rhythm.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the Home change**

```bash
cd fitness-front
git add src/api/training.ts src/pages/home/index.vue \
  src/utils/__tests__/home-weekly-rhythm.test.ts
git commit --only -m "feat: show free home weekly rhythm" -- \
  src/api/training.ts src/pages/home/index.vue \
  src/utils/__tests__/home-weekly-rhythm.test.ts
```

### Task 6: Allow the first free plan and show accurate plan errors

**Files:**
- Modify: `fitness-front/src/utils/membership-guard.ts`
- Modify: `fitness-front/src/stores/membership-prompt.ts`
- Modify: `fitness-front/src/stores/training-hub.ts`
- Modify: `fitness-front/src/components/membership-required-modal/index.vue`
- Create: `fitness-front/src/utils/plan-write-feedback.ts`
- Modify: `fitness-front/src/pages/plan/create.vue`
- Modify: `fitness-front/src/pages/plan/index.vue`
- Modify: `fitness-front/src/pages/plan/detail.vue`
- Modify: `fitness-front/src/pages/plan/edit.vue`
- Modify: `fitness-front/src/pages/plan/day-edit.vue`
- Modify: `fitness-front/src/pages/profile/membership.vue`
- Create: `fitness-front/src/utils/__tests__/free-plan-entitlement.test.ts`

**Interfaces:**
- Consumes: backend `40311` and exact message from Tasks 2-3.
- Produces: quota-aware membership prompt with a “管理我的计划” secondary action.

- [ ] **Step 1: Write the failing entitlement contract**

Create a Vitest source-contract test asserting:

```ts
// @ts-ignore -- Vitest runs in Node; production tsconfig omits Node types.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rootUrl = new URL('../../../', import.meta.url)
const readSource = (path: string) => readFileSync(new URL(path, rootUrl), 'utf8')

describe('free plan entitlement contract', () => {
  it('lets the backend decide the free slot and explains the quota', () => {
    expect(readSource('src/utils/membership-guard.ts')).toContain(
      "featureName.includes('自定义训练计划')"
    )
    expect(readSource('src/pages/plan/create.vue')).toContain('showPlanWriteError')
    expect(readSource('src/stores/membership-prompt.ts')).toContain('secondaryActionText')
    expect(readSource('src/stores/training-hub.ts')).toContain('requestPlanTab')
    expect(readSource('src/pages/profile/membership.vue')).toContain('1 个我的计划')
  })
})
```

- [ ] **Step 2: Run the test and verify failure**

Run `npm run test:run -- src/utils/__tests__/free-plan-entitlement.test.ts`.

Expected: FAIL.

- [ ] **Step 3: Let quota-managed plans reach the backend**

Change the passthrough condition in `membership-guard.ts`:

```ts
if (
  featureName.includes('自定义动作') ||
  featureName.includes('自定义模板') ||
  featureName.includes('自定义训练计划')
) {
  return true
}
```

- [ ] **Step 4: Add an optional secondary prompt action**

Add this option shape to `membership-prompt.ts`:

```ts
export interface MembershipPromptOptions {
  secondaryActionText?: string
  onSecondary?: () => void
}
```

Store `secondaryActionText` and the callback when `open(...)` is called. Add:

```ts
const secondaryActionText = ref('暂不开通')
let secondaryAction: (() => void) | null = null

function open(
  featureName: string,
  customDescription?: string,
  valueEntryPoint?: string,
  options: MembershipPromptOptions = {}
) {
  resolver?.(false)
  title.value = '会员功能'
  description.value = customDescription || defaultDescription(featureName)
  bullets.value = []
  primaryActionText.value = '开通会员'
  secondaryActionText.value = options.secondaryActionText || '暂不开通'
  secondaryAction = options.onSecondary || null
  entryPoint.value = valueEntryPoint || ''
  visible.value = true

  if (valueEntryPoint) {
    void fetchMembershipValue(valueEntryPoint)
      .then((value) => {
        if (!visible.value || entryPoint.value !== valueEntryPoint) return
        title.value = value.title
        description.value = value.description
        bullets.value = value.bullets || []
        primaryActionText.value = value.primaryActionText || primaryActionText.value
      })
      .catch((err) => {
        console.error('[membership] value explanation failed', err)
      })
  }

  return new Promise<boolean>((resolve) => {
    resolver = resolve
  })
}

function runSecondary() {
  const action = secondaryAction
  close(false)
  action?.()
}
```

In `close`, reset `secondaryActionText.value = '暂不开通'` and `secondaryAction = null`. Return `secondaryActionText` and `runSecondary` from the Store. Change the modal secondary button to call `runSecondary()` and render `secondaryActionText`. Defaults remain “暂不开通”.

- [ ] **Step 5: Centralize plan write feedback**

First add the one-shot intent API needed by the prompt action to `training-hub.ts`:

```ts
export type PlanLandingTab = 'system' | 'mine'
const requestedPlanTab = ref<PlanLandingTab | null>(null)

function requestPlanTab(tab: PlanLandingTab) {
  requestedView.value = 'plan'
  requestedPlanTab.value = tab
}

function consumeRequestedPlanTab() {
  const tab = requestedPlanTab.value
  requestedPlanTab.value = null
  return tab
}
```

Return `requestedPlanTab`, `requestPlanTab`, and `consumeRequestedPlanTab` from the Store.

Create `plan-write-feedback.ts`:

```ts
import { ApiError } from '@/api/http'
import { useMembershipPromptStore } from '@/stores/membership-prompt'
import { useTrainingHubStore } from '@/stores/training-hub'
import { routes } from '@/utils/navigation'

export function showPlanWriteError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.code === 40311) {
    void useMembershipPromptStore().open(
      '自定义训练计划',
      error.message,
      'custom_plan',
      {
        secondaryActionText: '管理我的计划',
        onSecondary: () => {
          useTrainingHubStore().requestPlanTab('mine')
          uni.switchTab({ url: routes.planIndex })
        }
      }
    )
    return true
  }
  const title = error instanceof ApiError && error.message
    ? error.message
    : fallback
  uni.showToast({ title: title.slice(0, 30), icon: 'none' })
  return false
}
```

- [ ] **Step 6: Apply accurate feedback to every plan write path**

In create/copy/save/update/day mutations, replace blanket toasts with:

```ts
catch (err) {
  showPlanWriteError(err, '计划创建失败，请重试')
  console.error('[plan] create failed', err)
}
```

Use action-specific fallbacks (`计划复制失败，请重试`, `计划保存失败，请重试`, `训练日保存失败，请重试`). Change plan deletion entry checks from `ensureMembershipFeature` to `ensureFeatureAuth`; backend deletion remains authoritative and free.

Import and render `<MembershipRequiredModal />` in `plan/create.vue`; edit, day-edit, detail, and index already render it.

- [ ] **Step 7: Update membership copy**

Add an “无限我的计划” benefit:

```ts
{
  title: '无限我的计划',
  desc: '免费版可拥有 1 个我的计划；会员可无限创建、复制和编辑。'
}
```

Update free status copy and `defaultDescription()` to mention the one-plan quota rather than saying all custom plans require Pro.

- [ ] **Step 8: Run tests and typecheck**

Run:

```bash
npm run test:run -- src/utils/__tests__/free-plan-entitlement.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit the entitlement UX**

```bash
cd fitness-front
git add src/utils/membership-guard.ts src/stores/membership-prompt.ts \
  src/stores/training-hub.ts src/components/membership-required-modal/index.vue \
  src/utils/plan-write-feedback.ts src/pages/plan/create.vue src/pages/plan/index.vue \
  src/pages/plan/detail.vue src/pages/plan/edit.vue src/pages/plan/day-edit.vue \
  src/pages/profile/membership.vue src/utils/__tests__/free-plan-entitlement.test.ts
git commit --only -m "feat: support the first free custom plan" -- \
  src/utils/membership-guard.ts src/stores/membership-prompt.ts \
  src/stores/training-hub.ts src/components/membership-required-modal/index.vue \
  src/utils/plan-write-feedback.ts src/pages/plan/create.vue src/pages/plan/index.vue \
  src/pages/plan/detail.vue src/pages/plan/edit.vue src/pages/plan/day-edit.vue \
  src/pages/profile/membership.vue src/utils/__tests__/free-plan-entitlement.test.ts
```

### Task 7: Add explicit plan navigation and current-plan management

**Files:**
- Modify: `fitness-front/src/api/plan.ts`
- Modify: `fitness-front/src/stores/plan.ts`
- Modify: `fitness-front/src/pages/home/index.vue`
- Modify: `fitness-front/src/pages/plan/index.vue`
- Modify: `fitness-front/src/pages/plan/active.vue`
- Create: `fitness-front/src/utils/__tests__/plan-navigation-management.test.ts`

**Interfaces:**
- Consumes: `ActiveExecutionResponse.savedDefinitionId` from Task 3.
- Consumes: Task 6 `requestPlanTab('system' | 'mine')` and `consumeRequestedPlanTab()`.
- Produces: current plan “管理计划” actions and free deactivation flow.

- [ ] **Step 1: Write failing navigation/management contracts**

Create a source-contract test asserting:

```ts
// @ts-ignore -- Vitest runs in Node; production tsconfig omits Node types.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rootUrl = new URL('../../../', import.meta.url)
const readSource = (path: string) => readFileSync(new URL(path, rootUrl), 'utf8')

describe('plan navigation and management contract', () => {
  it('carries an explicit landing tab and exposes current-plan stop', () => {
    const hub = readSource('src/stores/training-hub.ts')
    const home = readSource('src/pages/home/index.vue')
    const plan = readSource('src/pages/plan/index.vue')
    const active = readSource('src/pages/plan/active.vue')
    expect(hub).toContain('requestedPlanTab')
    expect(hub).toContain('consumeRequestedPlanTab')
    expect(home).toContain("requestPlanTab(planStore.userPlans.length ? 'mine' : 'system')")
    expect(plan).toContain('浏览系统计划')
    expect(active).toContain('停用当前计划')
    expect(active).toContain('savedDefinitionId')
  })
})
```

- [ ] **Step 2: Run the test and verify failure**

Run `npm run test:run -- src/utils/__tests__/plan-navigation-management.test.ts`.

Expected: FAIL.

- [ ] **Step 3: Extend the API and Store saved-state contract**

Add to `ActiveExecutionResponse`:

```ts
savedDefinitionId?: number | null
```

After `saveActiveToMyPlans` succeeds:

```ts
if (activeExecution.value?.executionId === executionId) {
  activeExecution.value = {
    ...activeExecution.value,
    savedDefinitionId: detail.id
  }
}
```

Keep `deactivateActive()` clearing `activeExecution`, `currentPlanSummary`, list active flags, and recommendation.

- [ ] **Step 4: Consume the one-shot plan-tab intent**

In plan page `onShow`, call `trainingHubStore.consumeRequestedPlanTab()` after consuming the requested main view. If the result is non-null, assign it to `activeTab`; otherwise retain the existing subtab.

- [ ] **Step 5: Apply the navigation rules**

Before Home switches to the plan Tab:

```ts
trainingHubStore.requestPlanTab(planStore.userPlans.length ? 'mine' : 'system')
uni.switchTab({ url: routes.planIndex })
```

In plan page `onShow`, consume the requested plan tab once and assign `activeTab`. Direct bottom-Tab entry keeps the existing value. Replace the plain mine empty copy with an `EmptyState` and primary `浏览系统计划` action that calls `focusPlanList()`.

- [ ] **Step 6: Drive saved state from the backend response**

Remove the page-only `savedDefinitionId` ref from `active.vue` and use:

```ts
const savedDefinitionId = computed(() => execution.value?.savedDefinitionId ?? null)
```

Use `showPlanWriteError(err, '保存到我的计划失败，请重试')` in the save catch.

Import and render `<MembershipRequiredModal />` in `plan/active.vue` so the backend quota response is visible on that page.

- [ ] **Step 7: Add current-plan management and stop confirmation**

Add a “管理计划” action near the current-plan status. Open an `AppActionSheet` containing:

```ts
const manageItems = computed(() => [
  ...(
    canSaveSystemPlan.value && !savedDefinitionId.value
      ? [{ key: 'save', label: '存为我的计划', description: '生成可独立编辑的副本' }]
      : []
  ),
  {
    key: 'deactivate',
    label: '停用当前计划',
    description: '保留训练记录和历史进度',
    danger: true
  }
])
```

Use a second confirmation sheet with the exact text:

```text
停用后首页不再展示该计划的训练安排，已完成的训练记录和进度历史会保留。
```

On confirmation:

```ts
await planStore.deactivateActive()
trainingHubStore.requestPlanTab('system')
uni.showToast({ title: '已停用当前计划', icon: 'none' })
uni.switchTab({ url: routes.planIndex })
```

- [ ] **Step 8: Run Tasks 6-7 frontend tests and typecheck**

Run:

```bash
cd fitness-front
npm run test:run -- src/utils/__tests__/free-plan-entitlement.test.ts \
  src/utils/__tests__/plan-navigation-management.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit navigation and current-plan management**

```bash
cd fitness-front
git add src/api/plan.ts src/stores/plan.ts src/pages/home/index.vue \
  src/pages/plan/index.vue src/pages/plan/active.vue \
  src/utils/__tests__/plan-navigation-management.test.ts
git commit --only -m "feat: add plan navigation and current plan management" -- \
  src/api/plan.ts src/stores/plan.ts src/pages/home/index.vue \
  src/pages/plan/index.vue src/pages/plan/active.vue \
  src/utils/__tests__/plan-navigation-management.test.ts
```

### Task 8: Return complete template writes and refresh the manager immediately

**Files:**
- Modify: `fitness-server/src/main/java/com/liftlog/modules/template/controller/TemplateController.java`
- Create: `fitness-server/src/test/java/com/liftlog/modules/template/TemplateControllerTest.java`
- Modify: `fitness-front/src/api/template.ts`
- Modify: `fitness-front/src/stores/template.ts`
- Modify: `fitness-front/src/pages/home/template-edit.vue`
- Modify: `fitness-front/src/pages/profile/template-manager.vue`
- Create: `fitness-front/src/utils/__tests__/template-write-refresh.test.ts`

**Interfaces:**
- Produces: template create/update/copy/from-training HTTP responses as `TemplateDetailResponse`.
- Produces: `templateStore.save(payload, id?)` with immediate local upsert.

- [ ] **Step 1: Write a failing backend controller test**

Create `TemplateControllerTest` with a mocked command result and full detail query:

```java
@Test
void createReturnsThePersistedTemplateDetail() {
    TemplateQueryService query = mock(TemplateQueryService.class);
    TemplateCommandService command = mock(TemplateCommandService.class);
    TemplateController controller = new TemplateController(query, command);
    UpsertTemplateRequest request = new UpsertTemplateRequest(
        "新模板",
        List.of(new UpsertTemplateItemRequest(1L, 3))
    );
    TemplateDetailResponse detail = new TemplateDetailResponse(
        9L, "新模板", "USER", null, null, null, null, List.of());
    when(command.create(7L, request)).thenReturn(new UpsertTemplateResponse(9L));
    when(query.detail(7L, 9L)).thenReturn(detail);

    try (MockedStatic<StpUtil> stp = mockStatic(StpUtil.class)) {
        stp.when(StpUtil::getLoginIdAsLong).thenReturn(7L);
        assertEquals(detail, controller.create(request).data());
    }
}
```

- [ ] **Step 2: Run the backend test and verify failure**

Run `mvn -Dtest=TemplateControllerTest test`.

Expected: type/assertion failure because the controller currently returns only `{ id }`.

- [ ] **Step 3: Return full details from template mutations**

For create/update/from-training/copy, store the command response then query the authorized detail:

```java
@PostMapping
public ApiResponse<TemplateDetailResponse> create(@Valid @RequestBody UpsertTemplateRequest request) {
    Long userId = currentUserId();
    UpsertTemplateResponse saved = templateCommandService.create(userId, request);
    return ApiResponse.success(templateQueryService.detail(userId, saved.id()));
}
```

Implement the remaining mutation endpoints explicitly:

```java
@PutMapping("/{id}")
public ApiResponse<TemplateDetailResponse> update(@PathVariable Long id,
                                                  @Valid @RequestBody UpsertTemplateRequest request) {
    Long userId = currentUserId();
    UpsertTemplateResponse saved = templateCommandService.update(userId, id, request);
    return ApiResponse.success(templateQueryService.detail(userId, saved.id()));
}

@PostMapping("/from-training/{trainingId}")
public ApiResponse<TemplateDetailResponse> createFromTraining(
    @PathVariable Long trainingId,
    @RequestParam(required = false) String name
) {
    Long userId = currentUserId();
    UpsertTemplateResponse saved =
        templateCommandService.createFromTraining(userId, trainingId, name);
    return ApiResponse.success(templateQueryService.detail(userId, saved.id()));
}

@PostMapping("/{id}/copy")
public ApiResponse<TemplateDetailResponse> copy(@PathVariable Long id) {
    Long userId = currentUserId();
    UpsertTemplateResponse saved = templateCommandService.copy(userId, id);
    return ApiResponse.success(templateQueryService.detail(userId, saved.id()));
}
```

Delete remains `ApiResponse<Void>`.

- [ ] **Step 4: Run and commit the backend template contract**

Run `mvn -Dtest=TemplateControllerTest,TemplateCommandServiceTest test`.

Expected: PASS.

```bash
cd fitness-server
git add src/main/java/com/liftlog/modules/template/controller/TemplateController.java \
  src/test/java/com/liftlog/modules/template/TemplateControllerTest.java
git commit --only -m "feat: return template details after writes" -- \
  src/main/java/com/liftlog/modules/template/controller/TemplateController.java \
  src/test/java/com/liftlog/modules/template/TemplateControllerTest.java
```

- [ ] **Step 5: Write the failing frontend template contract**

Create a Vitest test asserting:

```ts
// @ts-ignore -- Vitest runs in Node; production tsconfig omits Node types.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const rootUrl = new URL('../../../', import.meta.url)
const readSource = (path: string) => readFileSync(new URL(path, rootUrl), 'utf8')

describe('template write-through contract', () => {
  it('updates the Store immediately and keeps rename readable', () => {
    expect(readSource('src/api/template.ts')).not.toContain('interface UpsertTemplateResponse')
    expect(readSource('src/stores/template.ts')).toContain('async function save(')
    expect(readSource('src/pages/home/template-edit.vue')).toContain('templateStore.save(')
    expect(readSource('src/pages/home/template-edit.vue')).not.toContain(
      'await templateStore.fetchTemplates()'
    )
    expect(readSource('src/pages/profile/template-manager.vue')).toContain('maxlength="30"')
    expect(readSource('src/pages/profile/template-manager.vue')).toContain(
      'color: var(--app-text)'
    )
  })
})
```

- [ ] **Step 6: Run the frontend test and verify failure**

Run `npm run test:run -- src/utils/__tests__/template-write-refresh.test.ts`.

Expected: FAIL.

- [ ] **Step 7: Update API types and Store write-through behavior**

Change create/update/copy/from-training request return types to `TemplateDetailResponse`. Add to the Store:

```ts
function upsertDetail(detail: TemplateDetailResponse) {
  detailCache.value = { ...detailCache.value, [detail.id]: detail }
  const next = toTemplate(detail, 0)
  items.value = [next, ...items.value.filter((item) => item.id !== detail.id)]
  loadedFromServer.value = true
  loadedAt.value = Date.now()
}

async function save(payload: UpsertTemplateRequest, id?: number) {
  const detail = id ? await updateTemplate(id, payload) : await createTemplate(payload)
  upsertDetail(detail)
  return detail
}
```

Use `upsertDetail` after copy and create-from-training as well. Return `save` from the Store.

- [ ] **Step 8: Route the edit page through the Store**

Replace direct API mutation calls with:

```ts
await templateStore.save(payload, templateId.value || undefined)
uni.showToast({ title: '模板已保存', icon: 'none' })
uni.navigateBack()
```

Do not call cached `fetchTemplates()` after the write; the Store already contains the server-returned detail.

- [ ] **Step 9: Fix rename readability and submission state**

Use:

```vue
<input
  v-model="editName"
  class="template-manager__input"
  focus
  maxlength="30"
  :disabled="saving"
/>
```

Style with:

```scss
.template-manager__input {
  box-sizing: border-box;
  width: 100%;
  min-height: 84rpx;
  padding: 0 22rpx;
  border: 1rpx solid var(--app-border-strong);
  border-radius: 20rpx;
  background: var(--app-surface-subtle);
  color: var(--app-text);
  font-size: 30rpx;
}

.template-manager__input:focus {
  border-color: var(--app-accent);
}
```

- [ ] **Step 10: Run and commit the frontend template fix**

Run:

```bash
cd fitness-front
npm run test:run -- src/utils/__tests__/template-write-refresh.test.ts
npm run typecheck
```

Expected: PASS.

```bash
git add src/api/template.ts src/stores/template.ts src/pages/home/template-edit.vue \
  src/pages/profile/template-manager.vue src/utils/__tests__/template-write-refresh.test.ts
git commit --only -m "fix: refresh template manager after writes" -- \
  src/api/template.ts src/stores/template.ts src/pages/home/template-edit.vue \
  src/pages/profile/template-manager.vue src/utils/__tests__/template-write-refresh.test.ts
```

### Task 9: Synchronize product truth and run release verification

**Files:**
- Modify: `PRODUCT.md`
- Modify: `需求设计.md`
- Modify: `DESIGN.md`
- Modify: `fitness-front/docs/superpowers/specs/2026-07-19-fitforge-product-scope-membership-level-redesign.md`
- Modify: `fitness-front/docs/superpowers/specs/2026-07-20-fitforge-free-plan-home-rhythm-and-plan-flow-design.md`
- Modify: `fitness-front/docs/superpowers/plans/2026-07-20-fitforge-free-plan-home-rhythm-and-plan-flow.md`

**Interfaces:**
- Consumes: completed implementation and verified endpoint names.
- Produces: one consistent product source of truth for future work.

- [x] **Step 1: Update the product documents with exact current rules**

Make these statements explicit in all current-source documents:

```text
首页“本周节奏”是免费基础反馈；周统计详情、历史周趋势、周报和高级分析属于 Pro。
免费用户可拥有 1 个有效“我的计划”，Pro 数量不限。
系统计划执行不占额度，保存为独立副本后才占额度。
计划额度由 MySQL 事务、用户行锁和索引计数保证，不使用 Redis 计数。
当前安排支持停用；首页选择计划根据“我的计划”数量进入系统或我的子页。
```

At the top of the 2026-07-19 spec, add a link saying its weekly-stat and custom-plan conclusions are partially superseded by the 2026-07-20 spec.

- [x] **Step 2: Verify focused backend suites**

Run:

```bash
cd fitness-server
mvn -Dtest=SchemaSmokeTest,UserPlanQuotaServiceTest,UserPlanServiceTest,PlanExecutionServiceTest,TrainingQueryServiceTest,TemplateControllerTest,TemplateCommandServiceTest test
```

Expected: all focused tests PASS.

- [x] **Step 3: Verify all backend tests**

Run `mvn test` from `fitness-server`.

Expected: BUILD SUCCESS. If an unrelated pre-existing test fails, record its exact class and failure without masking focused results.

- [x] **Step 4: Verify frontend tests and build contract**

Run:

```bash
cd fitness-front
npm run test:run
npm run verify
```

Expected: all Vitest tests PASS; format check, typecheck, and WeChat build PASS.

- [x] **Step 5: Verify the query plans against a development database**

Run `EXPLAIN` with an existing development user ID and the current week boundaries:

```sql
EXPLAIN SELECT COUNT(*),
               COALESCE(SUM(total_volume_kg), 0),
               COALESCE(SUM(duration_seconds), 0)
FROM training_record
WHERE user_id = 1
  AND started_at >= '2026-07-20 00:00:00'
  AND started_at < '2026-07-27 00:00:00';

EXPLAIN SELECT COUNT(*)
FROM user_training_plan_definition
WHERE user_id = 1
  AND is_saved = 1
  AND status = 'ACTIVE';
```

Expected: `possible_keys` includes `idx_training_record_user_started` for the weekly query and `idx_user_plan_definition_saved` for quota count; selected `key` should use those indexes for representative data.

- [ ] **Step 6: Verify free-plan concurrency against the running development service（待真实免费测试账号/token外部验收）**

Use a free test account with zero saved plans. Export its token as `PLAN_TEST_TOKEN`, start the backend on port 8081, then run:

```bash
test -n "${PLAN_TEST_TOKEN:-}" || { echo "PLAN_TEST_TOKEN is required"; exit 1; }
PLAN_TEST_DIR=$(mktemp -d)
for PLAN_TEST_SUFFIX in a b; do
  curl -sS http://127.0.0.1:8081/api/user-plans \
    -H "Content-Type: application/json" \
    -H "satoken: ${PLAN_TEST_TOKEN}" \
    -d "{\"name\":\"并发额度测试-${PLAN_TEST_SUFFIX}\",\"cycleWeeks\":4}" \
    -o "${PLAN_TEST_DIR}/${PLAN_TEST_SUFFIX}.json" &
done
wait
rg -n '"code"[[:space:]]*:[[:space:]]*(0|40311)' "${PLAN_TEST_DIR}"
```

Expected: exactly one response contains code `0`, exactly one contains `40311`, and `GET /api/user-plans` returns one active saved plan. Delete that test plan through the normal API/UI after verification.

- [ ] **Step 7: Perform the six manual UI acceptance scenarios（待真实免费测试账号/token外部验收）**

Use a free test account and verify:

1. Home displays current-week sessions, volume, duration, and seven-day dots without a Pro lock.
2. First “我的计划” creation succeeds; second manual create, copy, and save-system-execution show the exact quota message.
3. Template rename is readable in light/dark themes, and a newly created template appears immediately at the top after back navigation.
4. An active system plan reports “已保存” after refresh and does not create a duplicate on repeated taps.
5. “管理计划 → 停用当前计划” preserves training history and returns to system plans.
6. Home with no active/saved plan opens system plans; Home with a saved inactive plan opens “我的计划”; mine empty state opens system plans.

- [x] **Step 8: Record verification status and commit documentation only**

Change this plan’s status note to include the verification date and results. Then commit only front-repository documentation paths:

```bash
cd fitness-front
git add docs/superpowers/specs/2026-07-19-fitforge-product-scope-membership-level-redesign.md \
  docs/superpowers/specs/2026-07-20-fitforge-free-plan-home-rhythm-and-plan-flow-design.md \
  docs/superpowers/plans/2026-07-20-fitforge-free-plan-home-rhythm-and-plan-flow.md
git commit --only -m "docs: synchronize free plan and weekly rhythm rules" -- \
  docs/superpowers/specs/2026-07-19-fitforge-product-scope-membership-level-redesign.md \
  docs/superpowers/specs/2026-07-20-fitforge-free-plan-home-rhythm-and-plan-flow-design.md \
  docs/superpowers/plans/2026-07-20-fitforge-free-plan-home-rhythm-and-plan-flow.md
```

`PRODUCT.md`, `需求设计.md`, and `DESIGN.md` live at the shared workspace root rather than either child Git repository. Update them in place and report them explicitly in the final handoff; do not copy them into a child repository solely to force a commit.
