# Roam-Memo 系统性 UX 审查与重构 Spec

## Why

当前系统经过多次迭代和补丁式开发，已积累显著的技术债务和架构腐化：核心组件 PracticeOverlay.tsx 达到 1723 行（God Component），8 种 ReviewMode 将调度算法与交互方式耦合在一起导致认知过载，设置 UI 存在两套重复实现，Props Drilling 严重（20+ props），Today 模型过度追踪 10+ 字段。需要从第一性原理出发审查系统是否真正以最简洁、有效的方式解决用户核心需求——"记住我标记的重要内容"。

## What Changes

- **解构 God Component**：将 PracticeOverlay.tsx 拆分为独立组件（SettingsDialog、HistoryCleanup、Header、TagSelector、LineByLineReview 区域）
- **解耦调度算法与交互方式**：将 8 种 ReviewMode 重构为 2 个独立维度（Algorithm × InteractionStyle），消除 _LBL 后缀模式
- **统一设置 UI**：合并两套设置界面为单一组件，消除 DRY 违规
- **简化数据流**：用 Context/Provider 模式替代 Props Drilling，消除 sessionOverrides 并行数据结构
- **精简 Today 模型**：减少冗余追踪字段，消除 restoreCompletedUids hack
- **清理遗留代码**：移除空 Set `CARD_META_SESSION_KEYS`、简化 legacyRoamSr 迁移路径

## Impact

- Affected specs: ReviewMode Architecture, Data Architecture, UI Component Architecture, Settings Architecture
- Affected code:
  - `src/models/session.ts` — ReviewMode 枚举重构、分类逻辑重写
  - `src/components/overlay/PracticeOverlay.tsx` — 拆分为多个独立组件
  - `src/components/overlay/Footer.tsx` — ReviewMode 选择器适配新架构
  - `src/app.tsx` — Props 简化、Context Provider 注入
  - `src/practice.ts` — generatePracticeData 适配新 ReviewMode
  - `src/queries/data.ts` — 数据解析适配新 ReviewMode
  - `src/queries/save.ts` — 数据持久化适配新 ReviewMode
  - `src/queries/today.ts` — Today 模型精简
  - `src/hooks/useSettings.ts` — 无重大变更
  - `src/constants.ts` — 移除空 Set
  - `src/settingsPanelConfig.tsx` — 统一设置 UI
  - `README.md` — 文档更新

---

## 审查分析报告

### 一、用户交互流程梳理

#### 流程 1：插件启动
```
用户加载 roam/js → onload() → 创建 inMemorySettings overlay → 
注入 z-index 修复 → 创建侧边栏容器 → ReactDOM.render(<App />)
```
**预期**：插件无感加载，侧边栏出现 "Review" 按钮
**实际**：启动流程合理，但 inMemorySettings overlay 是为 roam/js 模式的 hack，增加了认知负担

#### 流程 2：开始复习
```
点击 "Review" → refreshData() → fetchPracticeData() → 
打开 PracticeOverlay → 显示第一张卡片
```
**预期**：点击后立即看到待复习卡片
**实际**：数据获取是异步的，可能存在短暂空白状态

#### 流程 3：卡片复习（核心流程）
```
显示问题 → 点击 "Show Answer" → 显示答案 → 
选择评分（Forgot/Hard/Good/Perfect 或 Next）→ 
保存数据 → 显示下一张卡片
```
**预期**：流畅的复习体验，评分后立即看到下一张
**实际**：基本流畅，但 LBL/Incremental Read 模式下逻辑复杂，容易出 bug

#### 流程 4：切换复习模式
```
点击 Footer 中的模式下拉 → 选择新模式 → 
乐观更新 UI → 持久化到数据页 → fetchPracticeData() 刷新
```
**预期**：模式切换即时生效
**实际**：需要 fetchPracticeData() 刷新整个数据集，效率低

