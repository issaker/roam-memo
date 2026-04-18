# Tasks

- [x] Task 1: 重构 session.ts 模式元数据与判断函数
  - [x] 1.1: 定义 `REVIEW_MODE_META` 元数据对象，为每个 ReviewModes 值注册 group（Spaced/Fixed/Reading）、label、icon
  - [x] 1.2: 基于 `REVIEW_MODE_META` 重写 `isFixedMode`，使用 `meta.group === 'Fixed' || meta.group === 'Reading'` 替代 6 个 `||`
  - [x] 1.3: 基于 `REVIEW_MODE_META` 重写 `isSpacedMode`，使用 `meta.group === 'Spaced'` 替代硬编码
  - [x] 1.4: 删除 `isSM2LBLMode` 和 `isProgressiveLBLMode` 别名导出
  - [x] 1.5: 将 `LEGACY_REVIEW_MODE_MAP` 和内联 `subModeMap` 合并为统一的 `LEGACY_MODE_RESOLUTION` 映射表
  - [x] 1.6: 重写 `resolveReviewMode`，使用 `LEGACY_MODE_RESOLUTION` 替代内联映射
  - [x] 1.7: 将 `inferReviewModeFromFields` 和 `hasReviewModeClues` 从 `data.ts` 移入 `session.ts` 并导出
  - [x] 1.8: 将 `SPACED_MODE_KEYS` 和 `FIXED_MODE_KEYS` 常量从 `data.ts` 移入 `session.ts`

- [x] Task 2: 更新 data.ts 导入与引用
  - [x] 2.1: 删除 `data.ts` 中的 `inferReviewModeFromFields` 和 `hasReviewModeClues` 定义
  - [x] 2.2: 删除 `data.ts` 中的 `SPACED_MODE_KEYS` 和 `FIXED_MODE_KEYS` 常量
  - [x] 2.3: 从 `~/models/session` 导入 `inferReviewModeFromFields` 和 `hasReviewModeClues`
  - [x] 2.4: 更新 `mergeSessionSnapshot` 中的调用（无需改动，函数签名不变）

- [x] Task 3: 更新外部消费者导入路径
  - [x] 3.1: 更新 `MigrateLegacyDataPanel.tsx` 中 `inferReviewModeFromFields` 的导入路径：从 `~/queries/data` 改为 `~/models/session`
  - [x] 3.2: 更新 `data.test.ts` 中 `inferReviewModeFromFields` 的导入路径

- [x] Task 4: 创建 session.test.ts 识别管线完整测试
  - [x] 4.1: `resolveReviewMode` 测试：全 8 种枚举值、旧版映射（FIXED_INTERVAL、SPACED_INTERVAL）、旧版 + intervalMultiplierType 子模式、边界值（undefined、空字符串、未知值）
  - [x] 4.2: `inferReviewModeFromFields` 测试：显式 reviewMode 全 8 种值、SM2 字段推断、Fixed 字段推断、无线索默认值、旧版 reviewMode + intervalMultiplierType 组合
  - [x] 4.3: `hasReviewModeClues` 测试：SM2 字段、Fixed 字段、空对象、混合字段
  - [x] 4.4: `isFixedMode` / `isSpacedMode` / `isLBLReviewMode` / `isIncrementalReadMode` 全枚举值矩阵测试
  - [x] 4.5: `REVIEW_MODE_META` 一致性测试：每个 ReviewModes 枚举值在 META 中均有注册，group 值合法

- [x] Task 5: 更新 data.test.ts
  - [x] 5.1: 删除已移至 `session.test.ts` 的 `resolveReviewMode` 测试块
  - [x] 5.2: 删除已移至 `session.test.ts` 的 `inferReviewModeFromFields` 测试块
  - [x] 5.3: 更新 `inferReviewModeFromFields` 导入路径为 `~/models/session`

- [x] Task 6: 更新文档
  - [x] 6.1: 更新 `README.md` 中 ReviewMode Resolution Pipeline 章节，反映元数据驱动架构和函数归属变更
  - [x] 6.2: 确认 `THEME_SYSTEM.md` 无需变更（本次重构不涉及样式变量）

- [x] Task 7: 运行全量测试验证
  - [x] 7.1: 运行 `npx jest --no-coverage` 确保所有测试通过
  - [x] 7.2: 运行 `npm run typecheck` 确保类型检查通过

# Task Dependencies

- Task 2 depends on Task 1（data.ts 需要从 session.ts 导入移入的函数）
- Task 3 depends on Task 1（外部消费者需要从新路径导入）
- Task 4 depends on Task 1（测试需要验证重构后的代码）
- Task 5 depends on Task 1, Task 4（需要更新导入路径并迁移测试）
- Task 6 depends on Task 1（文档需反映最终架构）
- Task 7 depends on Task 1-6（全量验证需在所有修改完成后进行）
