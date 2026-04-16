# Roam Memo 主题系统说明

## 设计原则

**简单直接** - 所有颜色自动从 Roam body 继承，无需复杂的 JS 注入逻辑。

## 工作原理

### 1. 自动继承（核心机制）

Roam Research 在 `<body>` 元素上设置背景色和文字颜色，我们的组件通过 CSS `inherit` 自动继承这些颜色：

```tsx
const Dialog = styled(Blueprint.Dialog)`
  /* 背景和文字颜色自动从 Roam body 继承 */
  /* 支持 light/dark/auto 所有主题模式 */
`;
```

### 2. 功能性颜色（theme.ts）

只有需要明确定义的颜色才在 `theme.ts` 中声明：

```typescript
export const colors = {
  // 按钮半透明遮罩
  overlayLight: 'rgba(128, 128, 128, 0.08)',
  overlayLightHover: 'rgba(128, 128, 128, 0.12)',

  // 填空题遮罩（固定值）
  clozeHidden: '#e1e3e5',

  // 边框颜色
  borderSubtle: 'rgba(128, 128, 128, 0.15)',

  // 卡片模式指示颜色（与 intent 颜色对齐，用于 ModeBadge 和 Dialog 边框）
  modeSpaced: 'var(--roam-success-color, #56d364)', // Spaced 模式 = 绿色 = 与 "New" 标签一致
  modeFixed: 'var(--roam-warning-color, #d29922)', // Fixed 模式 = 橙色 = 与 "Past Due" 标签一致
  modeReading: 'var(--roam-warning-color, #d29922)', // Read 模式 = 橙色 = 与 Fixed 模式一致

  // 逐行复习边框颜色
  lineByLineCurrentBorder: 'var(--roam-success-color, #56d364)',
  lineByLineMasteredBorder: 'rgba(128, 128, 128, 0.15)',
};

// Intent 颜色映射（使用 Roam CSS 变量）
export const intentColors = {
  primary: 'var(--roam-primary-color, #8cb4ff)',
  success: 'var(--roam-success-color, #56d364)',
  warning: 'var(--roam-warning-color, #d29922)',
  danger: 'var(--roam-danger-color, #f85149)',
};
```

### 3. 主题适配流程

```
Roam Body (rs-light/rs-dark/rs-auto)
    ↓ CSS inherit
Dialog 容器
    ↓ CSS inherit
Header / Footer / CardBlock
    ↓ 使用 intent 颜色
Buttons (primary/success/warning/danger)
    ↓ 使用模式颜色
ModeBadge (success=Spaced / warning=Fixed / warning=Read)
Dialog 边框 (modeSpaced / modeFixed / modeReading)
```

## 文件结构

```
src/
├── theme.ts              # 唯一的颜色定义文件（含 modeSpaced/modeFixed/modeReading 与逐行复习边框变量）
├── app.tsx               # 主应用（无主题相关逻辑）
└── components/overlay/
    ├── PracticeOverlay.tsx  # Dialog 继承背景色 + 动态边框颜色（基于 reviewMode）
    ├── Footer.tsx           # 按钮使用 intent 颜色
    └── CardBlock.tsx        # 填空题遮罩使用固定色
```

## 关键改动

### ✅ 简化前

- JS 动态读取 body 颜色并注入 CSS
- MutationObserver 监听主题变化
- 手动处理 rs-light/rs-dark/rs-auto
- 多处使用 `!important` 覆盖样式

### ✅ 简化后

- 纯 CSS `inherit` 自动继承
- 零 JS 主题逻辑
- 只在必要时使用 `!important`（移动端全屏、Blueprint 覆盖）
- 单一数据源：`theme.ts`

## 2026-04-16 更新摘要

### 功能结论

