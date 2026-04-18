# 系统审查与对齐计划

## 一、系统全景：算法 × 卡片模式 × 数据字段

### 1.1 间隔重复算法（SchedulingAlgorithm）

| 算法 | 分组 | 核心函数 | 数据字段 | 间隔计算方式 |
|------|------|----------|----------|-------------|
| `SM2` | Spaced | `supermemo()` | `sm2_grade`, `sm2_interval`, `sm2_repetitions`, `sm2_eFactor` | `interval × eFactor × (grade/5)` |
| `PROGRESSIVE` | Fixed | `progressiveInterval()` | `progressive_repetitions`, `progressive_interval` | 固定曲线 2→6→12→24→48→96 |
| `FIXED_DAYS` | Fixed | 乘法计算 | `fixed_multiplier` | `multiplier × 1` 天 |
| `FIXED_WEEKS` | Fixed | 乘法计算 | `fixed_multiplier` | `multiplier × 7` 天 |
| `FIXED_MONTHS` | Fixed | 乘法计算 | `fixed_multiplier` | `multiplier × 30` 天 |
| `FIXED_YEARS` | Fixed | 乘法计算 | `fixed_multiplier` | `multiplier × 365` 天 |

### 1.2 卡片交互模式（InteractionStyle）

| 模式 | 描述 | 数据字段 |
|------|------|----------|
| `NORMAL` | 整张卡翻页复习 | 无专属字段 |
| `LBL` | 逐行复习 | `lbl_progress`（JSON，存储每行子block进度） |

### 1.3 通用/配置字段（无前缀）

| 字段 | 用途 |
|------|------|
| `algorithm` | 当前卡片的调度算法 |
| `interaction` | 当前卡片的交互模式 |
| `nextDueDate` | 下次到期日期 |
| `dateCreated` | session 创建日期 |

### 1.4 Session 数据字段完整清单

```
SESSION_SNAPSHOT_KEYS = [
  'algorithm',              // 通用
  'interaction',            // 通用
  'nextDueDate',            // 通用
  'lbl_progress',           // LBL 专属
  'sm2_repetitions',        // SM2 专属
  'sm2_interval',           // SM2 专属
  'sm2_eFactor',            // SM2 专属
  'sm2_grade',              // SM2 专属
  'progressive_repetitions', // Progressive 专属
  'progressive_interval',   // Progressive 专属
  'fixed_multiplier',       // Fixed 专属
]
```

### 1.5 LBL 子block进度数据（`lbl_progress` JSON 内部结构）

```typescript
LineByLineChildData = {
  nextDueDate: string;           // 通用
  sm2_interval?: number;         // SM2 专属（LBL+SM2时填充）
  sm2_repetitions?: number;      // SM2 专属
  sm2_eFactor?: number;          // SM2 专属
  progressive_repetitions?: number; // Progressive 专属（LBL+Fixed时填充）
}
```

### 1.6 插队（Reinsert）机制

| 触发场景 | 触发条件 | 使用的设置 | 设置默认值 |
|----------|----------|-----------|-----------|
| NORMAL + SM2: "Forgot" | `sm2_grade === 0` | `forgotReinsertOffset` | 3 |
| LBL + SM2: "Forgot" | `grade === 0`（子block打分） | `forgotReinsertOffset` | 3 |
| LBL + Fixed: "Next" | 点击Next且非最后一行 | `readReinsertOffset` | 3 |

**不触发插队的场景**：
- NORMAL + Fixed：无"Forgot"按钮，只有"Next"，不插队
- LBL + SM2 非 Forgot 打分：正常进入下一行
- LBL + Fixed 最后一行：卡片完成，无需插队

---

## 二、系统运行机制与联动关系

### 2.1 数据流全景

```
用户打分/点击Next
    ↓
PracticeOverlay.onPracticeClick() / useLineByLineReview.onLineByLineGrade()
    ↓
practice.ts → generatePracticeData()
    ├── SM2路径：调用 supermemo()，计算 sm2_* 字段，原样传递其他算法字段
    └── Fixed路径：调用 progressiveInterval() 或乘法计算，计算 progressive_*/fixed_* 字段，原样传递其他算法字段
    ↓
queries/save.ts → savePracticeData()
    ├── 同日去重：更新已有session block
    ├── 字段完整性保护：从现有block补全缺失字段
    └── 全量写入所有字段（含跨算法字段）
    ↓
Roam数据页 session block（最新block = 单一事实来源）
```