#### 流程 5：设置管理
```
点击齿轮图标 → 打开设置对话框 → 修改设置 → 
updateSetting() → extensionAPI + React state + debounced page sync
```
**预期**：设置修改即时生效且持久化
**实际**：存在两套设置 UI（roam/js 内联 vs Roam Depot settingsPanelConfig），维护负担大

### 二、第一性原理分析

#### 用户核心需求
**"记住我标记的重要内容"** — 仅此而已。

#### 最简解决方案需要什么？
1. **标记**：给块加标签（#memo）✅ 已有
2. **调度**：决定何时复习 ✅ 已有（SM2/Progressive）
3. **复习**：展示卡片、收集反馈 ✅ 已有
4. **记录**：保存复习结果 ✅ 已有

#### 当前系统超出最简方案的复杂度

| 维度 | 最简方案 | 当前实现 | 过度复杂度 |
|------|---------|---------|-----------|
| 调度算法 | 1-2 种（SM2 + 固定间隔） | 6 种（SM2, Progressive, Days, Weeks, Months, Years） | 中等 — 固定间隔子类型可合并 |
| 交互方式 | 1-2 种（普通 + 逐行） | 3 种（Normal, LBL, IncrementalRead） | 低 — 合理 |
| 模式组合 | 2×2=4 | 8 种预组合 | **高** — 算法×交互耦合 |
| 设置存储 | 1 层 | 3 层（extensionAPI + inMemory + page） | **高** — roam/js hack |
| 设置 UI | 1 套 | 2 套 | **高** — DRY 违规 |
| Today 追踪 | 3-4 字段 | 10+ 字段 | **高** — 过度追踪 |
| 组件结构 | 5-6 个组件 | 1 个 God Component + 少量子组件 | **高** — 严重腐化 |

### 三、具体问题识别

#### 问题 1：PracticeOverlay God Component（严重）
- **位置**：`src/components/overlay/PracticeOverlay.tsx`（1723 行）
- **问题**：单一组件包含复习逻辑、LBL 逻辑、Incremental Read 逻辑、设置对话框、历史清理、标签选择器、Header、Mode Badge、Status Badge、Breadcrumbs、移动端样式、表单状态管理
- **影响**：难以理解、难以测试、难以维护、修改风险高
- **第一性原理**：用户在复习时不需要同时看到设置对话框和历史清理功能

#### 问题 2：ReviewMode 算法与交互耦合（严重）
- **位置**：`src/models/session.ts`
- **问题**：8 种 ReviewMode 将两个正交概念耦合在一起：
  - 调度算法：SM2 / Progressive / Fixed(Days/Weeks/Months/Years)
  - 交互方式：Normal / LineByLine / IncrementalRead
  - 例如 `SPACED_INTERVAL_LBL` = SM2 算法 + LBL 交互
- **影响**：
  - 新增交互方式需要 N×M 种组合枚举
  - Footer 中的 REVIEW_MODE_OPTIONS 有 8 个选项，认知过载
  - `isLBLReviewMode` 只检查 `SpacedIntervalLBL`，遗漏了 Fixed 模式下的 LBL 场景
  - 模式切换时需要同时理解算法和交互两个维度
- **第一性原理**：用户应该独立选择"用什么算法复习"和"怎么复习这张卡"

#### 问题 3：双重设置 UI（中等）
- **位置**：`src/settingsPanelConfig.tsx` + `PracticeOverlay.tsx` 内联设置
- **问题**：两套完全独立的设置 UI 代码，渲染相同的设置项
- **影响**：任何设置变更需要同时修改两处，容易遗漏
- **第一性原理**：设置只有一套，UI 也应该只有一套

#### 问题 4：Props Drilling（中等）
- **位置**：`src/app.tsx` → `PracticeOverlay`
- **问题**：PracticeOverlay 接收 20+ props，大部分是 pass-through
- **影响**：组件接口复杂，重构困难
- **第一性原理**：组件应该只接收它直接需要的数据

