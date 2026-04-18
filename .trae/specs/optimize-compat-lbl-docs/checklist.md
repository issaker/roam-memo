# Phase 1: LBL Forgot 重插入

- [x] `useLineByLineReview.ts` 中 LBL Review 分支在 `grade === 0 && forgotReinsertOffset > 0` 时将整张 LBL 卡片重新插入队列
- [x] `useLineByLineReview` Hook 接口包含 `forgotReinsertOffset` 参数
- [x] PracticeOverlay 传递 `forgotReinsertOffset` 给 `useLineByLineReview`
- [x] LBL 子行非 Forgot（grade > 0）时不触发重插入
- [x] LBL 最后一行 Forgot 时卡片仍被重插入
- [x] `npx jest --no-coverage` 全部通过
- [x] `npm run typecheck` 无错误

# Phase 2: 数据迁移工具升级

- [x] 迁移工具增加将 `reviewMode::` 转换为 `algorithm::` + `interaction::` 的 Phase
- [x] 迁移完成后删除旧的 `reviewMode::` 字段块
- [x] 迁移前显示确认对话框
- [x] 每个卡片的迁移结果记录到控制台
- [x] 单个卡片失败不中断整体迁移
- [x] 迁移完成后显示汇总统计（成功/跳过/失败数量）
- [x] 迁移工具有扫描预览功能
- [x] `npx jest --no-coverage` 全部通过
- [x] `npm run typecheck` 无错误

# Phase 3: 移除运行时旧格式兼容代码

- [x] `resolveReviewConfig` 仅支持 `algorithm` + `interaction` 直接读取，无回退逻辑
- [x] `resolveReviewMode`、`inferReviewModeFromFields`、`hasReviewModeClues`、`LEGACY_MODE_RESOLUTION`、`REVIEW_MODE_VALUES` 已移除
- [x] `ReviewModes` 枚举已移除
- [x] `REVIEW_MODE_META`、`LEGACY_MODE_TO_CONFIG`、`CONFIG_TO_LEGACY_MODE`、`reviewConfigToLegacyMode` 已移除
- [x] `DEFAULT_REVIEW_MODE` 已移除，替换为默认 `ReviewConfig`
- [x] `isFixedMode`/`isSpacedMode` 仅接受 `SchedulingAlgorithm` 参数
- [x] `isLBLReviewMode`/`isIncrementalReadMode` 仅接受 `InteractionStyle` 参数
- [x] `savePracticeData` 不写入 `reviewMode::` 字段
- [x] `updateReviewConfig` 不写入 `reviewMode::` 兼容字段
- [x] `updateCardType` 别名导出已移除
- [x] `data.ts` 不解析 `reviewMode` 字段
- [x] `SESSION_SNAPSHOT_KEYS` 不包含 `reviewMode`
- [x] Session 类型中 `algorithm` 和 `interaction` 为必填字段，无 `reviewMode` 字段
- [x] CardMeta 类型无 `reviewMode` 字段
- [x] `generateNewSession` 使用 `algorithm` + `interaction` 参数
- [x] `useCurrentCardData` 无 `reviewMode` 派生逻辑
- [x] PracticeOverlay 无 `reviewMode` 状态和 `onSelectReviewMode` 回调
- [x] Footer 无 `onSelectReviewMode` 逻辑
- [x] `generatePracticeData` 完全基于 `algorithm` 字段分支
- [x] `npx jest --no-coverage` 全部通过
- [x] `npm run typecheck` 无错误

# Phase 4: README 优化

- [x] README 包含目录索引
- [x] 旧架构（ReviewModes 8种组合）描述已移除或压缩
- [x] 架构描述突出 SchedulingAlgorithm × InteractionStyle 核心设计
- [x] 包含关键设计决策和经验总结
- [x] 包含数据迁移说明
- [x] 无冗余的旧格式字段描述

# Phase 5: 清理验证

- [x] `npx jest --no-coverage` 全部通过
- [x] `npm run typecheck` 无错误
- [x] 全局搜索无残留 `ReviewModes`、`reviewMode`、`LEGACY_MODE_TO_CONFIG` 引用（迁移工具除外）
- [x] 无不必要的临时测试文件