### 2.2 Session 数据继承机制

- **写入时**：`savePracticeData` 全量写入 `SESSION_SNAPSHOT_KEYS` 中的所有字段，包括非当前算法的字段（Mode Independence Principle）
- **读取时**：`parseLatestSession` 直接解析最新session block（性能优化，因为写入时已保证完整性）
- **历史合并**：`parseSessionHistory` 从旧到新逐个合并（仅在需要完整历史时使用）
- **切换算法不丢数据**：每个算法只修改自己的字段，其他算法字段原样传递

### 2.3 算法 × 模式的6种有效组合

| 组合 | 打分UI | 插队机制 | 特殊行为 |
|------|--------|---------|---------|
| SM2 + NORMAL | Forgot/Hard/Good/Perfect | Forgot → forgotReinsertOffset | 标准复习 |
| SM2 + LBL | 每行 Forgot/Hard/Good/Perfect | Forgot → forgotReinsertOffset | 逐行打分 |
| PROGRESSIVE + NORMAL | Next 按钮 | 无 | 自动计算间隔 |
| PROGRESSIVE + LBL | Read + Next 按钮 | Next → readReinsertOffset | 逐行自动翻页 |
| FIXED_* + NORMAL | Next 按钮 | 无 | 用户可编辑间隔 |
| FIXED_* + LBL | Read + Next 按钮 | Next → readReinsertOffset | 逐行自动翻页 |

---

## 三、发现的问题（违反设计意图）

### 3.1 🔴 代码逻辑 Bug

#### Bug 1: `intervalMultiplier` 未映射为 `fixed_multiplier`，间隔编辑器不生效

**位置**: `PracticeOverlay.tsx:285-291`

**问题**: 用户在间隔编辑器中修改 `intervalMultiplier` 后，`onPracticeClick` 构造 `practiceProps` 时将 `intervalMultiplier` 作为独立字段传入，但 `generatePracticeData` 只识别 `fixed_multiplier`，不识别 `intervalMultiplier`。实际计算使用的是 `currentCardData.fixed_multiplier`（旧值），用户的修改被完全忽略。

**当前代码**:
```typescript
const practiceProps = {
  ...currentCardData,    // 包含旧的 fixed_multiplier
  ...gradeData,
  intervalMultiplier,    // ← 这个字段 generatePracticeData 不认识！
  algorithm,
  interaction,
};
```

**Footer.tsx 的正确做法**（对比）:
```typescript
generatePracticeData({
  fixed_multiplier: intervalMultiplier,  // ← 正确映射
  // ...
});
```

**修复方案**: 将 `intervalMultiplier` 映射为 `fixed_multiplier`:
```typescript
const practiceProps = {
  ...currentCardData,
  ...gradeData,
  fixed_multiplier: intervalMultiplier,  // 替换 intervalMultiplier
  algorithm,
  interaction,
};
```

#### Bug 2: 'G' 快捷键的 disabled 条件反转

**位置**: `Footer.tsx:155-160`

**问题**: 'G' 键（Good/Grade 4）的 `disabled` 条件为 `!isFixedAlgorithm(algorithmFromSession)`，导致 Fixed 算法下 'G' 键可用、SM2 算法下不可用。这与 'F'(Forgot) 和 'H'(Hard) 的逻辑相反，应该是 SM2 下可用、Fixed 下不可用。

**当前代码**:
```typescript
{
  combo: 'G',
  label: 'Grade 4',
  onKeyDown: () => gradeFn(4),
  disabled: !isFixedAlgorithm(algorithmFromSession),  // ← 反了！
},
```

**修复方案**:
```typescript
disabled: isFixedAlgorithm(algorithmFromSession),  // 与 F、H 一致
```

### 3.2 🟡 设计不一致（与第一性原理不符）

#### 问题 1: `readReinsertOffset` 命名残留 "Read" 术语

**位置**: `useSettings.ts:43`, `SettingsForm.tsx:9`, `settings.ts:47`

**问题**: 内部字段名 `readReinsertOffset` 来源于已移除的 "Incremental Read" 概念。UI 已更新为 "LBL Next"，但内部命名未对齐。