#### 问题 5：Today 模型过度追踪（中等）
- **位置**：`src/models/practice.ts` + `src/queries/today.ts`
- **问题**：
  - 每个 tag 追踪 10 个字段（due, new, completed, completedDue, completedNew, dueUids, newUids, completedUids, completedDueUids, completedNewUids）
  - `restoreCompletedUids` 临时恢复已完成的 UIDs 用于 daily limit 算法，是明显的 hack
  - `calculateCombinedCounts` 被调用两次
- **影响**：数据模型臃肿，算法不清晰
- **第一性原理**：daily limit 只需要知道"还剩多少卡要复习"

#### 问题 6：Session Override 并行数据（中等）
- **位置**：`PracticeOverlay.tsx` 的 `sessionOverrides` state
- **问题**：为乐观更新创建的并行数据结构，需要与 `practiceData` 保持同步
- **影响**：数据一致性风险，合并逻辑复杂
- **第一性原理**：乐观更新应该是原始数据的增强，不是并行副本

#### 问题 7：遗留代码残留（低）
- **位置**：`src/constants.ts`
- **问题**：`CARD_META_SESSION_KEYS` 是空 Set，是 meta block 移除后的残留
- **影响**：代码噪音，新开发者困惑
- **第一性原理**：不用的代码应该删除

### 四、重构建议

#### 建议 1：解构 PracticeOverlay（优先级：高）

**当前**：
```
PracticeOverlay.tsx (1723 行)
├── 复习逻辑
├── LBL 逻辑
├── Incremental Read 逻辑
├── 设置对话框（内联）
├── 历史清理（内联）
├── Header（内联）
├── TagSelector（内联）
├── ModeBadge（内联）
├── StatusBadge（内联）
└── 移动端样式（内联）
```

**目标**：
```
PracticeOverlay.tsx (~200 行，编排器)
├── hooks/useLineByLineReview.ts (LBL + IncrementalRead 逻辑)
├── overlay/Header.tsx (Header + TagSelector + StatusBadge + ModeBadge)
├── overlay/SettingsDialog.tsx (统一设置 UI)
├── overlay/HistoryCleanup.tsx (历史清理)
└── overlay/LineByLineView.tsx (LBL/Read 卡片渲染)
```

#### 建议 2：解耦调度算法与交互方式（优先级：高）

**当前**：
```typescript
enum ReviewModes {
  SpacedInterval,        // SM2 + Normal
  SpacedIntervalLBL,     // SM2 + LBL
  FixedProgressive,      // Progressive + Normal
  FixedProgressiveLBL,   // Progressive + IncrementalRead
  FixedDays,             // FixedDays + Normal
  FixedWeeks,            // FixedWeeks + Normal
  FixedMonths,           // FixedMonths + Normal
  FixedYears,            // FixedYears + Normal
}
```

**目标**：
```typescript
enum SchedulingAlgorithm {
  SM2 = 'SM2',
  Progressive = 'PROGRESSIVE',
  FixedDays = 'FIXED_DAYS',
  FixedWeeks = 'FIXED_WEEKS',
  FixedMonths = 'FIXED_MONTHS',
  FixedYears = 'FIXED_YEARS',
}

enum InteractionStyle {
  Normal = 'NORMAL',
  LineByLine = 'LBL',
  IncrementalRead = 'READ',
}

// 卡片的复习配置 = 算法 + 交互方式
type ReviewConfig = {
  algorithm: SchedulingAlgorithm;
  interaction: InteractionStyle;
};
```

**向后兼容**：在数据加载时通过 `resolveReviewConfig` 将旧模式映射到新架构

#### 建议 3：统一设置 UI（优先级：中）

**当前**：两套独立设置 UI
**目标**：一个 `SettingsForm` 组件，在 Roam Depot 模式下通过 `settingsPanelConfig` 渲染，在 roam/js 模式下通过 Dialog 渲染

#### 建议 4：Context/Provider 替代 Props Drilling（优先级：中）

