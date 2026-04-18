# DailyNote 特殊牌堆 & Memo 设置保存机制修改 Spec

## Why

1. **DailyNote 牌堆**：用户在 Roam Research 中通过 DailyNote 记录大量内容，这些内容目前无法作为复习卡片直接使用。需要一个特殊牌堆将所有 DailyNote 页面的一级 block 聚合为卡片，利用已有的间隔重复系统进行复习。
2. **设置保存机制**：当前 Memo 设置采用实时保存（每次修改立即写入 extensionAPI + 调度页面同步），这可能导致队列错误和设置即时应用带来的风险。需要改为显式保存机制，确保设置变更在用户确认后才生效。

## What Changes

### DailyNote 牌堆
- 新增 `dailynoteEnabled: boolean` 设置项（默认 `true`），控制 DailyNote 牌堆的启用状态
- 新增 Roam Datalog 查询函数 `getDailyNoteBlockUids()`，获取所有 DailyNote 页面的非空一级 block UID
- 在 `useTags` 中，当 `dailynoteEnabled` 为 `true` 时，将 `"DailyNote"` 作为虚拟牌堆追加到 `tagsList` 末尾
- 在 `getSessionData` 中，对 `"DailyNote"` 牌堆使用专用查询逻辑替代常规的 `getPageReferenceIds` + `getSelectedTagPageBlocksIds`
- 在 Header 的 TagSelector 中，`"DailyNote"` 牌堆显示在列表底部，带日历图标区分
- 复用现有的三级优先级排序系统（urgency-based sorting），无需开发新的排序机制
- 复用现有的 new/due 分类逻辑，无需修改 `addNewCards` / `addDueCards`

### Memo 设置保存机制
- **BREAKING**：移除 SettingsForm 中所有 `onChange → updateSetting` 的实时保存调用
- SettingsForm 改为纯表单状态管理，通过 `React.useImperativeHandle` 暴露 `getSettings()` 方法
- SettingsDialog 底部新增两个按钮："Apply & Close" 和 "Close"
- "Apply & Close"：保存所有设置 → 关闭设置对话框 → 关闭 PracticeOverlay（要求用户手动重新打开插件窗口）
- "Close"：丢弃所有未保存的更改 → 关闭设置对话框（不影响 PracticeOverlay）
- settingsPanelConfig（Roam Depot 面板）同步更新，适配新的 SettingsForm 接口

## Impact

- Affected specs: Settings Architecture, Multi Deck Support, Data Architecture
- Affected code:
  - `src/hooks/useSettings.ts` — 新增 `dailynoteEnabled` 设置项
  - `src/hooks/useTags.tsx` — 追加 DailyNote 虚拟牌堆
  - `src/queries/data.ts` — `getSessionData` 处理 DailyNote 特殊逻辑
  - `src/queries/utils.ts` — 新增 `getDailyNoteBlockUids` 查询函数
  - `src/components/SettingsForm.tsx` — 移除实时保存，暴露 getSettings
  - `src/components/overlay/SettingsDialog.tsx` — 新增按钮，实现 apply/close 逻辑
  - `src/components/overlay/Header.tsx` — DailyNote 牌堆图标显示
  - `src/components/overlay/PracticeOverlay.tsx` — 传递 onApplyAndClose 回调
  - `src/settingsPanelConfig.tsx` — 适配新 SettingsForm 接口
  - `src/queries/settings.ts` — 新增 `dailynoteEnabled` 持久化字段
  - `src/constants.ts` — 新增 `DAILYNOTE_DECK_KEY` 常量
  - `README.md` — 更新功能描述和设置架构文档
  - `THEME_SYSTEM.md` — 确认无需变更（本次不涉及样式变量）

## ADDED Requirements

### Requirement: DailyNote 特殊牌堆

系统 SHALL 提供一个名为 "DailyNote" 的特殊牌堆，将用户在 Roam Research 中创建的所有 DailyNote 页面的一级 block 聚合为复习卡片。

#### Scenario: 启用 DailyNote 牌堆
- **GIVEN** 用户在 Memo 设置中启用了 DailyNote 牌堆（默认启用）
- **WHEN** 用户打开 PracticeOverlay 的牌堆选择器
- **THEN** "DailyNote" 牌堆显示在牌堆列表底部，带有日历图标标识

