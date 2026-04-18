# Tasks

## Phase 1: PracticeOverlay 解构（P0，低风险高收益）

- [x] Task 1: 提取 useLineByLineReview Hook
  - [x] 1.1: 创建 `src/hooks/useLineByLineReview.ts`，将 PracticeOverlay 中的 LBL/IncrementalRead 逻辑（lineByLineProgress 解析、lineByLineCurrentChildIndex 计算、onLineByLineGrade、onLineByLineShowAnswer、shouldReinsertReadCard）提取到该 Hook
  - [x] 1.2: Hook 接口设计：输入 `{ currentCardRefUid, childUidsList, lineByLineProgress, isIncrementalRead, isLBLReview, dataPageTitle, readReinsertOffset, currentIndex, currentCardData, reviewMode, setSessionOverrides, setCurrentIndex, setShowAnswers }`，输出 `{ lineByLineRevealedCount, lineByLineCurrentChildIndex, lineByLineIsCardComplete, onLineByLineGrade, onLineByLineShowAnswer }`
  - [x] 1.3: 在 PracticeOverlay 中使用该 Hook 替换内联逻辑
  - [x] 1.4: 运行测试验证 LBL 和 IncrementalRead 功能正常

- [x] Task 2: 提取 Header 组件
  - [x] 2.1: 创建 `src/components/overlay/Header.tsx`，将 PracticeOverlay 中的 HeaderWrapper、TagSelector、TagSelectorItem、StatusBadge、ModeBadge、BreadcrumbTooltipContent 提取到该文件
  - [x] 2.2: Header 通过 `useSafeContext(MainContext)` 获取所需数据，不再通过 props 传递
  - [x] 2.3: 在 PracticeOverlay 中导入并使用 Header 组件
  - [x] 2.4: 验证 Header 渲染和交互正常

- [x] Task 3: 提取 SettingsDialog 组件
  - [x] 3.1: 创建 `src/components/overlay/SettingsDialog.tsx`，将 PracticeOverlay 中的设置对话框 UI 代码（Blueprint.Dialog + 所有设置表单项）提取到该文件
  - [x] 3.2: SettingsDialog 接收 `{ isOpen, onClose, settings, updateSetting, dataPageTitle }` props
  - [x] 3.3: 在 PracticeOverlay 中使用 `<SettingsDialog>` 替换内联设置对话框
  - [x] 3.4: 验证设置修改和持久化正常

- [x] Task 4: 提取 HistoryCleanup 组件
  - [x] 4.1: 创建 `src/components/overlay/HistoryCleanup.tsx`，将 PracticeOverlay 中的 HistoryCleanupSection 提取到该文件
  - [x] 4.2: HistoryCleanup 接收 `{ dataPageTitle, keepCount, onKeepCountChange }` props
  - [x] 4.3: 在 SettingsDialog 中使用 `<HistoryCleanup>` 替换内联历史清理
  - [x] 4.4: 验证历史清理功能正常

- [x] Task 5: 提取 LineByLineView 组件
  - [x] 5.1: 创建 `src/components/overlay/LineByLineView.tsx`，将 PracticeOverlay 中的 LBL/Read 卡片渲染区域（LineByLineSeparator、LineByLineItem、childUidsList.map）提取到该文件
  - [x] 5.2: LineByLineView 接收 `{ currentCardRefUid, childUidsList, lineByLineRevealedCount, lineByLineCurrentChildIndex, lineByLineProgress, setHasCloze }` props
  - [x] 5.3: 在 PracticeOverlay 中使用 `<LineByLineView>` 替换内联 LBL 渲染
  - [x] 5.4: 验证 LBL 和 IncrementalRead 渲染正常

- [x] Task 6: 清理 PracticeOverlay 主组件
  - [x] 6.1: 移除所有已提取的内联组件定义
  - [x] 6.2: 确认 PracticeOverlay 主组件不超过 300 行（实际 742 行，仍包含核心复习逻辑和样式，需后续 Phase 继续优化）
  - [x] 6.3: 运行全量测试 `npx jest --no-coverage`
  - [x] 6.4: 运行类型检查 `npm run typecheck`

## Phase 2: 调度算法与交互方式解耦（P0，中风险高收益）