**当前**：App → PracticeOverlay（20+ props）
**目标**：
```typescript
<PracticeSessionProvider settings={settings} practiceData={practiceData} today={today}>
  <PracticeOverlay />
</PracticeSessionProvider>
```
PracticeOverlay 内部通过 `usePracticeSession()` 获取所需数据

#### 建议 5：精简 Today 模型（优先级：中）

**当前**：10 字段/tag + combinedToday
**目标**：
- 保留核心字段：due, new, dueUids, newUids, completed, renderMode
- 移除：completedDue, completedNew, completedDueUids, completedNewUids（可从 completedUids + 原始数据推导）
- 移除 `restoreCompletedUids` hack，改为在 daily limit 计算时直接使用原始 UID 列表

#### 建议 6：清理遗留代码（优先级：低）

- 移除 `CARD_META_SESSION_KEYS` 空 Set
- 考虑将 `legacyRoamSr.ts` 标记为 deprecated 或移至独立迁移工具

### 五、重构优先级与风险评估

| 优先级 | 重构项 | 风险 | 收益 |
|-------|--------|------|------|
| P0 | 解构 PracticeOverlay | 低（纯结构重组） | 高（可维护性大幅提升） |
| P0 | 解耦算法与交互 | 中（数据迁移 + 向后兼容） | 高（架构根本改善） |
| P1 | 统一设置 UI | 低 | 中（消除 DRY 违规） |
| P1 | Context/Provider | 低 | 中（简化数据流） |
| P2 | 精简 Today 模型 | 中（影响 daily limit 算法） | 中（减少复杂度） |
| P2 | 清理遗留代码 | 低 | 低（代码整洁） |

### 六、是否需要重构的结论

**需要重构，但分阶段进行。**

理由：
1. PracticeOverlay God Component 是最严重的问题，纯结构重组风险低收益高，应立即进行
2. 算法与交互解耦是架构层面的根本改善，但需要数据迁移，应谨慎进行
3. 其余项目可在日常维护中逐步改善

重构的核心原则：**每次只改一件事，改完验证通过后再改下一件。**

## ADDED Requirements

### Requirement: PracticeOverlay 组件解构

系统 SHALL 将 PracticeOverlay.tsx 拆分为独立组件和自定义 Hook，主组件不超过 300 行。

#### Scenario: 设置对话框独立
- **WHEN** 查看 PracticeOverlay 源码
- **THEN** 不包含设置对话框的 UI 渲染代码，设置对话框在独立的 `SettingsDialog.tsx` 中

#### Scenario: 历史清理独立
- **WHEN** 查看 PracticeOverlay 源码
- **THEN** 不包含历史清理的 UI 渲染代码，历史清理在独立的 `HistoryCleanup.tsx` 中

#### Scenario: LBL 逻辑独立
- **WHEN** 查看 PracticeOverlay 源码
- **THEN** 不包含 LBL/IncrementalRead 的评分逻辑，该逻辑在 `useLineByLineReview` Hook 中

#### Scenario: Header 独立
- **WHEN** 查看 PracticeOverlay 源码
- **THEN** Header 相关组件（TagSelector、StatusBadge、ModeBadge）在独立的 `Header.tsx` 中

### Requirement: 调度算法与交互方式解耦

系统 SHALL 将 ReviewMode 拆分为两个独立维度：SchedulingAlgorithm 和 InteractionStyle，消除 _LBL 后缀模式。

#### Scenario: 新枚举定义
- **WHEN** 查看 session.ts
- **THEN** 定义 `SchedulingAlgorithm` 枚举（SM2, PROGRESSIVE, FIXED_DAYS, FIXED_WEEKS, FIXED_MONTHS, FIXED_YEARS）和 `InteractionStyle` 枚举（NORMAL, LBL, READ）

#### Scenario: ReviewConfig 组合类型
- **WHEN** 查看卡片数据模型
- **THEN** 卡片的复习配置由 `algorithm` 和 `interaction` 两个字段组成，不再使用单一的 `reviewMode` 字段

