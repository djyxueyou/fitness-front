# FitForge 周复盘、历史与训练草稿可靠性设计

## 1. 目标

让用户在训练后理解本周完成情况、明确下一步行动，并通过可靠草稿确保退出、断网或提交失败时当前训练不会丢失。

## 2. 范围

### 包含

- 首页本周节奏升级。
- 周训练复盘。
- 错过训练后的恢复安排。
- 历史记录与日历联动。
- 训练草稿有效期与过期确认。
- 保存失败后的草稿保留与手动重试。

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

## 7. 训练草稿可靠性

### 7.1 草稿保存

增强现有本地草稿：

- 每次修改训练组后保存本地快照。
- 草稿有效期由 6 小时调整为 48 小时。
- 草稿超过 48 小时后不得静默删除，进入“发现未完成训练”确认。
- 同一时间只允许存在一份草稿；开始新训练前必须恢复或删除旧草稿。
- 服务端保存成功后才清理草稿。

### 7.2 用户可见状态

- 有有效草稿：首页展示“继续训练”。
- 有过期草稿：首页或开始训练前展示恢复或删除确认。
- 完成训练提交失败：保留当前页面和草稿，显示“训练已保存在本机”。
- 保存失败状态提供“重新提交”和“稍后处理”。

### 7.3 保存失败重试

- 只允许用户主动重新提交，不建设后台自动同步队列。
- 重试继续使用原 `clientRequestId`，依赖现有服务端幂等能力。
- 重试成功后进入现有训练完成流程并清除草稿。
- 用户选择稍后处理时返回首页，首页继续展示该草稿。

## 8. 明确不建设的能力

- 多条训练提交队列。
- 后台自动同步。
- 跨设备草稿同步。
- 本地与服务端版本冲突合并。
- 完整离线浏览计划、动作库和历史。

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

### 9.3 训练草稿状态

```ts
interface ReliableWorkoutDraft {
  clientRequestId: string
  payload: SaveTrainingRequest
  savedAt: string
  expiresAt: string
  status: 'ACTIVE' | 'EXPIRED' | 'SAVE_FAILED' | 'SUBMITTING'
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
| `workout_draft_restored` | `draft_age_hours`, `expired` |
| `workout_draft_discarded` | `draft_age_hours`, `expired` |
| `training_save_failed` | `error_category`, `source_type` |
| `training_save_retry_clicked` | `draft_age_hours` |
| `training_save_retry_succeeded` | `draft_age_hours` |

## 11. 异常与边界

- 周复盘接口失败：保留首页基础周统计，提供重试。
- 用户没有启用计划：周复盘只总结实际训练，不显示计划完成率。
- 改期目标日期冲突：明确显示冲突并允许继续或重新选择。
- 草稿存在时注销：先提示用户恢复、删除或取消注销。
- 本地存储空间不足：训练中立即提示，并允许用户完成当前页面输入后重试保存。
- 保存失败后不得清除草稿或结束当前训练状态。

## 12. 验收标准

- 首页本周节奏能给出一句结论和一个下一步行动。
- 周复盘能够覆盖有计划、无计划、有训练和无训练状态。
- 逾期训练可选择补练、改期或跳过。
- 日历、历史、周复盘进入同一训练详情语义。
- 已经开始的训练在断网时仍可继续记录。
- 保存失败后草稿保留，并可使用原 `clientRequestId` 手动重试。
- 草稿超过 48 小时后不会静默删除。
