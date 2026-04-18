# ReviewMode 识别模块系统性重构 Spec

## Why

`resolveReviewMode` 中使用 `in` 操作符检查 TypeScript 字符串枚举值，导致 8 种模式中 6 种（`SPACED_INTERVAL_LBL`、`FIXED_PROGRESSIVE_LBL`、`FIXED_DAYS`、`FIXED_WEEKS`、`FIXED_MONTHS`、`FIXED_YEARS`）在重启会话后被错误回退为 `FIXED_PROGRESSIVE`。此 bug 暴露出识别模块存在系统性设计缺陷：模式判断函数硬编码、推断逻辑无法区分子模式、测试覆盖严重不足、冗余别名未使用。需要系统性重构，而非继续打补丁。

## What Changes

- 将 `isFixedMode` 从 6 个 `||` 硬编码改为元数据驱动的分组查找
- 将 `inferReviewModeFromFields` 从 `data.ts` 移至 `session.ts`，与 `resolveReviewMode` 形成完整的识别管线
- 删除未使用的冗余别名 `isSM2LBLMode`、`isProgressiveLBLMode`
- 将 `LEGACY_REVIEW_MODE_MAP` 和 `intervalMultiplierType` 子模式映射合并为统一的旧版兼容层
- 将 `hasReviewModeClues` 移至 `session.ts` 并导出，使识别管线完整内聚
- 创建独立的 `session.test.ts` 测试文件，覆盖识别管线的所有路径
- 补充 `data.test.ts` 中 `inferReviewModeFromFields` 的子模式推断测试
- 更新 `README.md` 和 `THEME_SYSTEM.md` 文档

## Impact

- Affected specs: ReviewMode Resolution Pipeline, Data Architecture
- Affected code:
  - `src/models/session.ts` — 核心重构文件：模式判断函数、识别管线、元数据
  - `src/queries/data.ts` — 移除 `inferReviewModeFromFields` 和 `hasReviewModeClues`，改为从 `session.ts` 导入
  - `src/queries/data.test.ts` — 更新导入路径，补充子模式推断测试
  - `src/models/session.test.ts` — 新建：识别管线完整测试
  - `src/components/MigrateLegacyDataPanel.tsx` — 更新 `inferReviewModeFromFields` 导入路径
  - `README.md` — 更新 ReviewMode Resolution Pipeline 文档
  - `THEME_SYSTEM.md` — 无需变更（本次重构不涉及样式变量）

## ADDED Requirements

### Requirement: 模式元数据驱动判断

系统 SHALL 使用模式元数据（`REVIEW_MODE_META`）驱动所有模式分类判断，而非硬编码的 `||` 链。

#### Scenario: isFixedMode 判断
- **WHEN** 调用 `isFixedMode(mode)` 传入任意 `ReviewModes` 值
- **THEN** 当 mode 属于 Fixed 分组（`FIXED_PROGRESSIVE`、`FIXED_PROGRESSIVE_LBL`、`FIXED_DAYS`、`FIXED_WEEKS`、`FIXED_MONTHS`、`FIXED_YEARS`）时返回 `true`，否则返回 `false`

#### Scenario: isSpacedMode 判断
- **WHEN** 调用 `isSpacedMode(mode)` 传入任意 `ReviewModes` 值
- **THEN** 当 mode 属于 Spaced 分组（`SPACED_INTERVAL`、`SPACED_INTERVAL_LBL`）时返回 `true`，否则返回 `false`

#### Scenario: 新增模式时无需修改判断函数
- **WHEN** 在 `ReviewModes` 枚举中新增一个模式值并在 `REVIEW_MODE_META` 中注册其分组
- **THEN** `isFixedMode`/`isSpacedMode` 等判断函数自动正确工作，无需修改函数体

### Requirement: 识别管线内聚

系统 SHALL 将 reviewMode 识别管线的所有函数（`resolveReviewMode`、`inferReviewModeFromFields`、`hasReviewModeClues`）集中在 `session.ts` 中，作为单一职责的模块。

#### Scenario: data.ts 不再定义识别函数
- **WHEN** 查看 `data.ts` 源码
- **THEN** 不包含 `inferReviewModeFromFields` 或 `hasReviewModeClues` 的定义，改为从 `session.ts` 导入

