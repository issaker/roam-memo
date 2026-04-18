# Phase 1: PracticeOverlay 解构

- [x] `useLineByLineReview.ts` Hook 已创建，包含 LBL/IncrementalRead 全部评分逻辑
- [x] PracticeOverlay 中不再有 `onLineByLineGrade`、`onLineByLineShowAnswer`、`shouldReinsertReadCard` 的内联定义
- [x] `Header.tsx` 组件已创建，包含 TagSelector、StatusBadge、ModeBadge、BreadcrumbTooltipContent
- [x] PracticeOverlay 中不再有 HeaderWrapper、TagSelector、TagSelectorItem、StatusBadge、ModeBadge 的内联定义
- [x] `SettingsDialog.tsx` 组件已创建，包含所有设置表单项
- [x] PracticeOverlay 中不再有设置对话框的 Blueprint.Dialog 渲染代码
- [x] `HistoryCleanup.tsx` 组件已创建，包含历史清理 UI 和逻辑
- [x] SettingsDialog 中使用 `<HistoryCleanup>` 而非内联清理代码
- [x] `LineByLineView.tsx` 组件已创建，包含 LBL/Read 卡片渲染区域
- [x] PracticeOverlay 中不再有 LineByLineSeparator、LineByLineItem 的内联定义
- [ ] PracticeOverlay 主组件不超过 300 行
- [ ] `npx jest --no-coverage` 全部通过
- [x] `npm run typecheck` 无错误

# Phase 2: 调度算法与交互方式解耦

- [x] `SchedulingAlgorithm` 枚举已定义（SM2, PROGRESSIVE, FIXED_DAYS, FIXED_WEEKS, FIXED_MONTHS, FIXED_YEARS）
- [x] `InteractionStyle` 枚举已定义（NORMAL, LBL, READ）
- [x] `ReviewConfig` 类型已定义（`{ algorithm, interaction }`）
- [x] `ALGORITHM_META` 元数据已定义，为每个算法注册 group 和 label
- [x] `INTERACTION_META` 元数据已定义，为每个交互方式注册 label 和 icon
- [x] `resolveReviewConfig` 函数已实现，支持新格式、旧格式、无格式三种输入
- [x] `LEGACY_MODE_TO_CONFIG` 映射表已创建，8 种旧 ReviewMode 均有映射
- [x] `mergeSessionSnapshot` 使用 `resolveReviewConfig` 而非 `resolveReviewMode`
- [x] Session 类型包含 `algorithm` 和 `interaction` 可选字段
- [x] CardMeta 类型包含 `algorithm` 和 `interaction` 可选字段
- [x] `generatePracticeData` 基于 `algorithm` 字段分支判断
- [x] `isFixedMode`/`isSpacedMode` 基于 `ALGORITHM_META` 判断
- [x] `isLBLReviewMode`/`isIncrementalReadMode` 基于 `interaction` 字段判断
- [x] `savePracticeData` 同时写入 `algorithm::` 和 `interaction::` 字段
- [x] `updateCardType` 更新为 `updateReviewConfig`，同时更新 algorithm 和 interaction
- [x] Footer 中 `REVIEW_MODE_OPTIONS` 替换为 `ALGORITHM_OPTIONS` + `INTERACTION_OPTIONS`
- [x] Footer 中有两个独立选择器：AlgorithmSelector + InteractionSelector
- [x] Header 中 ModeBadge 显示算法 + 交互方式信息
- [x] Dialog 边框颜色基于 algorithm 的 group 判断
- [x] useCurrentCardData 从 latestSession 推导 algorithm 和 interaction
- [x] 旧数据（含 _LBL 后缀的 reviewMode）加载后正确解析为 algorithm + interaction
- [ ] `npx jest --no-coverage` 全部通过
- [x] `npm run typecheck` 无错误

# Phase 3: 统一设置 UI

- [x] `SettingsForm.tsx` 组件已创建，包含所有设置表单渲染逻辑
- [x] SettingsDialog 使用 SettingsForm 渲染设置项
- [x] settingsPanelConfig 使用 SettingsForm 渲染设置项（Roam Depot 模式）
- [x] 新增设置项只需修改 SettingsForm 一处
- [x] 两种模式下设置 UI 功能一致

# Phase 4: Context/Provider 数据流

- [x] `PracticeSessionContext.tsx` 已创建，包含 Provider 和 `usePracticeSession` Hook
- [x] App 中用 `<PracticeSessionProvider>` 包裹 `<PracticeOverlay>`
- [x] PracticeOverlay 的 Props 接口不超过 8 个 props
- [x] Footer 和 Header 通过 `usePracticeSession()` 获取数据
- [x] 所有功能正常工作（复习、评分、模式切换、设置修改）

# Phase 5: Today 模型精简

- [x] Today tag 类型中不存在 `completedDue`, `completedNew`, `completedDueUids`, `completedNewUids` 字段
- [x] `restoreCompletedUids` 函数已移除
- [x] `calculateCombinedCounts` 在 `getPracticeData` 中只调用一次
- [x] daily limit 功能正常工作
- [x] SidePanelWidget 和 Header 中 completed 相关引用已更新

# Phase 6: 遗留代码清理

- [x] `constants.ts` 中不存在 `CARD_META_SESSION_KEYS`
- [x] `save.ts` 中不引用 `CARD_META_SESSION_KEYS`
- [ ] `npx jest --no-coverage` 全部通过
- [x] `npm run typecheck` 无错误
- [x] README.md 已更新反映新架构