- 修复 Incremental Read 插队后继续阅读的行为时，主题系统没有新增新的分支逻辑
- 阅读模式重新插回当前会话队列后，仍继续复用既有的 `modeReading`、`lineByLineCurrentBorder`、`lineByLineMasteredBorder` 样式变量
- 当读到最后一行时不再插队，这一规则只影响队列与数据流，不改变任何主题继承链路

### 样式变量结论

- **未新增样式变量**
- 继续复用 `modeReading` 作为 Incremental Read 的模式色
- 继续复用 `borderSubtle` 作为通用边框回退色
- 继续复用 `lineByLineCurrentBorder` / `lineByLineMasteredBorder` 作为逐行阅读与逐行复习的行状态边框色

### 架构结论

- 本次修复重点在会话快照继承与队列推进，不在视觉层新增实体
- 主题系统继续遵守“能继承就继承，只把功能色放进 `theme.ts`”的原则
- 数据层恢复“读取最新 session 即可得到完整当前状态”后，模式徽标和边框依旧只依赖既有的 `reviewMode` → 颜色映射，不需要新增主题适配代码

## 2026-04-14 更新摘要

- 逐行复习的当前行高亮和已掌握行边框改为统一复用 `theme.ts` 中的样式变量
- 新增 `lineByLineCurrentBorder` 与 `lineByLineMasteredBorder` 两个样式变量，分别用于当前行和已掌握行的左侧边框
- 这次修复没有引入新的主题机制，仍然遵守"能继承就继承，只把功能色放进主题文件"的原则
- 新增 `Show Review Mode Borders` 设置项，允许关闭模式边框显示；关闭后仍回退到统一的 subtle border，不改变主题继承模型
- 逐行复习只在 `Spaced Interval Mode` 下激活，因此 `Fixed Interval Mode` 仍保持整卡展开的阅读体验，不新增额外主题分支
- 新增"复习模式字段推断"修复后，模式徽标与边框继续复用既有的 `modeSpaced` / `modeFixed` 颜色变量，无需新增样式变量
- 当实时轮询读到缺失 `reviewMode::` 但仍包含 SM2 字段的卡片时，UI 现在会自动显示为 `Spaced Interval Mode`，从而让模式颜色与实际数据保持一致
- 本次与主题系统相关的结论是：未新增任何新的样式变量，仍然优先使用现有颜色令牌和继承机制
- 补充修复：`getCardScopedFields()` 现在会删除 `reviewMode` 字段，防止 meta 块覆盖会话级别的模式推断；`mapPluginPageData()` 现在按 `:block/order` 排序会话，确保 `sessions[sessions.length - 1]` 始终是最新的会话记录

## 2026-04-15 更新摘要

### 架构优化

- `reviewMode` 确立为 meta 块唯一数据源，session 记录不再包含 `reviewMode::`
- `nextDueDate` 确立为 meta 块唯一数据源，session 记录不再包含 `nextDueDate::`，避免不同模式间 nextDueDate 冗余写入造成的混乱
- `CARD_META_SESSION_KEYS` 扩展为 `reviewMode` + `nextDueDate`，`lineByLineReview` 和 `lineByLineProgress` 由专门函数管理
- 运行时移除所有向后兼容推理代码（`cardType` 映射、`legacyCardMetadataBlocks` 回退、`inferReviewModeFromFields` 运行时推理）
- `getCardScopedFields` 只从 meta 块读取，无 meta 则返回空
- 设置统一：`showBreadcrumbs` 从 `useSettings` 统一传递，消除 PracticeOverlay 内部双源

### 模式独立性与数据继承

- **核心修复**：Progressive 模式不再递增 SM2 的 `repetitions`，不再覆盖 `interval` 和 `eFactor`
- **全量继承**：每个模式只计算/修改自己的字段，其他字段从上一次 session 原样继承
  - SM2 模式计算字段：`grade`, `interval`, `repetitions`, `eFactor`；继承字段：`progressiveRepetitions`, `intervalMultiplier`
  - Progressive 模式计算字段：`progressiveRepetitions`, `intervalMultiplier`；继承字段：`interval`, `repetitions`, `eFactor`
  - Fixed Days/Weeks/Months/Years 计算字段：`intervalMultiplier`；继承字段：`interval`, `repetitions`, `eFactor`, `progressiveRepetitions`
