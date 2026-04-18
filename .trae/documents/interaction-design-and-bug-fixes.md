# 数据字段系统修复计划 — 交互方案与排列组合分析

## 一、当前 Bug 清单

### Bug 1: 同日重复创建 Session Block
**现象**: 同一张卡片在同一天被复习多次时，`savePracticeData` 每次都创建一个新的 `[[Date]]` block，而不是更新当天已有的 block。
**根因**: `savePracticeData` 无条件调用 `createChildBlock` 创建新日期 block，从不检查当天是否已有 session block。

### Bug 2: Normal + SM2 的 Forgot 插队失败
**现象**: 在 Normal + SM2 模式下，打分 Forgot 后卡片没有正确插队。
**根因**: 需要进一步确认。插队逻辑本身（`setCardQueue` splice）看起来正确，但插队后卡片再次出现时，`sessionOverrides` 可能没有正确传递，或者 `handlePracticeClick` → `practice()` → `savePracticeData` 创建了重复的 session block 导致数据混乱。

### Bug 3: LBL + SM2 的 Forgot 插队失败
**现象**: 在 LBL + SM2 模式下，子 block 打分 Forgot 后插队失败。
**根因**: 同 Bug 2，插队后卡片再次出现时的数据状态可能不正确。

### Bug 4: LBL + Progressive 插队后卡片变成 Normal 模式
**现象**: LBL + Progressive 模式下，点击 Next 后卡片插队，再次出现时变成 Normal 模式。
**根因**: `onLineByLineGrade` 中的 `setSessionOverrides` 只设置了 `algorithm` 但**没有设置 `interaction`**：
```typescript
setSessionOverrides((prev) => ({
  ...prev,
  [currentCardRefUid]: {
    ...currentCardData,
    algorithm,        // ✅ 有
    dateCreated: now,
    lbl_progress: ...,
    nextDueDate: ...,
    // ❌ 缺少 interaction!
  },
}));
```
当 `currentCardData` 的 `interaction` 字段为 `undefined`（新卡或数据不完整时），`interaction` 就丢失了，回退到默认的 `NORMAL`。

---

## 二、交互方案定义

### 2.1 两种交互模式

| 交互模式 | 说明 | UI 表现 |
|----------|------|---------|
| **Normal** | 整卡交互，一次显示整张卡片 | 问题→显示答案→打分/Next |
| **LBL (Line by Line)** | 逐行交互，每次显示一个子 block | 问题→逐行显示子 block→每行打分/Next |

### 2.2 六种算法

| 算法 | 组别 | Normal 下的 UI | LBL 下的 UI |
|------|------|---------------|-------------|
| **SM2** | Spaced | Forgot/Hard/Good/Perfect 打分按钮 | 每行子 block: Forgot/Hard/Good/Perfect 打分按钮 |
| **Progressive** | Fixed | Next 按钮（自动计算间隔） | 每行子 block: Next 按钮（自动翻页） |
| **Fixed Days** | Fixed | Next 按钮 + 可编辑间隔 | 每行子 block: Next 按钮 |
| **Fixed Weeks** | Fixed | Next 按钮 + 可编辑间隔 | 每行子 block: Next 按钮 |
| **Fixed Months** | Fixed | Next 按钮 + 可编辑间隔 | 每行子 block: Next 按钮 |
| **Fixed Years** | Fixed | Next 按钮 + 可编辑间隔 | 每行子 block: Next 按钮 |

### 2.3 插队规则

| 插队类型 | 触发条件 | 适用范围 | 行为 |
|----------|---------|---------|------|
| **Forgot 插队** | 打分为 Forgot (grade=0) | Normal+SM2, LBL+SM2 | 卡片/子block 插入队列 N 张后 |
| **LBL Next 插队** | LBL+Fixed 算法下点击 Next | LBL+Progressive, LBL+Fixed_* | 卡片插入队列 N 张后（还有未读子 block 时） |

**关键规则**: 插队不改变卡片的 algorithm 和 interaction。插队只是把卡片 UID 重新放入队列，卡片再次出现时应保持原有模式。