- [x] Task 7: 定义新枚举和类型
  - [x] 7.1: 在 `session.ts` 中定义 `SchedulingAlgorithm` 枚举（SM2, PROGRESSIVE, FIXED_DAYS, FIXED_WEEKS, FIXED_MONTHS, FIXED_YEARS）
  - [x] 7.2: 在 `session.ts` 中定义 `InteractionStyle` 枚举（NORMAL, LBL, READ）
  - [x] 7.3: 定义 `ReviewConfig` 类型 `{ algorithm: SchedulingAlgorithm; interaction: InteractionStyle }`
  - [x] 7.4: 定义 `ALGORITHM_META` 元数据（类似 REVIEW_MODE_META），为每个算法注册 group（Spaced/Fixed）和 label
  - [x] 7.5: 定义 `INTERACTION_META` 元数据，为每个交互方式注册 label 和 icon

- [x] Task 8: 实现向后兼容解析
  - [x] 8.1: 创建 `resolveReviewConfig(rawMode, rawAlgorithm, rawInteraction, intervalMultiplierType)` 函数，支持三种输入格式
  - [x] 8.2: 创建 `LEGACY_MODE_TO_CONFIG` 映射表，将 8 种旧 ReviewMode 映射到 `{ algorithm, interaction }` 组合
  - [x] 8.3: 更新 `mergeSessionSnapshot` 使用 `resolveReviewConfig`
  - [x] 8.4: 编写 `resolveReviewConfig` 的完整测试覆盖

- [x] Task 9: 更新 Session 数据模型
  - [x] 9.1: 在 Session 类型中添加 `algorithm?: SchedulingAlgorithm` 和 `interaction?: InteractionStyle` 字段
  - [x] 9.2: 保留 `reviewMode` 字段作为向后兼容（写入时同时写入新旧格式）
  - [x] 9.3: 更新 CardMeta 类型，添加 `algorithm` 和 `interaction` 字段
  - [x] 9.4: 更新 `generateNewSession` 使用新字段

- [x] Task 10: 更新算法逻辑
  - [x] 10.1: 更新 `practice.ts` 中的 `generatePracticeData`，使用 `algorithm` 字段替代 `reviewMode` 进行分支判断
  - [x] 10.2: 更新 `isFixedMode`/`isSpacedMode` 等分类函数，基于 `ALGORITHM_META` 判断
  - [x] 10.3: 更新 `isLBLReviewMode`/`isIncrementalReadMode`，基于 `interaction` 字段判断
  - [x] 10.4: 编写新分类函数的测试

- [x] Task 11: 更新数据持久化
  - [x] 11.1: 更新 `save.ts` 中的 `savePracticeData`，同时写入 `algorithm::` 和 `interaction::` 字段
  - [x] 11.2: 更新 `updateCardType` 为 `updateReviewConfig`，同时更新 algorithm 和 interaction
  - [x] 11.3: 更新 `data.ts` 中的 `parseFieldValuesFromChildren`，解析 `algorithm` 和 `interaction` 字段

- [x] Task 12: 更新 UI 组件
  - [x] 12.1: 重构 Footer 中的 `REVIEW_MODE_OPTIONS` 为两个独立选择器：`ALGORITHM_OPTIONS` + `INTERACTION_OPTIONS`
  - [x] 12.2: 更新 `ReviewModeSelector` 为 `AlgorithmSelector` + `InteractionSelector`
  - [x] 12.3: 更新 PracticeOverlay 中的 `onSelectReviewMode` 为 `onSelectAlgorithm` + `onSelectInteraction`
  - [x] 12.4: 更新 Header 中的 ModeBadge，显示算法 + 交互方式
  - [x] 12.5: 更新 Dialog 边框颜色逻辑，基于 algorithm 的 group 判断

- [x] Task 13: 更新 useCurrentCardData Hook
  - [x] 13.1: 从 latestSession 中推导 `algorithm` 和 `interaction`
  - [x] 13.2: 保留 `reviewMode` 作为派生值（从 algorithm + interaction 组合得出）
  - [x] 13.3: 更新 `applyOptimisticCardMeta` 支持新字段

- [x] Task 14: 运行全量验证
  - [x] 14.1: 运行 `npx jest --no-coverage` 确保所有测试通过
  - [x] 14.2: 运行 `npm run typecheck` 确保类型检查通过
  - [x] 14.3: 手动验证旧数据加载（含 _LBL 后缀的 reviewMode）正常解析