- `savePracticeData` 新增 `undefined` 值过滤，避免将未定义字段写入 session 记录
- 此修复确保用户在模式间自由切换时，每个模式的数据字段不会丢失或被其他模式污染

### Progressive 算法独立化

- 提取 `progressiveInterval()` 为独立函数，明确其与 SM2 无关
- 修复间隔计算 BUG：旧公式 `6 × 2^(n-2)` 导致 progReps=2 时间隔为 6（与 progReps=1 重复），修正为 `6 × 2^(n-1)`
- 正确递进序列：2 → 6 → 12 → 24 → 48 → 96 天
- 函数签名：`progressiveInterval(progressiveRepetitions: number): number`

### 性能优化：Meta-Only 轮询

- `useCurrentCardData` 轮询从 `getPluginPageData({ limitToLatest: true })` 改为 `getCardMetaOnly()`
- 新增 `getCardMetaOnly()` 轻量查询函数，只读取 meta 块，不解析 session 记录
- 轮询仅更新 `cardMeta`（reviewMode, nextDueDate 等），不再更新 `currentCardData`
- `reviewMode` 解析增加 fallback：cardMeta → latestSession.reviewMode → DEFAULT_REVIEW_MODE
- 移除不再使用的 `isSessionDataChanged`、`extractCardMetaFromPluginData` 函数

### Settings 实时保存

- Settings 对话框新增 500ms debounce 自动保存，设置变更即时持久化
- 移除 "Apply & Close" 和 "Cancel" 按钮，关闭对话框即完成
- 首次加载跳过自动保存（避免覆盖已加载数据）

### 新增功能：增量阅读模式（Incremental Read）

- 新增 `FIXED_PROGRESSIVE_LBL` 模式，用于长文章逐行阅读
- 新增 `modeReading` 样式变量：`var(--roam-primary-color, #8cb4ff)`（蓝色）
- ModeBadge 新增 **Read** 标签（蓝色，使用 `intent="primary"`）
- Dialog 边框在阅读模式下显示蓝色
- `Footer.tsx` 新增 `ReadingModeControls` 组件（Read + Next 按钮）
- 阅读模式每个子块独立 Progressive 间隔，共享 `lineByLineProgress` 数据结构
- `LineByLineChildData` 新增可选字段 `progressiveRepetitions`

### 数据迁移工具更新

- `MigrateLegacyDataPanel` 支持三项迁移：cardType→reviewMode 重命名、补充缺失 reviewMode、清理 session 冗余 reviewMode
- 迁移工具保留 `inferReviewModeFromFields` 和 `resolveReviewMode` 用于推理（仅迁移工具使用）

### 性能优化

- 轮询间隔从 1000ms 优化为 2000ms
- 移除 `isRendered` 未使用状态
- 修复 `useSettings` 面板重复创建问题
- 修复 `calculateCombinedCounts` 重复调用

## 常见问题

### Q: 为什么不用 CSS 变量？

A: 已经在使用了！`intentColors` 使用 `var(--roam-primary-color)` 等 Roam 原生变量。

### Q: 填空题遮罩为什么硬编码 #e1e3e5？

A: 这是设计规范要求的固定浅灰色，不随主题变化，确保可读性。

### Q: 移动端为什么要用 !important？

A: 必须覆盖 Blueprint.js 的默认样式以实现全屏效果，这是必要的。

### Q: modeReading 为什么用橙色？

A: Incremental Read 模式基于 Progressive 间隔算法，与 Fixed 模式同属"固定间隔"体系，因此统一使用橙色。绿色（Spaced）代表 SM2 自适应间隔，橙色（Fixed/Read）代表固定间隔体系，形成双色区分。