---

## 三、排列组合穷举分析

### 3.1 Normal 模式（2 × 6 = 12 种组合）

| # | 交互 | 算法 | 打分方式 | 插队方式 | 预期行为 |
|---|------|------|---------|---------|---------|
| 1 | Normal | SM2 | Forgot/Hard/Good/Perfect | Forgot → 插队 N 张后 | 打分→计算间隔→保存→如果 Forgot 则插队→下一张 |
| 2 | Normal | Progressive | Next | 无插队 | Next→计算间隔→保存→下一张 |
| 3 | Normal | Fixed Days | Next + 可编辑间隔 | 无插队 | Next→按固定间隔→保存→下一张 |
| 4 | Normal | Fixed Weeks | Next + 可编辑间隔 | 无插队 | Next→按固定间隔→保存→下一张 |
| 5 | Normal | Fixed Months | Next + 可编辑间隔 | 无插队 | Next→按固定间隔→保存→下一张 |
| 6 | Normal | Fixed Years | Next + 可编辑间隔 | 无插队 | Next→按固定间隔→保存→下一张 |

### 3.2 LBL 模式（2 × 6 = 12 种组合）

| # | 交互 | 算法 | 每行打分方式 | 插队方式 | 预期行为 |
|---|------|------|------------|---------|---------|
| 7 | LBL | SM2 | Forgot/Hard/Good/Perfect | Forgot → 插队 N 张后 | 显示子block→打分→如果 Forgot 则整卡插队→下一行子block→所有行完成→下一张卡 |
| 8 | LBL | Progressive | Next | Next → 插队 N 张后 | 显示子block→Next→插队→下一张卡→N张后回来显示下一个子block→直到所有子block完成 |
| 9 | LBL | Fixed Days | Next | Next → 插队 N 张后 | 同 Progressive 行为 |
| 10 | LBL | Fixed Weeks | Next | Next → 插队 N 张后 | 同 Progressive 行为 |
| 11 | LBL | Fixed Months | Next | Next → 插队 N 张后 | 同 Progressive 行为 |
| 12 | LBL | Fixed Years | Next | Next → 插队 N 张后 | 同 Progressive 行为 |

### 3.3 插队后卡片再次出现的场景（12 种）

| # | 原始模式 | 插队原因 | 再次出现时应保持 | 当前 Bug |
|---|---------|---------|----------------|---------|
| 1 | Normal+SM2 | Forgot | Normal+SM2，显示打分按钮 | ❌ 可能创建重复 session block |
| 2 | Normal+Progressive | 无插队 | N/A | — |
| 3-6 | Normal+Fixed_* | 无插队 | N/A | — |
| 7 | LBL+SM2 | Forgot | LBL+SM2，显示子block+打分按钮 | ❌ interaction 丢失 |
| 8 | LBL+Progressive | Next (LBL Next 插队) | LBL+Progressive，显示子block+Next按钮 | ❌ interaction 丢失，变成 Normal |
| 9-12 | LBL+Fixed_* | Next (LBL Next 插队) | LBL+Fixed_*，显示子block+Next按钮 | ❌ interaction 丢失，变成 Normal |

### 3.4 LBL 子 block 完成状态分析

| 场景 | 子 block 进度 | 卡片完成？ | nextDueDate |
|------|-------------|----------|-------------|
| LBL+SM2, 所有子block已打分 | 全部有记录且未到期 | ✅ 完成 | 最早的子block到期日 |
| LBL+SM2, 还有未打分子block | 部分有记录 | ❌ 未完成 | 今天（保持 due） |
| LBL+Progressive, 还有未读子block | 部分有记录 | ❌ 未完成 | 今天（保持 due），插队 |
| LBL+Progressive, 所有子block已读 | 全部有记录 | ✅ 完成 | 最早的子block到期日 |

---

## 四、修复方案

### Fix 1: savePracticeData — 同日 Session Block 更新而非创建

**当前行为**: 每次调用都 `createChildBlock` 创建新的日期 block
**修复为**: 检查当天是否已有 session block，有则更新字段，无则创建

