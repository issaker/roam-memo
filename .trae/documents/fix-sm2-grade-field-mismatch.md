# SM2 Perfect 评分后 nextDueDate 错误指向当天的 Bug 修复计划

## Bug 分析

### 现象
- 用户选择 SM2 的 Perfect 评分后，卡片当天又出现
- 再次选择 Perfect，`nextDueDate` 仍然指向今天
- 数据表现：`sm2_interval: 0`，`sm2_repetitions: 0`，`sm2_eFactor` 快速下降到 1.3

### 根本原因

**字段名不匹配**：[Footer.tsx:83](file:///Users/a123/Documents/chengxu%20project/roam-memo-main/src/components/overlay/Footer.tsx#L83) 中 `gradeFn` 传递 `{ grade, refUid }` 给 `onPracticeClick`，但 SM2 算法期望的字段名是 `sm2_grade`。

完整的数据流追踪：

1. **Footer.tsx:83** — `gradeFn(5)` 调用 `onPracticeClick({ grade: 5, refUid })`
2. **PracticeOverlay.tsx:287** — `practiceProps = { ...currentCardData, ...gradeData }`，此时 `gradeData` 只有 `grade` 字段，没有 `sm2_grade`
3. **PracticeOverlay.tsx:295** — `generatePracticeData({ ...practiceProps })` 被调用，但 `practiceProps.sm2_grade` 来自 `currentCardData`（上一次评分）或 `undefined`（新卡片）
4. **practice.ts:90** — `sm2_grade || 0` 将 `undefined` 转为 `0`（Forgot）
5. **practice.ts:22** — `supermemo` 收到 grade=0，返回 `interval=0, repetitions=0`
6. **practice.ts:92** — `nextDueDate = today + 0 = today` ← 卡片当天再次出现

### 数据验证

用户提供的数据完美印证了这个分析：

| 日期 | sm2_eFactor | 计算过程（grade 被当作 0） | 实际值 |
|------|------------|--------------------------|--------|
| 4月18日 | 2.5 + (0.1 - 5×0.18) = 1.7 | 1.7000000000000002 | ✓ |
| 4月19日 | 1.7 + (0.1 - 5×0.18) = 0.9 → clamp 1.3 | 1.3 | ✓ |

Emoji 显示 🟢 是因为 `getEmojiFromGrade(undefined)` 命中了 `default` 分支，默认返回 🟢。

### 连锁影响

这个字段名不匹配还导致了以下问题：

1. **LBL 路径同样受影响**：[PracticeOverlay.tsx:281](file:///Users/a123/Documents/chengxu%20project/roam-memo-main/src/components/overlay/PracticeOverlay.tsx#L281) 中 `onLineByLineGrade(gradeData.sm2_grade)` 传入 `undefined`
2. **Forgot 重插逻辑失效**：[PracticeOverlay.tsx:313](file:///Users/a123/Documents/chengxu%20project/roam-memo-main/src/components/overlay/PracticeOverlay.tsx#L313) 中 `gradeData.sm2_grade === 0` 永远为 `false`
3. **Emoji 误导**：`getEmojiFromGrade(undefined)` 返回 🟢，掩盖了实际评分为 Forgot 的事实

## 修复方案

### 修改 1：Footer.tsx — 修复 gradeFn 字段名（核心修复）

**文件**：[Footer.tsx:83](file:///Users/a123/Documents/chengxu%20project/roam-memo-main/src/components/overlay/Footer.tsx#L83)

将：
```typescript
activateButtonFn(key, () => onPracticeClick({ grade, refUid: refUid }));
```
改为：
```typescript
activateButtonFn(key, () => onPracticeClick({ sm2_grade: grade, refUid: refUid }));
```

这一处修改即可同时修复所有连锁问题：
- `gradeData.sm2_grade` 在 LBL 路径中正确传递
- `practiceProps.sm2_grade` 在 `generatePracticeData` 中正确使用
- `gradeData.sm2_grade === 0` 在 Forgot 重插逻辑中正确判断

### 修改 2：save.ts — 修复 getEmojiFromGrade 默认值（防御性修复）

**文件**：[save.ts:51](file:///Users/a123/Documents/chengxu%20project/roam-memo-main/src/queries/save.ts#L51)

将 `default` 分支从返回 🟢 改为返回 ⚪（中性颜色），避免 `undefined` grade 被误显示为 Perfect：
```typescript
default: return '⚪';
```

### 修改 3：验证测试

运行现有测试确保修改不破坏其他功能：
```bash
npx jest src/practice.test.ts
```

## 不需要修改的部分

- `generatePracticeData` 和 `supermemo` 函数本身逻辑正确，无需修改
- `intervalEstimates` 计算已经正确使用 `sm2_grade: grade`（Footer.tsx:186），无需修改
- `practice.test.ts` 测试已经正确使用 `sm2_grade`，无需修改
- 数据迁移逻辑（MigrateLegacyDataPanel）是独立功能，不在本次修复范围