## 维护指南

### 添加新颜色

在 `theme.ts` 中添加：

```typescript
export const colors = {
  // ...existing colors
  myNewColor: 'var(--roam-some-variable, #fallback)',
};
```

### 修改按钮颜色

使用 intent 系统：

```tsx
<ControlButton intent="primary">Primary Button</ControlButton>
<ControlButton intent="success">Success Button</ControlButton>
```

### 调试主题问题

1. 检查 Roam body 是否有正确的类名（rs-light/rs-dark）
2. 确认组件没有显式设置 `background-color`
3. 浏览器 DevTools 检查 computed styles

## 技术细节

### Blueprint.js 兼容性

- Dialog 背景：通过 CSS inherit 自动适配
- Button intent：使用 `getIntentColor()` 映射到 Roam 颜色
- Popover/Tooltip：继承父容器样式

### 移动端特殊处理

- 背景层透明化（允许点击穿透）
- 全屏定位（覆盖 Blueprint 默认行为）
- safe-area-inset 适配底部工具栏

---

**最后更新**: 2026-04-16
**简化目标**: 移除过度工程化，保持简单直接

## 2026-04-15 (v2) 更新摘要

### 统一数据架构：移除 meta 块

- 移除 `CARD_META_BLOCK_NAME` 常量和 `getCardScopedFields()` 函数
- 所有字段（reviewMode, nextDueDate, lineByLineProgress, grade, eFactor 等）统一存储在 session block 中
- 最新 session block 是卡片的唯一数据源
- `CARD_META_SESSION_KEYS` 清空为 `Set([])`，所有字段直接写入 session 记录
- `savePracticeData` 不再将 reviewMode/nextDueDate 路由到 meta 块，而是直接写入 session block
- `updateCardType` 改为在最新 session block 中 upsert reviewMode
- `updateLineByLineProgress` 改为在最新 session block 中 upsert lineByLineProgress 和 nextDueDate

### 移除 lineByLineReview 字段

- `lineByLineReview:: Y` 不再存储，LBL 功能完全由 reviewMode 值编码
- `SPACED_INTERVAL_LBL` = SM2 逐行复习模式
- `FIXED_PROGRESSIVE_LBL` = 渐进阅读模式（Incremental Read）
- `isLineByLineMode` 仅包含 `SPACED_INTERVAL_LBL`（逐行复习）
- `isReadingMode` 仅包含 `FIXED_PROGRESSIVE_LBL`（渐进阅读）

### 移除轮询功能

- 移除 `useCurrentCardData` 中的 2 秒轮询逻辑
- 移除 `getCardMetaOnly()` 函数
- `cardMeta` 从 `latestSession` 初始化，不再需要轮询 meta 块
- 保留 `applyOptimisticCardMeta` 用于用户切换模式时的即时 UI 反馈

### 边框颜色统一

- `modeReading` 从蓝色改为橙色（`var(--roam-warning-color, #d29922)`）
- Incremental Read 与 Fixed 模式同属固定间隔体系，统一使用橙色
- ModeBadge 的 Read 标签从 `intent="primary"` 改为 `intent="warning"`
- Dialog 边框逻辑简化：Spaced=绿色，Fixed/Read=橙色

### 数据迁移工具更新

- `MigrateLegacyDataPanel` 新增 meta 块合并功能：
  - 将 meta 块中的 reviewMode、nextDueDate、lineByLineProgress 写入最新 session block
  - 删除 meta 块
  - 将 `lineByLineReview:: Y` 转换为对应的 LBL reviewMode

## 2026-04-15 (v3) 更新摘要

### ESC 快捷键关闭 Memo 窗口

- 使用 Blueprint.js 原生 `canEscapeKeyClose={true}` 替代自定义 hotkey
- Blueprint 的 Dialog 组件内部维护 overlay 栈，按 ESC 时只会关闭栈顶的那个
- 设置对话框打开时 ESC 关闭设置对话框，关闭后 ESC 关闭主窗口