#### Scenario: DailyNote 牌堆内容获取
- **GIVEN** 用户在 Roam Research 中有多个 DailyNote 页面
- **WHEN** 系统获取 "DailyNote" 牌堆的卡片数据
- **THEN** 所有 DailyNote 页面的非空一级 block UID 被聚合为该牌堆的卡片列表
- **AND** 这些卡片的 session 数据从数据页按现有逻辑查找（有 session 数据为 due 卡，无则为 new 卡）

#### Scenario: DailyNote 牌堆卡片排序
- **GIVEN** DailyNote 牌堆中存在 due 卡和 new 卡
- **WHEN** 系统计算今日复习队列
- **THEN** due 卡按现有三级优先级排序（nextDueDate → eFactor → repetitions）
- **AND** new 卡按现有逻辑排序（reverse creation order 或 shuffle）

#### Scenario: 禁用 DailyNote 牌堆
- **GIVEN** 用户在 Memo 设置中禁用了 DailyNote 牌堆
- **WHEN** 用户打开 PracticeOverlay 的牌堆选择器
- **THEN** "DailyNote" 牌堆不出现在牌堆列表中

#### Scenario: DailyNote 牌堆与常规牌堆的卡片重叠
- **GIVEN** 一个 block 同时被 `#memo` 标签引用且属于某个 DailyNote 页面
- **WHEN** 系统计算复习队列
- **THEN** 该 block 同时出现在 `memo` 牌堆和 `DailyNote` 牌堆中
- **AND** 两个牌堆中该卡片的 session 数据是同一份（共享数据页上的同一记录）

### Requirement: DailyNote 牌堆设置开关

系统 SHALL 在 Memo 设置中提供一个复选框选项，用于控制 DailyNote 牌堆的启用状态。

#### Scenario: 设置默认值
- **WHEN** 用户首次安装或重置设置
- **THEN** `dailynoteEnabled` 默认为 `true`

#### Scenario: 设置持久化
- **WHEN** 用户更改 `dailynoteEnabled` 设置并保存
- **THEN** 该设置通过 extensionAPI 和数据页持久化，下次启动时恢复

### Requirement: Memo 设置显式保存机制

系统 SHALL 移除 Memo 设置中的实时保存机制，改为显式保存。

#### Scenario: 修改设置但不保存
- **GIVEN** 用户打开 Memo 设置对话框
- **WHEN** 用户修改了若干设置项，然后点击 "Close" 按钮
- **THEN** 所有修改被丢弃，设置对话框关闭
- **AND** PracticeOverlay 继续使用修改前的设置运行
- **AND** 再次打开设置对话框时，显示修改前的原始值

#### Scenario: 修改设置并保存
- **GIVEN** 用户打开 Memo 设置对话框
- **WHEN** 用户修改了若干设置项，然后点击 "Apply & Close" 按钮
- **THEN** 所有修改被保存到 extensionAPI 和数据页
- **AND** 设置对话框关闭
- **AND** PracticeOverlay 关闭
- **AND** 用户需要手动重新打开插件窗口以使新设置完全生效

#### Scenario: 设置表单状态隔离
- **GIVEN** 用户打开 Memo 设置对话框并修改了设置
- **WHEN** 用户在表单中输入但未点击任何按钮
- **THEN** 表单显示用户输入的值（本地状态）
- **AND** extensionAPI 和数据页中的设置值未改变

## MODIFIED Requirements

### Requirement: Settings Architecture

原设置架构采用实时保存（每次修改立即写入 extensionAPI + debounced 页面同步）。修改为：

- SettingsForm 不再在 onChange 中调用 `updateSetting`
- 设置仅在用户点击 "Apply & Close" 时批量保存
- 保存流程：遍历 formSettings 中所有字段 → 逐个调用 `updateSetting` → 关闭对话框 → 关闭 PracticeOverlay
- 卸载时的 flush 机制保持不变，确保 debounced 页面同步在组件卸载时完成

### Requirement: Multi Deck Support

原牌堆系统仅支持 `tagsListString` 中定义的标签牌堆。修改为：

- 除标签牌堆外，新增 "DailyNote" 虚拟牌堆
- `useTags` 在解析 `tagsListString` 后，根据 `dailynoteEnabled` 设置决定是否追加 "DailyNote"
- `getSessionData` 对 "DailyNote" 牌堆使用专用查询逻辑
- 牌堆选择器 UI 对 "DailyNote" 牌堆显示日历图标以区分常规牌堆

## REMOVED Requirements

### Requirement: Settings Real-time Save
**Reason**: 实时保存可能导致队列错误和设置即时应用风险，改为显式保存更安全
**Migration**: 用户需适应新的 "Apply & Close" / "Close" 按钮交互模式，不再有即时保存行为