**修复方案**: 将 `readReinsertOffset` 重命名为 `lblNextReinsertOffset`，涉及文件：
- `useSettings.ts`（类型定义 + 默认值 + SETTING_TYPES）
- `SettingsForm.tsx`（接口 + 表单状态）
- `settings.ts`（读写逻辑）
- `PracticeOverlay.tsx`（解构使用）
- `useLineByLineReview.ts`（参数传递）

#### 问题 2: `today.ts` 排序使用 SM2 专属字段排序所有卡片

**位置**: `today.ts:180-199`

**问题**: `getDueCardUids` 的二级/三级排序使用 `sm2_eFactor` 和 `sm2_repetitions`，这些字段对 Fixed 算法卡片无意义（总是默认值 2.5 和 0）。虽然不会导致错误结果（一级排序 nextDueDate 是通用的），但概念上不一致。

**修复方案**: 排序逻辑增加算法感知——对 Fixed 算法卡片跳过 SM2 字段排序，或使用 `progressive_repetitions` 作为替代排序键。

#### 问题 3: `Footer.tsx` `IncrementalReadControls` 组件名残留旧术语

**位置**: `Footer.tsx:382`

**问题**: 组件名 `IncrementalReadControls` 来源于已移除的 "Incremental Read" 概念。功能描述已正确更新为 "LBL + Fixed algorithm mode"，但组件名未对齐。

**修复方案**: 重命名为 `LblNextControls`。

#### 问题 4: `Footer.tsx` `IntervalEstimate` 接口包含 SM2 专属字段

**位置**: `Footer.tsx:15-24`

**问题**: `IntervalEstimate` 接口包含 `sm2_grade`、`sm2_repetitions`、`sm2_interval`、`sm2_eFactor` 等 SM2 专属字段，但该接口也用于 Fixed 算法的间隔预览。Fixed 算法下这些字段无意义。

**修复方案**: 将 `IntervalEstimate` 拆分为 `Sm2IntervalEstimate` 和 `FixedIntervalEstimate`，或使用 `Session` 类型作为基础并添加 `nextDueDateFromNow`。

### 3.3 🟢 过时内容/注释/文档

#### 问题 1: `THEME_SYSTEM.md` 仍引用 `modeIncrementalRead`

**位置**: `THEME_SYSTEM.md:39,67-68`

**问题**: 主题流程图和颜色列表中仍包含 `modeIncrementalRead` 和 `warning=Read`，但该颜色已从 `theme.ts` 中移除。

**修复方案**: 更新流程图，移除 `modeIncrementalRead` 引用，将 `ModeBadge` 描述改为只有 Spaced/Fixed 两种。

#### 问题 2: `THEME_SYSTEM.md` FAQ 中关于 `modeIncrementalRead` 移除的说明

**位置**: `THEME_SYSTEM.md:106-108`

**问题**: FAQ 解释了为什么移除 `modeIncrementalRead`，但上方的流程图仍显示它。应同步更新流程图后，FAQ 的上下文才自洽。

#### 问题 3: `useOnBlockInteract.tsx` 中 `Arrive;` 无效表达式

**位置**: `useOnBlockInteract.tsx:13`

**问题**: `Arrive;` 是一个无副作用的表达式语句，用于防止 tree-shaking。更好的做法是使用副作用导入 `import 'arrive'`。

**修复方案**: 将 `import Arrive from 'arrive'; Arrive;` 改为 `import 'arrive';`。

#### 问题 4: `session.ts` 中 `NewRecords` 接口未使用

**位置**: `session.ts:60-62`

**问题**: `NewRecords` 接口定义后从未被使用。

**修复方案**: 删除 `NewRecords` 接口。

#### 问题 5: README 数据模型示例中 `progressive_interval` 缺少说明

**位置**: `README.md:138`

**问题**: 数据模型示例中展示了 `progressive_interval:: 6`，但字段说明部分未提及该字段。

**修复方案**: 在 README 的字段说明中添加 `progressive_interval` 的描述。

#### 问题 6: `Footer.tsx` 注释中 "Incremental Read" 历史参考

**位置**: `Footer.tsx:377`（`IncrementalReadControls` JSDoc）

**问题**: JSDoc 中描述正确（"LBL + Fixed algorithm mode"），但组件名仍为 `IncrementalReadControls`。

**修复方案**: 随组件重命名一并更新。

### 3.4 🔵 注释与代码不同步问题

#### 注释问题 1: `PracticeOverlay.tsx` 顶部注释

**位置**: `PracticeOverlay.tsx:8-9`