#### Scenario: 向后兼容数据加载
- **WHEN** 加载旧数据中的 `reviewMode:: SPACED_INTERVAL_LBL`
- **THEN** 自动解析为 `algorithm: SM2, interaction: LBL`

#### Scenario: 向后兼容数据保存
- **WHEN** 保存卡片数据到 Roam 数据页
- **THEN** 使用新格式 `algorithm:: SM2` + `interaction:: LBL`，同时保留 `reviewMode:: SPACED_INTERVAL_LBL` 作为兼容字段

#### Scenario: Footer 模式选择器
- **WHEN** 用户在 Footer 中选择复习模式
- **THEN** 分别选择算法和交互方式，而非从 8 个预组合中选择

### Requirement: 统一设置 UI

系统 SHALL 使用单一 SettingsForm 组件渲染设置界面，在 Roam Depot 和 roam/js 模式下复用。

#### Scenario: 设置 UI 单一来源
- **WHEN** 查看 settingsPanelConfig.tsx 和 PracticeOverlay 设置对话框
- **THEN** 两者使用同一个 SettingsForm 组件渲染设置项

#### Scenario: 新增设置项
- **WHEN** 需要新增一个设置项
- **THEN** 只需修改 SettingsForm 一处

### Requirement: Context/Provider 数据流

系统 SHALL 使用 PracticeSessionContext 替代 Props Drilling，PracticeOverlay 不再接收 20+ props。

#### Scenario: PracticeOverlay props 数量
- **WHEN** 查看 PracticeOverlay 的 Props 接口
- **THEN** props 数量不超过 8 个

#### Scenario: 内部组件获取数据
- **WHEN** Footer 或 Header 需要访问复习数据
- **THEN** 通过 `usePracticeSession()` Hook 从 Context 获取

### Requirement: Today 模型精简

系统 SHALL 精简 Today 模型，移除冗余追踪字段和 restoreCompletedUids hack。

#### Scenario: Today tag 字段数
- **WHEN** 查看 Today 类型定义
- **THEN** 每个 tag 的字段数不超过 6 个（status, due, new, dueUids, newUids, renderMode, completed）

#### Scenario: restoreCompletedUids 移除
- **WHEN** 查看 today.ts
- **THEN** 不存在 `restoreCompletedUids` 函数

#### Scenario: calculateCombinedCounts 调用次数
- **WHEN** 查看 getPracticeData 流程
- **THEN** `calculateCombinedCounts` 只调用一次

### Requirement: 遗留代码清理

系统 SHALL 移除不再使用的遗留代码。

#### Scenario: CARD_META_SESSION_KEYS 移除
- **WHEN** 查看 constants.ts
- **THEN** 不存在 `CARD_META_SESSION_KEYS`

#### Scenario: save.ts 中 CARD_META_SESSION_KEYS 引用移除
- **WHEN** 查看 save.ts
- **THEN** 不引用 `CARD_META_SESSION_KEYS`

## MODIFIED Requirements

### Requirement: ReviewMode Resolution Pipeline

旧实现使用 8 种 ReviewModes 枚举值进行解析，现改为从 `algorithm` + `interaction` 两个独立字段解析。`resolveReviewMode` 改为 `resolveReviewConfig`，输入旧格式字符串时自动拆分为两个维度。

### Requirement: Footer ReviewMode 选择器

旧实现使用单一下拉选择 8 种预组合模式，现改为两个独立选择器：算法选择器 + 交互方式选择器。

## REMOVED Requirements

### Requirement: _LBL 后缀 ReviewMode 枚举值
**Reason**: SPACED_INTERVAL_LBL 和 FIXED_PROGRESSIVE_LBL 将调度算法与交互方式耦合，违反正交设计原则
**Migration**: 旧数据中的 _LBL 值通过 resolveReviewConfig 自动拆分为 algorithm + interaction
