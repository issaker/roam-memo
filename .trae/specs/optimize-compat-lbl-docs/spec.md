# 向后兼容清理 + LBL Forgot 重插入 + 文档优化 Spec

## Why

上一轮重构引入了 `SchedulingAlgorithm × InteractionStyle` 新架构，但保留了完整的旧格式运行时兼容代码（`resolveReviewConfig` 三级回退、`LEGACY_MODE_TO_CONFIG`、`resolveReviewMode`、`inferReviewModeFromFields` 等），导致系统同时维护两套数据路径，增加复杂度和安全风险。同时，LBL Review 模式的子行 forgot 后缺少整卡重插入逻辑，与普通卡片的间隔重复行为不一致。此外，项目文档冗长且缺乏结构优化。

## What Changes

- **移除运行时旧格式兼容代码**：删除 `resolveReviewMode`、`inferReviewModeFromFields`、`LEGACY_MODE_RESOLUTION`、`REVIEW_MODE_VALUES` 等旧解析逻辑，`resolveReviewConfig` 仅保留新格式直接读取
- **升级数据迁移工具**：将 `MigrateLegacyDataPanel` 重构为独立模块，增加 `algorithm::` + `interaction::` 字段写入、日志记录、错误处理和回滚机制
- **移除旧格式写入**：`savePracticeData` 和 `updateReviewConfig` 不再写入 `reviewMode::` 兼容字段，仅写入 `algorithm::` + `interaction::`
- **移除旧枚举和映射**：删除 `ReviewModes` 枚举、`REVIEW_MODE_META`、`LEGACY_MODE_TO_CONFIG`、`CONFIG_TO_LEGACY_MODE`、`reviewConfigToLegacyMode`
- **实现 LBL Forgot 重插入**：LBL Review 模式下，当子行被 forgot（grade=0）时，整张 LBL 卡片按 `forgotReinsertOffset` 设置重新插入队列
- **优化 README**：压缩技术描述、完善索引、强化架构描述、移除冗余内容

## Impact

- Affected specs: ux-review-refactor (Phase 2 向后兼容架构)
- Affected code:
  - `src/models/session.ts` — 移除旧枚举/映射/解析函数
  - `src/queries/data.ts` — 移除 `reviewMode` 字段解析，仅解析 `algorithm` + `interaction`
  - `src/queries/save.ts` — 移除 `reviewMode::` 兼容写入
  - `src/queries/utils.ts` — `generateNewSession` 移除 `reviewMode` 参数
  - `src/hooks/useCurrentCardData.tsx` — 移除 `reviewMode` 派生逻辑
  - `src/hooks/useLineByLineReview.ts` — 增加 LBL forgot 重插入逻辑
  - `src/components/overlay/PracticeOverlay.tsx` — 移除 `reviewMode` 相关状态和回调
  - `src/components/overlay/Footer.tsx` — 移除 `onSelectReviewMode`
  - `src/components/overlay/Header.tsx` — 移除 `reviewMode` 引用
  - `src/components/MigrateLegacyDataPanel.tsx` — 重构为独立迁移模块
  - `src/practice.ts` — 移除 `reviewMode` 回退逻辑
  - `README.md` — 优化重构

---

## ADDED Requirements

### Requirement: LBL Forgot 卡片重插入

系统 SHALL 在 LBL Review 模式下，当用户对某子行评分 Forgot（grade=0）时，将整张 LBL 卡片按 `forgotReinsertOffset` 设置重新插入复习队列。

#### Scenario: LBL 子行 Forgot 后重插入
- **WHEN** 用户在 LBL Review 模式下对某子行评分 Forgot（grade=0）
- **AND** `forgotReinsertOffset > 0`
- **THEN** 整张 LBL 卡片被插入到当前位置 + 1 + forgotReinsertOffset 的位置
- **AND** 当前子行仍推进到下一行继续复习

#### Scenario: LBL 子行非 Forgot 不重插入
- **WHEN** 用户在 LBL Review 模式下对某子行评分非 Forgot（grade > 0）
- **THEN** 不触发重插入，正常推进到下一行

#### Scenario: LBL 最后一行 Forgot
- **WHEN** 用户在 LBL Review 模式下对最后一个子行评分 Forgot
- **AND** `forgotReinsertOffset > 0`
- **THEN** 整张 LBL 卡片被插入队列末尾附近
- **AND** 卡片标记为已完成（推进到下一张卡片）