**当前**: "MainContext provides shared state (algorithm, interaction, intervalMultiplier, etc.) to child components"
**评估**: 基本准确，但 `intervalMultiplier` 是 UI 状态而非 session 数据，注释可更精确。

#### 注释问题 2: `data.ts` 顶部注释

**位置**: `data.ts:30-31`

**当前**: "All fields (algorithm, interaction, nextDueDate, lineByLineProgress, grade, etc.)"
**评估**: "grade" 应为 "sm2_grade"，"lineByLineProgress" 应为 "lbl_progress"。

#### 注释问题 3: `save.ts` 顶部注释

**位置**: `save.ts:21-22`

**当前**: "lineByLineReview is no longer stored — its function is encoded in the interaction value (e.g. LBL)."
**评估**: 正确，但可以更简洁。

#### 注释问题 4: `useLineByLineReview.ts` 顶部注释

**位置**: `useLineByLineReview.ts:8-10`

**当前**: "关键修复：sessionOverrides 必须同时包含 algorithm 和 interaction，否则插队后卡片模式丢失"
**评估**: 这是历史修复记录，不是架构说明。应改为描述当前设计意图。

#### 注释问题 5: `session.ts` 顶部注释

**位置**: `session.ts:1-23`

**当前**: 文档注释完整且准确，字段命名规范说明清晰。
**评估**: ✅ 无需修改。

#### 注释问题 6: `practice.ts` 顶部注释

**位置**: `practice.ts:9-11`

**当前**: "SM2 算法实现。字段命名遵循 {owner}_{purpose} 规范"
**评估**: ✅ 准确。

#### 注释问题 7: `practice.ts` `generatePracticeData` 注释

**位置**: `practice.ts:57-70`

**当前**: Mode Independence Principle 说明完整，包含 sm2_grade 传递的注意事项。
**评估**: ✅ 准确且有价值。

---

## 四、实施计划

### 阶段 1: 修复代码逻辑 Bug（紧急）

#### 步骤 1.1: 修复 `intervalMultiplier` → `fixed_multiplier` 映射

**文件**: `src/components/overlay/PracticeOverlay.tsx`

将 `onPracticeClick` 中的 `intervalMultiplier` 替换为 `fixed_multiplier: intervalMultiplier`:

```typescript
// 修改前
const practiceProps = {
  ...currentCardData,
  ...gradeData,
  intervalMultiplier,
  algorithm,
  interaction,
};

// 修改后
const practiceProps = {
  ...currentCardData,
  ...gradeData,
  fixed_multiplier: intervalMultiplier,
  algorithm,
  interaction,
};
```

同时更新乐观更新部分，确保 `sessionOverrides` 中也使用 `fixed_multiplier`:

```typescript
setSessionOverrides((prev) => ({
  ...prev,
  [currentCardRefUid]: {
    ...currentCardData,
    ...optimisticSession,
    dateCreated: now,
  },
}));
```

#### 步骤 1.2: 修复 'G' 快捷键 disabled 条件

**文件**: `src/components/overlay/Footer.tsx`

```typescript
// 修改前
disabled: !isFixedAlgorithm(algorithmFromSession),

// 修改后
disabled: isFixedAlgorithm(algorithmFromSession),
```

### 阶段 2: 对齐命名规范（设计一致性）

#### 步骤 2.1: 重命名 `readReinsertOffset` → `lblNextReinsertOffset`

涉及文件（按顺序修改）:
1. `src/hooks/useSettings.ts` — 类型定义、默认值、SETTING_TYPES
2. `src/components/SettingsForm.tsx` — 接口、表单状态
3. `src/queries/settings.ts` — 读写逻辑
4. `src/components/overlay/PracticeOverlay.tsx` — 解构使用
5. `src/hooks/useLineByLineReview.ts` — 参数名

#### 步骤 2.2: 重命名 `IncrementalReadControls` → `LblNextControls`

**文件**: `src/components/overlay/Footer.tsx`

- 组件名重命名
- JSDoc 更新
- 所有引用处更新

#### 步骤 2.3: 优化 `today.ts` 排序逻辑

**文件**: `src/queries/today.ts`

为 Fixed 算法卡片使用 `progressive_repetitions` 作为替代排序键:

```typescript
results.sort((a, b) => {
  const aSession = currentTagSessionData[a] as Session;
  const bSession = currentTagSessionData[b] as Session;

  const aDueDate = aSession?.nextDueDate || new Date(0);
  const bDueDate = bSession?.nextDueDate || new Date(0);
  if (aDueDate.getTime() !== bDueDate.getTime()) {
    return aDueDate.getTime() - bDueDate.getTime();
  }

  // 算法感知排序：SM2 用 eFactor，Fixed 用 progressive_repetitions
  const aIsSpaced = isSpacedAlgorithm(aSession?.algorithm);
  const bIsSpaced = isSpacedAlgorithm(bSession?.algorithm);

  if (aIsSpaced && bIsSpaced) {
    const aEfactor = aSession?.sm2_eFactor ?? 2.5;
    const bEfactor = bSession?.sm2_eFactor ?? 2.5;
    if (aEfactor !== bEfactor) return aEfactor - bEfactor;
    const aReps = aSession?.sm2_repetitions ?? 0;
    const bReps = bSession?.sm2_repetitions ?? 0;
    return aReps - bReps;
  }

  if (!aIsSpaced && !bIsSpaced) {
    const aReps = aSession?.progressive_repetitions ?? 0;
    const bReps = bSession?.progressive_repetitions ?? 0;
    if (aReps !== bReps) return aReps - bReps;
  }

  // 跨算法：Spaced 优先（更需要关注）
  return aIsSpaced ? -1 : 1;
});
```

### 阶段 3: 清理过时内容

#### 步骤 3.1: 删除 `NewRecords` 接口

**文件**: `src/models/session.ts`

删除第 60-62 行的 `NewRecords` 接口。

#### 步骤 3.2: 修复 `useOnBlockInteract.tsx` 导入方式

**文件**: `src/hooks/useOnBlockInteract.tsx`

```typescript
// 修改前
import Arrive from 'arrive';
Arrive;

// 修改后
import 'arrive';
```

#### 步骤 3.3: 重构 `IntervalEstimate` 接口

**文件**: `src/components/overlay/Footer.tsx`

将 `IntervalEstimate` 改为基于 `Session` 类型:

```typescript
type IntervalEstimate = Session & {
  nextDueDateFromNow?: string;
};
```

### 阶段 4: 系统性注释更新

#### 步骤 4.1: 更新 `data.ts` 顶部注释

将 "grade" 改为 "sm2_grade"，"lineByLineProgress" 改为 "lbl_progress"。

#### 步骤 4.2: 更新 `useLineByLineReview.ts` 顶部注释

将 "关键修复" 历史记录改为当前设计意图描述:

```typescript
/**
 * LBL (Line by Line) 逐行复习 Hook。
 *
 * LBL 的行为完全由算法决定：
 * - LBL + SM2: 每行子 block 用 SM2 打分（Forgot/Hard/Good/Perfect），Forgot 触发插队
 * - LBL + Progressive/Fixed: 每行子 block 只显示 Next 按钮，点击后插队 N 张再读下一行
 *
 * 算法独立原则：
 * - 每个算法只操作自己的字段，其他算法字段原样传递
 * - sessionOverrides 必须包含 algorithm 和 interaction，确保插队后卡片模式不丢失
 */
```

#### 步骤 4.3: 更新 `PracticeOverlay.tsx` 顶部注释

将 `intervalMultiplier` 描述更精确:

```typescript
 * - MainContext provides shared state (algorithm, interaction, fixed_multiplier editor state, etc.) to child components
```

#### 步骤 4.4: 全面审查其他文件注释

逐文件检查注释与代码的一致性，更新不匹配的注释。重点文件:
- `save.ts` — 顶部注释中 "lineByLineReview" 引用
- `practice.ts` — 已准确，微调措辞
- `queries/utils.ts` — 顶部注释中 `generateNewSession` 描述
- `Footer.tsx` — `IncrementalReadControls` 重命名后更新 JSDoc

### 阶段 5: README 和文档更新

#### 步骤 5.1: 更新 `README.md`

1. **数据模型部分**: 添加 `progressive_interval` 字段说明
2. **键盘快捷键表**: 标注哪些快捷键仅适用于 SM2 模式
3. **架构说明**: 确保所有术语与当前代码一致（无 "Incremental Read" 残留）
4. **Settings 部分**: 确认 "Reinsert 'LBL Next'" 描述准确

#### 步骤 5.2: 更新 `THEME_SYSTEM.md`