**实现**:
1. 在 `savePracticeData` 中，先查询 `cardDataBlockUid` 下是否已有今天的日期 block
2. 如果有，删除该 block 的所有子字段，然后重新写入（简单但可靠）
3. 或者：如果有，用 `upsertLatestSessionField` 逐字段更新（更精确但更复杂）
4. 如果没有，创建新的日期 block（当前行为）

**推荐方案**: 方案 2（upsert 逐字段更新），因为 `upsertLatestSessionField` 已经存在且经过验证。

### Fix 2: sessionOverrides 必须同时保存 algorithm 和 interaction

**当前 Bug**: `onLineByLineGrade` 中的 `setSessionOverrides` 只设置了 `algorithm`，没有 `interaction`
**修复**: 在所有 `setSessionOverrides` 调用中，同时设置 `algorithm` 和 `interaction`

**涉及位置**:
- `useLineByLineReview.ts` 的 `onLineByLineGrade` 中两处 `setSessionOverrides` 调用
- `PracticeOverlay.tsx` 的 `onPracticeClick` 中的 `setSessionOverrides` 调用（已正确）

### Fix 3: 移除所有向后兼容代码

既然有 Data Migration 功能，运行时不需要兼容旧字段名。

**移除清单**:
1. `data.ts` 中的 `LEGACY_FIELD_MAP` 常量及其使用
2. `data.ts` 中的 `reviewMode` 和 `intervalMultiplierType` 跳过逻辑
3. `save.ts` 中的 `reviewMode` 跳过逻辑
4. `save.ts` 中 `DEDUP_FIELD_KEYS` 的 `intervalMultiplierType`
5. `useLineByLineReview.ts` 中的 `LEGACY_LBL_CHILD_KEY_MAP` 和 `migrateLblChildData`
6. `session.ts` 中 `resolveReviewConfig` 的 `'READ' → 'LBL'` 映射
7. `legacyRoamSr.ts` 整个文件
8. `session.ts` 中 `isRoamSrOldPracticeRecord` 字段
9. 相关测试用例

### Fix 4: 插队后卡片再次出现时的完整数据流

**当前问题**: 插队后卡片再次出现时，`sessions` 通过 `sessionOverrides` 获取数据，但 `sessionOverrides` 中数据不完整（缺少 `interaction`）

**修复后的数据流**:
1. 用户打分 → `onPracticeClick` / `onLineByLineGrade`
2. 创建 `sessionOverride`，包含完整的 `algorithm` + `interaction` + 所有算法字段
3. 插队：将卡片 UID splice 回 `cardQueue`
4. 卡片再次出现 → `sessions` 使用 `sessionOverrides` 中的数据
5. `useCurrentCardData` 从 `latestSession`（即 override）中提取 `algorithm` 和 `interaction`
6. UI 正确显示对应的打分控件

---

## 五、实施步骤

### Step 1: 修复 sessionOverrides 缺少 interaction（最紧急）
- 修改 `useLineByLineReview.ts` 两处 `setSessionOverrides`，添加 `interaction`
- 修改 `PracticeOverlay.tsx` 的 `onPracticeClick`，确认 `interaction` 已正确传递

### Step 2: 修复 savePracticeData 同日重复创建
- 修改 `savePracticeData`：查询当天是否已有 session block
- 如果有，使用 upsert 模式更新字段
- 如果没有，创建新的 session block

### Step 3: 移除向后兼容代码
- 移除 `LEGACY_FIELD_MAP` 及相关逻辑
- 移除 `LEGACY_LBL_CHILD_KEY_MAP` 和 `migrateLblChildData`
- 移除 `reviewMode` / `intervalMultiplierType` 跳过逻辑
- 移除 `resolveReviewConfig` 中的 READ 映射
- 移除 `legacyRoamSr.ts`
- 移除 `isRoamSrOldPracticeRecord`
- 更新相关测试

### Step 4: 验证所有排列组合
- 逐一测试第三节的 12 种交互组合
- 重点测试插队后卡片再次出现的 5 种场景
- 确认 LBL 子 block 完成状态逻辑正确
