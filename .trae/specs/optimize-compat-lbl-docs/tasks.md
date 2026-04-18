# Tasks

## Phase 1: LBL Forgot 重插入（独立功能，无依赖）

- [x] Task 1: 实现 LBL Forgot 重插入逻辑
  - [x] 1.1: 在 `useLineByLineReview.ts` 中，LBL Review 分支的 `onLineByLineGrade` 回调里增加 forgot 重插入逻辑：当 `grade === 0 && forgotReinsertOffset > 0` 时，将整张 LBL 卡片（`currentCardRefUid`）插入到 `currentIndex + 1 + forgotReinsertOffset` 位置
  - [x] 1.2: Hook 输入增加 `forgotReinsertOffset: number` 参数
  - [x] 1.3: 在 PracticeOverlay.tsx 中传递 `forgotReinsertOffset` 给 `useLineByLineReview`
  - [x] 1.4: 编写测试验证 LBL forgot 重插入行为
  - [x] 1.5: 运行 `npx jest --no-coverage` 和 `npm run typecheck` 验证

## Phase 2: 数据迁移工具升级（需在移除旧代码前完成）

- [x] Task 2: 升级 MigrateLegacyDataPanel
  - [x] 2.1: 迁移工具增加 Phase：将旧 `reviewMode::` 字段转换为 `algorithm::` + `interaction::` 字段，写入到最新 session 块
  - [x] 2.2: 迁移完成后删除旧的 `reviewMode::` 字段块
  - [x] 2.3: 增加迁移前确认对话框，说明将要执行的操作
  - [x] 2.4: 增加详细日志记录：每个卡片的迁移结果（成功/跳过/失败）记录到控制台
  - [x] 2.5: 增强错误处理：单个卡片失败不中断整体迁移，最终报告失败数量和详情
  - [x] 2.6: 迁移工具增加"扫描"功能：先扫描有多少卡片需要迁移，显示预览信息后再执行
  - [x] 2.7: 运行 `npx jest --no-coverage` 和 `npm run typecheck` 验证

## Phase 3: 移除运行时旧格式兼容代码（依赖 Phase 2 完成）

- [x] Task 3: 简化 resolveReviewConfig
  - [x] 3.1: 移除 `resolveReviewConfig` 中的旧格式回退逻辑（rawMode 分支、intervalMultiplierType 推断分支），仅保留 `algorithm` + `interaction` 直接读取
  - [x] 3.2: 移除 `resolveReviewMode`、`inferReviewModeFromFields`、`hasReviewModeClues`、`LEGACY_MODE_RESOLUTION`、`REVIEW_MODE_VALUES` 函数/常量
  - [x] 3.3: 更新 `mergeSessionSnapshot` 使用简化后的 `resolveReviewConfig`
  - [x] 3.4: 更新相关测试
  - [x] 3.5: 运行 `npx jest --no-coverage` 和 `npm run typecheck` 验证

- [x] Task 4: 移除 ReviewModes 枚举和相关映射
  - [x] 4.1: 移除 `ReviewModes` 枚举、`REVIEW_MODE_META`、`DEFAULT_REVIEW_MODE`
  - [x] 4.2: 移除 `LEGACY_MODE_TO_CONFIG`、`CONFIG_TO_LEGACY_MODE`、`reviewConfigToLegacyMode`
  - [x] 4.3: 移除 `isFixedMode`/`isSpacedMode` 中的 `ReviewModes` 参数支持，仅接受 `SchedulingAlgorithm`
  - [x] 4.4: 移除 `isLBLReviewMode`/`isIncrementalReadMode` 中的 `ReviewModes` 参数支持，仅接受 `InteractionStyle`
  - [x] 4.5: 更新所有引用这些函数的调用方
  - [x] 4.6: 运行 `npx jest --no-coverage` 和 `npm run typecheck` 验证

- [x] Task 5: 移除旧格式数据写入
  - [x] 5.1: `savePracticeData` 不再写入 `reviewMode::` 字段，仅写入 `algorithm::` + `interaction::`
  - [x] 5.2: `updateReviewConfig` 不再写入 `reviewMode::` 兼容字段
  - [x] 5.3: 移除 `updateCardType` 别名导出
  - [x] 5.4: `data.ts` 中 `parseFieldValuesFromChildren` 不再解析 `reviewMode` 字段
  - [x] 5.5: `SESSION_SNAPSHOT_KEYS` 移除 `reviewMode`
  - [x] 5.6: 运行 `npx jest --no-coverage` 和 `npm run typecheck` 验证

- [x] Task 6: 更新 Session/CardMeta 类型
  - [x] 6.1: Session 类型移除 `reviewMode: ReviewModes` 必填字段，`algorithm` 和 `interaction` 改为必填
  - [x] 6.2: CardMeta 类型移除 `reviewMode` 字段
  - [x] 6.3: `generateNewSession` 移除 `reviewMode` 参数，改用 `algorithm` + `interaction`
  - [x] 6.4: 更新 `useCurrentCardData.tsx`，移除 `reviewMode` 派生逻辑
  - [x] 6.5: 更新 PracticeOverlay 中所有 `reviewMode` 引用
  - [x] 6.6: 更新 Footer 移除 `onSelectReviewMode` 和 `reviewMode` 相关逻辑
  - [x] 6.7: 运行 `npx jest --no-coverage` 和 `npm run typecheck` 验证

- [x] Task 7: 更新 practice.ts 算法逻辑
  - [x] 7.1: `generatePracticeData` 完全基于 `algorithm` 字段分支，移除 `reviewMode` 回退
  - [x] 7.2: `practice` 函数移除 `reviewMode` 参数传递
  - [x] 7.3: 运行 `npx jest --no-coverage` 和 `npm run typecheck` 验证

## Phase 4: README 优化（可与 Phase 3 并行）

- [x] Task 8: 优化 README
  - [x] 8.1: 添加目录索引
  - [x] 8.2: 压缩非必要技术描述，移除旧架构（ReviewModes 8种组合）的详细描述
  - [x] 8.3: 强化架构描述：突出 SchedulingAlgorithm × InteractionStyle 核心设计
  - [x] 8.4: 添加关键设计决策和经验总结（如：为什么从 ReviewModes 迁移到 Algorithm × Interaction）
  - [x] 8.5: 添加数据迁移说明（如何使用迁移工具）
  - [x] 8.6: 移除冗余的旧格式字段描述

## Phase 5: 清理验证

- [x] Task 9: 全量验证和清理
  - [x] 9.1: 运行 `npx jest --no-coverage` 全部通过
  - [x] 9.2: 运行 `npm run typecheck` 无错误
  - [x] 9.3: 全局搜索确认无残留的 `ReviewModes`、`reviewMode`、`LEGACY_MODE_TO_CONFIG` 引用（迁移工具除外）
  - [x] 9.4: 清理不再需要的测试文件和临时文件

# Task Dependencies

- Task 1 (LBL Forgot) — 无依赖，可独立进行
- Task 2 (迁移工具升级) — 无依赖，可独立进行
- Task 3-7 (移除旧代码) — 依赖 Task 2（迁移工具必须先支持新格式写入）
- Task 3 depends on nothing within Phase 3
- Task 4 depends on Task 3（移除枚举前需先简化解析）
- Task 5 depends on Task 4（移除写入前需先移除枚举）
- Task 6 depends on Task 5（类型更新依赖写入逻辑更新）
- Task 7 depends on Task 6（算法逻辑依赖类型更新）
- Task 8 (README) — 可与 Phase 3 并行
- Task 9 (验证) — 依赖 Task 7 和 Task 8
