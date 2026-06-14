# FitForge 周复盘、历史与离线可靠性设计

## 1. 目标

让用户在训练后理解本周完成情况、明确下一步行动，并确保断网、退出或提交失败时训练记录不会丢失。

## 2. 范围

### 包含

- 首页本周节奏升级。
- 周训练复盘。
- 错过训练后的恢复安排。
- 历史记录与日历联动。
- 本地训练草稿扩展。
- 离线训练提交队列。
- 同步失败与冲突处理。

### 不包含

- 自动重写完整训练计划。
- 多人协作编辑计划。
- HealthKit 和 Health Connect 同步。

## 3. 首页本周节奏

首页仅展示简洁结论：

- 本周完成次数与计划次数。
- 一句最重要结论。
- 一个下一步行动。

示例：

> 本周已完成 3/4 次训练  
> 下次建议训练背部，预计 45 分钟。

点击区域进入周复盘。右上角“训练日历”继续进入日历，不与周复盘使用相同入口。

## 4. 周训练复盘

### 4.1 页面结构

1. 周期选择：本周、上周。
2. 本周结论：完成情况和一句建议。
3. 核心数据：训练次数、总容量、总时长、计划完成率。
4. 周内分布：训练日、完成、跳过、待处理。
5. 本周亮点：PR、提升最大的动作、稳定完成的动作。
6. 需要关注：错过训练、长期未训练肌群、连续失败动作。
7. 下周行动：下一次训练或恢复安排。

### 4.2 结论规则

首版使用确定性规则：

- 完成率达到 100%：强调稳定执行。
- 完成率 60%–99%：强调已完成内容和剩余安排。
- 完成率低于 60%：提供恢复计划，不使用失败或责备文案。
- 无启用计划但有训练记录：总结自由训练表现。
- 无训练记录：提供一个明确开始入口。

## 5. 错过训练恢复

### 5.1 触发条件

存在状态为 `OVERDUE` 的计划训练日时：

- 首页主任务优先展示“安排错过的训练”。
- 计划页当前计划摘要展示待处理数量。
- 周复盘“需要关注”区域展示对应训练日。

### 5.2 三种操作

#### 今天补练

- 立即将该训练日作为今日主任务。
- 开始后仍关联原计划日。
- 完成后状态由后端计算为补训完成。

#### 移动到其他日期

- 用户选择当前周内或下一周的可用日期。
- 页面提前展示与其他训练日冲突。
- 确认后更新该执行实例的日期覆盖，不修改原系统计划定义。

#### 跳过并继续

- 复用现有跳过能力。
- 确认文案说明跳过不会删除后续安排。
- 跳过后首页立即展示下一可执行训练日。

## 6. 历史记录与日历

### 6.1 日历

日期只表达三个高层信号：

- 有计划安排。
- 已完成训练。
- 有待处理事项。

点击日期后加载当天：

- 计划训练日。
- 已完成训练记录。
- 可执行操作。

### 6.2 历史记录

- 继续使用封面卡片展示训练记录。
- 支持按本周、本月、三个月和全部查看。
- 每条记录进入训练详情。
- 周复盘中的具体记录链接进入同一详情页。

### 6.3 训练总结后的入口

训练完成后：

- 主行动为“查看训练结果”。
- 次行动为“返回首页”。
- 结果页展示“本周进度”和“下一次建议”。
- 不要求用户立即进入修为之外的多个页面。

## 7. 离线训练

### 7.1 本地保存

现有本地草稿扩展为离线可靠记录：

- 每次修改训练组后保存本地快照。
- 当前草稿不再仅因超过 6 小时而直接删除；超过有效期后进入“历史草稿”确认。
- 完成训练后先写入本地提交队列，再尝试请求服务端。
- 服务端成功返回后标记为 `SYNCED` 并清理提交快照。

### 7.2 用户可见状态

- 训练中断网：顶部轻提示“离线记录中”。
- 完成训练但未上传：结果页显示“已保存到本机，恢复网络后同步”。
- 首页存在待同步记录：显示非阻断式同步提示。
- 同步成功：轻量 Toast，不打断当前操作。

### 7.3 重试策略

- 打开 App、恢复网络、进入首页时触发重试。
- 每条记录使用已有 `clientRequestId` 保证幂等。
- 自动重试失败三次后改为手动重试。
- 用户可在设置中的“同步状态”查看失败项。

## 8. 冲突处理

首版只处理训练记录冲突：

- 同一 `clientRequestId` 已存在服务端：以服务端成功结果为准，标记同步完成。
- 本地记录与服务端记录内容不同：进入 `CONFLICT`。
- 冲突页面展示本地版本和服务端版本的开始时间、动作数、组数、容量。
- 用户选择保留本地、保留服务端或两条都保留。
- 选择两条都保留时，本地版本生成新的 `clientRequestId`。

## 9. 建议数据契约

### 9.1 周复盘

```ts
interface WeeklyReview {
  weekStart: string
  weekEnd: string
  headline: string
  recommendation: string
  sessionsCompleted: number
  sessionsPlanned: number
  completionRate?: number
  totalVolumeKg: number
  totalDurationSeconds: number
  prs: TrainingPrSummary[]
  attentionItems: WeeklyAttentionItem[]
  nextAction?: WeeklyNextAction
}
```

### 9.2 训练日覆盖

```ts
interface ReschedulePlanDayRequest {
  planDayId: number
  targetDate: string
}
```

该能力作用于用户启用计划实例，不修改原始计划模板。

### 9.3 本地同步队列

```ts
interface PendingTrainingSync {
  localId: string
  clientRequestId: string
  payload: SaveTrainingRequest
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'CONFLICT'
  retryCount: number
  lastAttemptAt?: string
  errorMessage?: string
}
```

## 10. 埋点

| 事件 | 关键属性 |
| --- | --- |
| `weekly_review_viewed` | `week_start`, `has_active_plan` |
| `weekly_next_action_clicked` | `action_type` |
| `overdue_workout_resolution_opened` | `overdue_count` |
| `overdue_workout_resolved` | `resolution_type` |
| `calendar_date_opened` | `has_plan`, `has_training`, `has_attention` |
| `offline_mode_entered` | `during_workout` |
| `training_queued_for_sync` | `source_type` |
| `training_sync_succeeded` | `retry_count` |
| `training_sync_failed` | `retry_count`, `error_category` |
| `training_sync_conflict_resolved` | `resolution_type` |

## 11. 异常与边界

- 周复盘接口失败：保留首页基础周统计，提供重试。
- 用户没有启用计划：周复盘只总结实际训练，不显示计划完成率。
- 改期目标日期冲突：明确显示冲突并允许继续或重新选择。
- 待同步记录存在时注销：先提示用户导出或完成同步。
- 本地存储空间不足：训练中立即提示，并允许用户完成当前页面输入后重试保存。
- 同步队列不得因用户退出 App 而丢失。

## 12. 验收标准

- 首页本周节奏能给出一句结论和一个下一步行动。
- 周复盘能够覆盖有计划、无计划、有训练和无训练状态。
- 逾期训练可选择补练、改期或跳过。
- 日历、历史、周复盘进入同一训练详情语义。
- 断网时能够开始、记录并完成训练。
- 网络恢复后能够自动同步，并通过 `clientRequestId` 避免重复记录。
- 冲突状态不会自动覆盖任一版本。