1. **移除 `modeIncrementalRead` 引用**: 更新主题流程图，移除 `warning=Read` 和 `modeIncrementalRead`
2. **更新 FAQ**: 移除 "Why was modeIncrementalRead removed?" 问题（已无需解释不存在的东西），或改为历史说明
3. **更新颜色列表**: 确认 `theme.ts` 中的颜色与文档一致
4. **更新文件结构描述**: `PracticeOverlay.tsx` 注释从 "reviewMode" 改为 "algorithm group"

### 阶段 6: 验证

#### 步骤 6.1: 运行类型检查

```bash
npm run typecheck
```

#### 步骤 6.2: 运行测试

```bash
npm run test
```

#### 步骤 6.3: 手动验证关键路径

- SM2 + NORMAL: 打分 → 间隔正确 → Forgot 插队
- SM2 + LBL: 逐行打分 → Forgot 插队 → 进度保存
- PROGRESSIVE + NORMAL: Next → 间隔正确
- PROGRESSIVE + LBL: Next → 插队 → 进度保存
- FIXED_DAYS + NORMAL: 间隔编辑器修改 → **验证修改生效**（Bug 1 修复验证）
- FIXED_DAYS + LBL: Next → 插队
- 快捷键: 验证 F/H/G 在 SM2 下可用、Fixed 下不可用（Bug 2 修复验证）

---

## 五、风险评估

| 步骤 | 风险 | 缓解措施 |
|------|------|----------|
| 1.1 (intervalMultiplier映射) | 中 — 影响所有Fixed算法卡片的复习计算 | 仔细测试Fixed算法复习流程 |
| 1.2 (G键修复) | 低 — 纯UI快捷键修改 | 手动验证快捷键行为 |
| 2.1 (readReinsertOffset重命名) | 中 — 涉及设置持久化，需兼容旧数据 | settings.ts读取时添加旧名兼容 |
| 2.2 (组件重命名) | 低 — 纯重命名 | IDE全局搜索确认无遗漏 |
| 2.3 (排序优化) | 低 — 不影响正确性，仅影响排序 | 对比排序结果 |
| 3.1-3.3 (清理) | 低 — 删除未使用代码 | typecheck验证 |
| 4.x (注释更新) | 极低 — 仅修改注释 | 人工审查 |
| 5.x (文档更新) | 极低 — 仅修改文档 | 人工审查 |

---

## 六、代码逻辑与系统设计不符的详细报告

### 报告 1: 间隔编辑器不生效（Bug 1 详细分析）

**影响范围**: 所有使用 FIXED_DAYS/WEEKS/MONTHS/YEARS 算法的卡片

**根因**: `PracticeOverlay.tsx` 的 `onPracticeClick` 回调中，`intervalMultiplier`（UI状态）被作为独立字段传入 `practiceProps`，但 `generatePracticeData` 函数只识别 `fixed_multiplier`（Session数据字段）。由于 `currentCardData` 中已包含旧的 `fixed_multiplier`，展开运算符的顺序导致旧值覆盖了用户新选择。

**用户感知**: 用户在间隔编辑器中修改了间隔（如从3天改为7天），Footer的预览正确显示7天，但点击Next后实际保存的仍是3天间隔。下次复习时卡片仍按3天间隔出现。

**修复优先级**: 🔴 高 — 直接影响用户数据正确性

### 报告 2: 'G' 快捷键逻辑反转（Bug 2 详细分析）

**影响范围**: 使用键盘快捷键复习的用户

**根因**: `Footer.tsx` 中 'G' 键的 `disabled` 条件写反了。'F'(Forgot) 和 'H'(Hard) 使用 `disabled: isFixedAlgorithm(...)` （Fixed下禁用），但 'G' 使用了 `disabled: !isFixedAlgorithm(...)` （SM2下禁用）。

**用户感知**: SM2模式下按'G'无反应（应该触发Good打分），Fixed模式下按'G'会触发 `gradeFn(4)` （不应该存在）。

**修复优先级**: 🔴 高 — 影响SM2模式下的键盘操作体验

### 报告 3: `readReinsertOffset` 命名不一致

**影响范围**: 开发者理解代码

**根因**: 该字段来源于已移除的 "Incremental Read" 概念。UI已更新为 "LBL Next"，但内部命名未同步。

**用户感知**: 无直接影响，但增加开发者理解成本

**修复优先级**: 🟡 中 — 命名规范对齐
