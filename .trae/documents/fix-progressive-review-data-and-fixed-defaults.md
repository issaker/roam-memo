# 修复计划：Progressive 模式复习数据错误 & Fixed 模式默认值问题

## 问题分析

### 问题 1：Progressive 模式下 Next 复习数据错误

用户展示的数据：
```
- [[April 19th, 2026]] ⚪
    - interaction:: NORMAL
    - algorithm:: PROGRESSIVE
    - nextDueDate:: [[April 21st, 2026]]
    - sm2_interval:: 0
    - sm2_eFactor:: 1.7000000000000002
    - sm2_repetitions:: 0
    - progressive_repetitions:: 1
    - progressive_interval:: 2
```

**根因分析：**

1. **`sm2_eFactor` 浮点精度问题**：`supermemo()` 函数计算 eFactor 时未做舍入，导致 `1.7000000000000002` 而非 `1.7`。这是 JavaScript 经典浮点精度问题。

2. **`generateNewSession()` 未区分 Progressive 和 Fixed 算法**：对所有非 SM2 算法，统一生成 `progressive_interval: 2, progressive_repetitions: 0`。但 FIXED_DAYS/WEEKS/MONTHS/YEARS 应生成 `fixed_multiplier` 字段，而非 Progressive 字段。

3. **`intervalMultiplier` 状态为 undefined**：PracticeOverlay 中 `intervalMultiplier` 从 `currentCardData?.fixed_multiplier` 初始化，但 Progressive 卡片没有 `fixed_multiplier`（它用 `progressive_interval`），新 Fixed 卡片也没有（因为 `generateNewSession` 未设置）。这导致 UI 的 NumericInput 显示为空。

4. **Emoji 始终为 ⚪**：Progressive/Fixed 模式不传 `sm2_grade`，导致 `getEmojiFromGrade(undefined)` 返回 `⚪`，看起来像未复习。

5. **`savePracticeData` 同日去重逻辑未做数值类型转换**：从已有 block 中补全字段时，`parseConfigString` 返回的值可能是字符串（如 `'0'`），而 `getEmojiFromGrade` 使用严格等于比较，`'0' !== 0`，导致返回 `⚪` 而非 `🔴`。

### 问题 2：Fixed Days/weeks/months/years 默认值为空

**根因分析：**

1. **`generateNewSession()` 未为 Fixed 算法设置 `fixed_multiplier`**：新 Fixed 卡片没有 `fixed_multiplier`，UI 显示空值。
2. **`intervalMultiplier` 初始化未使用算法特定默认值**：当 `latestSession.fixed_multiplier` 为 undefined 时，应使用算法对应的默认值。
3. **用户建议所有 Fixed 算法默认值为 3**：当前仅 FIXED_DAYS 默认为 3，其余为 1。

---

## 修复步骤

### 步骤 1：修复 `supermemo()` 浮点精度问题

**文件**：[practice.ts](src/practice.ts#L13-L44)

- 在 `supermemo()` 函数中，对 `nextEfactor` 结果做 `Math.round(nextEfactor * 10000) / 10000` 舍入（保留 4 位小数）
- 同时对 `nextInterval` 也做适当舍入

### 步骤 2：修复 `generateNewSession()` 区分算法类型

**文件**：[utils.ts](src/queries/utils.ts#L264-L301)

- 将非 SM2 分支拆分为 Progressive 和 Fixed 两个分支：
  - **Progressive**：保持现有逻辑 `progressive_interval: 2, progressive_repetitions: 0`
  - **Fixed（FIXED_DAYS/WEEKS/MONTHS/YEARS）**：生成 `fixed_multiplier` 字段，默认值为 3

### 步骤 3：修复 `intervalMultiplier` 初始化逻辑

**文件**：[PracticeOverlay.tsx](src/components/overlay/PracticeOverlay.tsx#L145-L177)

- 修改 `intervalMultiplier` 的初始化和 card 切换时的重置逻辑：
  - **Progressive**：使用 `progressive_interval` 或默认值 2
  - **Fixed 算法**：使用 `fixed_multiplier` 或算法对应默认值 3
  - **SM2**：使用默认值 3（作为 fallback）

- 新增辅助函数 `getDefaultIntervalMultiplier(algorithm)` 返回算法对应的默认值

### 步骤 4：修复 `savePracticeData` 去重逻辑的数值类型转换

**文件**：[save.ts](src/queries/save.ts#L156-L170)

- 在同日去重逻辑中，对从已有 block 补全的字段值做数值类型转换：
  - 如果 `SESSION_SNAPSHOT_KEYS` 中的字段值是数字字符串，转换为 Number
  - 确保 `sm2_grade`、`sm2_interval`、`sm2_repetitions`、`sm2_eFactor`、`progressive_repetitions`、`progressive_interval`、`fixed_multiplier` 等数值字段正确转换

### 步骤 5：修复 Fixed 算法默认值统一为 3

**文件**：[practice.ts](src/practice.ts#L134-L149)

- 将 `FIXED_WEEKS`、`FIXED_MONTHS`、`FIXED_YEARS` 的 `fixed_multiplier` 默认值从 1 改为 3
- 与步骤 2 中 `generateNewSession` 的修改保持一致

### 步骤 6：为 Progressive/Fixed 模式设置合理的 Emoji

**文件**：[save.ts](src/queries/save.ts#L35-L52)

- 修改 `getEmojiFromGrade` 函数，增加对 Progressive/Fixed 模式的处理：
  - 当 `sm2_grade` 为 undefined 且算法为 Fixed 组时，返回 `🟢`（表示已完成复习）
  - 或者新增参数传入 algorithm，根据算法决定 emoji

---

## 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `src/practice.ts` | 修复浮点精度、统一 Fixed 默认值为 3 |
| `src/queries/utils.ts` | `generateNewSession` 区分 Progressive 和 Fixed |
| `src/components/overlay/PracticeOverlay.tsx` | 修复 `intervalMultiplier` 初始化逻辑 |
| `src/queries/save.ts` | 修复去重逻辑数值转换、修复 emoji 逻辑 |

## 风险评估

- **步骤 1-2**：低风险，仅修改计算逻辑和默认值
- **步骤 3**：中风险，修改 React 状态初始化逻辑，需确保不影响现有卡片切换行为
- **步骤 4**：中风险，修改数据保存逻辑，需确保不破坏现有数据
- **步骤 5**：低风险，修改默认值，仅影响新卡片
- **步骤 6**：低风险，修改 emoji 显示逻辑