#### Scenario: MigrateLegacyDataPanel 导入路径更新
- **WHEN** `MigrateLegacyDataPanel.tsx` 需要使用 `inferReviewModeFromFields`
- **THEN** 从 `~/models/session` 导入，而非 `~/queries/data`

### Requirement: 旧版兼容层统一

系统 SHALL 将 `LEGACY_REVIEW_MODE_MAP` 和 `intervalMultiplierType` 子模式映射合并为单一的 `LEGACY_MODE_RESOLUTION` 映射表，消除 `resolveReviewMode` 中的内联 `subModeMap`。

#### Scenario: 旧版 FIXED_INTERVAL + intervalMultiplierType 解析
- **WHEN** `resolveReviewMode('FIXED_INTERVAL', 'Days')` 被调用
- **THEN** 返回 `ReviewModes.FixedDays`

#### Scenario: 旧版 FIXED_INTERVAL 无 intervalMultiplierType
- **WHEN** `resolveReviewMode('FIXED_INTERVAL')` 被调用
- **THEN** 返回 `ReviewModes.FixedProgressive`

### Requirement: 独立完整测试文件

系统 SHALL 在 `src/models/session.test.ts` 中提供识别管线的完整测试覆盖。

#### Scenario: resolveReviewMode 全枚举值测试
- **WHEN** 对 `ReviewModes` 的每个枚举值调用 `resolveReviewMode`
- **THEN** 均返回对应的正确枚举值，不回退到默认值

#### Scenario: resolveReviewMode 旧版兼容测试
- **WHEN** 传入旧版模式名（`FIXED_INTERVAL`、旧版 `SPACED_INTERVAL`）
- **THEN** 正确映射到当前枚举值

#### Scenario: resolveReviewMode 边界测试
- **WHEN** 传入 `undefined`、空字符串、未知字符串
- **THEN** 返回 `DEFAULT_REVIEW_MODE`

#### Scenario: inferReviewModeFromFields 显式模式测试
- **WHEN** 传入包含 `reviewMode` 字段的对象
- **THEN** 通过 `resolveReviewMode` 正确解析，包括所有 8 种模式值

#### Scenario: inferReviewModeFromFields 字段推断测试
- **WHEN** 传入不含 `reviewMode` 但含 SM2 字段的对象
- **THEN** 返回 `ReviewModes.SpacedInterval`

#### Scenario: inferReviewModeFromFields 无线索默认测试
- **WHEN** 传入空对象
- **THEN** 返回 `ReviewModes.FixedProgressive`

#### Scenario: hasReviewModeClues 测试
- **WHEN** 传入含 SM2 字段或 Fixed 字段的对象
- **THEN** 返回 `true`；传入空对象返回 `false`

#### Scenario: isFixedMode / isSpacedMode / isLBLReviewMode / isIncrementalReadMode 全枚举值测试
- **WHEN** 对每个 `ReviewModes` 值调用各判断函数
- **THEN** 返回结果与 `REVIEW_MODE_META` 分组定义一致

## MODIFIED Requirements

### Requirement: resolveReviewMode 枚举值查找

旧实现使用 `rawMode in ReviewModes`（检查枚举键名），现改为 `REVIEW_MODE_VALUES.has(rawMode)`（检查枚举值集合）。此修改已在先前完成，本次重构保留此修复并纳入元数据驱动架构。

### Requirement: inferReviewModeFromFields 所属模块

旧实现在 `data.ts` 中定义并导出，现改为在 `session.ts` 中定义并导出。`data.ts` 和 `MigrateLegacyDataPanel.tsx` 的导入路径需相应更新。

## REMOVED Requirements

### Requirement: isSM2LBLMode 别名
**Reason**: `isSM2LBLMode` 是 `isLBLReviewMode` 的别名，全项目无任何外部使用，增加认知负担
**Migration**: 如有外部代码使用（实际无），替换为 `isLBLReviewMode`

### Requirement: isProgressiveLBLMode 别名
**Reason**: `isProgressiveLBLMode` 是 `isIncrementalReadMode` 的别名，全项目无任何外部使用，增加认知负担
**Migration**: 如有外部代码使用（实际无），替换为 `isIncrementalReadMode`