### Requirement: 运行时旧格式兼容代码移除

系统 SHALL 移除所有运行时旧格式兼容代码，仅通过数据迁移工具实现旧数据向新格式的转换。

#### Scenario: resolveReviewConfig 仅支持新格式
- **WHEN** 加载卡片数据
- **THEN** 仅从 `algorithm` + `interaction` 字段直接读取复习配置
- **AND** 不存在 `reviewMode` 字段的运行时解析逻辑

#### Scenario: 数据保存仅使用新格式
- **WHEN** 保存卡片数据到 Roam 数据页
- **THEN** 仅写入 `algorithm::` 和 `interaction::` 字段
- **AND** 不写入 `reviewMode::` 兼容字段

#### Scenario: ReviewModes 枚举移除
- **WHEN** 查看 session.ts
- **THEN** 不存在 `ReviewModes` 枚举、`REVIEW_MODE_META`、`LEGACY_MODE_TO_CONFIG`、`CONFIG_TO_LEGACY_MODE`、`reviewConfigToLegacyMode`、`resolveReviewMode`、`inferReviewModeFromFields`

### Requirement: 数据迁移工具升级

系统 SHALL 将数据迁移工具升级为独立模块，支持 `algorithm::` + `interaction::` 字段写入，具备完整的日志记录、错误处理和回滚机制。

#### Scenario: 迁移工具写入新格式字段
- **WHEN** 迁移工具处理旧数据中的 `reviewMode:: SPACED_INTERVAL_LBL`
- **THEN** 写入 `algorithm:: SM2` 和 `interaction:: LBL` 字段到最新 session 块
- **AND** 删除旧的 `reviewMode::` 字段

#### Scenario: 迁移工具日志记录
- **WHEN** 迁移工具运行
- **THEN** 每个卡片的迁移结果被记录到控制台（成功/跳过/失败）
- **AND** 迁移完成后显示汇总统计

#### Scenario: 迁移工具错误处理
- **WHEN** 迁移过程中某个卡片处理失败
- **THEN** 记录错误详情到控制台
- **AND** 继续处理下一个卡片
- **AND** 最终报告失败数量

#### Scenario: 迁移工具回滚机制
- **WHEN** 用户点击迁移按钮
- **THEN** 迁移前显示确认对话框，说明将要执行的操作
- **AND** 迁移过程中记录所有写操作，以便手动回滚

### Requirement: README 优化

系统 SHALL 优化 README 文件，压缩非必要技术描述，完善索引，强化架构描述。

#### Scenario: README 结构清晰
- **WHEN** 查看 README
- **THEN** 包含清晰的目录索引
- **AND** 架构描述突出核心设计（SchedulingAlgorithm × InteractionStyle）
- **AND** 无冗余的旧架构描述

#### Scenario: README 经验总结
- **WHEN** 查看 README
- **THEN** 包含关键设计决策和经验总结
- **AND** 包含数据迁移说明

## MODIFIED Requirements

### Requirement: resolveReviewConfig 解析管道

旧实现支持三级回退（新格式→旧格式→字段推断），现改为仅支持新格式直接读取。若 `algorithm` 或 `interaction` 字段缺失，使用默认值（SM2 + NORMAL）。

### Requirement: Footer 复习模式选择器

旧实现保留 `onSelectReviewMode` 回调作为兼容，现完全移除，仅保留 `onSelectAlgorithm` + `onSelectInteraction`。

### Requirement: useLineByLineReview Hook

旧实现中 LBL Review 分支不处理 forgot 重插入，现增加 forgot 重插入逻辑，与普通卡片的间隔重复行为一致。

## REMOVED Requirements

### Requirement: ReviewModes 枚举
**Reason**: 被 `SchedulingAlgorithm` + `InteractionStyle` 完全替代，旧格式仅通过数据迁移工具转换
**Migration**: 数据迁移工具将旧 `reviewMode::` 字段转换为 `algorithm::` + `interaction::` 字段

### Requirement: resolveReviewMode 运行时兼容
**Reason**: 运行时兼容增加代码复杂度和安全风险，应通过一次性数据迁移解决
**Migration**: 数据迁移工具处理所有旧格式数据