### Incremental Read 插队功能

- 为 Incremental Read 模式添加与 "Forgot" 功能相同的本次会话插队机制
- 每次点击 "Next" 按钮时，当前卡片自动插队到后续卡片序列中
- 新增 `readReinsertOffset` 设置项（默认值 3），功能逻辑与 `forgotReinsertOffset` 一致
- 当值为 0 时表示本次会话不执行插队操作
- **Bug1 修复**：在 `onLineByLineGrade` 的 reading 分支中添加了 reinsertion 逻辑，确保 Incremental Read 模式下点击 Next 后卡片正确插队
- `Settings` 类型新增 `readReinsertOffset: number` 字段
- `SETTING_TYPES` 新增 `readReinsertOffset: 'number'` 类型映射
- `queries/settings.ts` 新增 `readReinsertOffset` 的保存和加载逻辑

### 事件驱动刷新（替代轮询）

- `onSelectReviewMode` 在 `updateCardType` 持久化后调用 `fetchPracticeData()` 刷新数据
- 数据流：用户切换模式 → applyOptimisticCardMeta (即时 UI) → updateCardType (持久化) → fetchPracticeData (刷新)
- `PracticeOverlay` 新增 `fetchPracticeData` prop，由 `app.tsx` 传入
- 无论是翻页回来还是插队卡片重新出现，practiceData 中都已经是最新的模式数据

### Settings 自动保存优化

- 自动保存 debounce 间隔从 500ms 调整为 300ms

### Settings 布局调整

- 将 "Right-to-Left (RTL) Enabled" 和 "Shuffle Cards" 两项移至设置页面最末尾
- 设置项顺序：Tag Pages → Data Page Title → Daily Limit → Forgot Reinsert → Read Reinsert → Show Breadcrumbs → Show Mode Borders → Data Migration → History Cleanup → RTL → Shuffle Cards

### 历史数据清理功能

- 新增 `HistoryCleanupSection` 组件，位于 Memo Settings 对话框中
- 用户可自定义保留的历史数据数量（默认值 3），系统仅保留每张卡片最近的 N 个日期 session block
- 实现"Start Cleanup"按钮，点击后执行清理操作，删除超过指定数量的过期日期 block
- 清理过程显示进度提示（已处理卡片数/总数，已删除 block 数），完成后提供操作结果反馈
- 采用批量处理策略（每 20 张卡片暂停 2 秒），避免 API 限流
- 清理操作不可撤销，界面有明确提示
- 所有 UI 文本使用英文

### 修复重复 reviewMode:: 字段

- `upsertLatestSessionField` 的 Datalog pull 查询增加一层子 block 拉取深度
- 修复前：日期 block 的子 block（字段 block）未被拉取，导致 `latestDateBlock.children` 为 `undefined`，每次都创建新字段
- 修复后：查询能正确找到已存在的字段 block 并执行更新（`updateBlock`），而非重复创建

### 修复 FIXED_PROGRESSIVE_LBL 未进入逐行阅读模式

- 引入 `isLineByLineUI = isLineByLine || isReading`，表示"需要逐行 UI 展示"
- 所有 UI 渲染和逻辑条件统一使用 `isLineByLineUI`
- Incremental Read 模式差异化行为：
  - `lineByLineRevealedCount` 初始化为 `firstDueIndex + 1`（自动揭示第一个子 block）
  - `showAnswers` 初始为 `true`（直接显示 "Next" 按钮）

### Footer aria-label 英文化

- 将 `aria-label="上一页"` 改为 `aria-label="Previous"`
- 将 `aria-label="下一页"` 改为 `aria-label="Next"`

### 新增样式变量

- 本次未新增任何样式变量，所有 UI 复用现有 `colors` 和 `intentColors` 体系