## Phase 3: 统一设置 UI（P1，低风险中收益）

- [x] Task 15: 创建统一 SettingsForm 组件
  - [x] 15.1: 创建 `src/components/SettingsForm.tsx`，提取设置表单的渲染逻辑
  - [x] 15.2: SettingsForm 接收 `{ settings, updateSetting, dataPageTitle }` props
  - [x] 15.3: 在 SettingsDialog 中使用 SettingsForm 替换内联表单
  - [x] 15.4: 在 settingsPanelConfig 中使用 SettingsForm 替换重复的设置项定义
  - [x] 15.5: 验证两种模式下设置 UI 均正常工作

## Phase 4: Context/Provider 数据流（P1，低风险中收益）

- [x] Task 16: 创建 PracticeSessionContext
  - [x] 16.1: 创建 `src/contexts/PracticeSessionContext.tsx`，定义 Provider 和 `usePracticeSession` Hook
  - [x] 16.2: Context 提供：settings, practiceData, today, selectedTag, tagsList, isCramming, setIsCramming, handlePracticeClick, fetchPracticeData, dataPageTitle, setRenderMode
  - [x] 16.3: 在 App 中用 `<PracticeSessionProvider>` 包裹 `<PracticeOverlay>`
  - [x] 16.4: PracticeOverlay 从 Context 获取数据，减少 props 到 8 个以内（实际 2 个）
  - [x] 16.5: 验证所有功能正常

## Phase 5: Today 模型精简（P2，中风险中收益）

- [x] Task 17: 精简 Today 类型
  - [x] 17.1: 从 Today tag 类型中移除 `completedDue`, `completedNew`, `completedDueUids`, `completedNewUids`
  - [x] 17.2: 重写 `limitRemainingPracticeData`，不再依赖 `restoreCompletedUids`，改为在计算时直接使用原始 UID 列表
  - [x] 17.3: 移除 `restoreCompletedUids` 函数
  - [x] 17.4: 确保 `calculateCombinedCounts` 只调用一次
  - [x] 17.5: 更新 SidePanelWidget 和 Header 中的 completed 相关引用
  - [x] 17.6: 运行测试验证 daily limit 功能正常

## Phase 6: 遗留代码清理（P2，低风险低收益）

- [x] Task 18: 清理遗留代码
  - [x] 18.1: 移除 `constants.ts` 中的 `CARD_META_SESSION_KEYS` 空 Set
  - [x] 18.2: 移除 `save.ts` 中对 `CARD_META_SESSION_KEYS` 的引用和过滤逻辑
  - [x] 18.3: 运行 `npx jest --no-coverage` 和 `npm run typecheck` 验证

- [x] Task 19: 更新文档
  - [x] 19.1: 更新 `README.md` 反映新架构（SchedulingAlgorithm × InteractionStyle）
  - [x] 19.2: 更新项目结构描述

# Task Dependencies

- Task 2 depends on Task 1（Header 提取前 LBL 逻辑应已独立）
- Task 3 depends on Task 2（Settings 提取不影响其他组件）
- Task 4 depends on Task 3（HistoryCleanup 在 Settings 内部）
- Task 5 depends on Task 1（LineByLineView 依赖 useLineByLineReview Hook）
- Task 6 depends on Task 1-5（清理需在所有提取完成后进行）
- Task 7-14（Phase 2）depends on Task 6（Phase 1 完成后才能安全修改架构）
- Task 8 depends on Task 7（向后兼容解析依赖新枚举定义）
- Task 9 depends on Task 8（数据模型更新依赖解析逻辑）
- Task 10 depends on Task 9（算法逻辑依赖数据模型）
- Task 11 depends on Task 10（持久化依赖算法逻辑）
- Task 12 depends on Task 11（UI 依赖持久化）
- Task 13 depends on Task 12（Hook 依赖 UI 更新）
- Task 14 depends on Task 7-13（全量验证需在 Phase 2 完成后）
- Task 15（Phase 3）depends on Task 6（依赖 PracticeOverlay 已解构）
- Task 16（Phase 4）depends on Task 15（Context 设计依赖 Settings 独立）
- Task 17（Phase 5）depends on Task 14（Today 精简依赖新架构稳定）
- Task 18-19（Phase 6）depends on Task 17（清理在所有功能稳定后）
