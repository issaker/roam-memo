# 数据更新防误触约束 — 实施计划（简化版）

## 问题分析

当用户对同一张卡片在同一天多次打分时（回溯翻页、重复操作），SM2 算法基于**已累积的数据**计算，导致 `sm2_repetitions`、`sm2_interval` 等字段不断累加。

**根本原因**：`onPracticeClick` 中 `practiceProps` 使用 `currentCardData` 作为基底，而 `currentCardData` 在首次打分后已被乐观更新，二次打分时 SM2 输入的是累积值。

**核心思路**：SM2 计算始终使用**今日之前的最近 session 数据**作为基底，而非今日的 session 数据。这样同日多次打分的结果都是基于同一个基底计算，效果等同于覆盖而非累加。

## 实施方案（3 个文件，最小化修改）

### 1. `src/queries/data.ts` — 解析时附带非今日基底数据

修改 `parseLatestSession`：当最新 session 是今日的，同时解析**最近的非今日 session block**，作为 `baseSessionData` 附加到返回对象中。

**修改位置**：`parseLatestSession` 函数末尾（约 L256-282）

**修改逻辑**：
- 判断 `rawRecord.dateCreated` 是否为今天（使用 `dateUtils.isSameDay`）
- 若是今天且存在更早的 session block，遍历找到第一个非今日的 session block
- 解析该 block 的字段值，存为 `rawRecord.baseSessionData`
- `savePracticeData` 已全量写入所有字段，所以非今日 session block 本身就是完整快照，无需历史合并

**新增 import**：`import * as dateUtils from '~/utils/date';`

```typescript
// 在 parseLatestSession 函数末尾，return rawRecord 之前添加：
const now = new Date();
if (dateUtils.isSameDay(rawRecord.dateCreated, now) && sortedSessionChildren.length > 1) {
  for (let i = 1; i < sortedSessionChildren.length; i++) {
    const prevChild = sortedSessionChildren[i];
    if (!prevChild?.string) continue;
    const prevDateStr = getStringBetween(prevChild.string, '[[', ']]');
    const prevDate = parseRoamDateString(prevDateStr);
    if (prevDate && !dateUtils.isSameDay(prevDate, now)) {
      const prevRecord: Record<string, any> = {
        refUid: uid,
        dateCreated: prevDate,
      };
      if (prevChild.children) {
        parseFieldValuesFromChildren(prevRecord, prevChild.children);
      }
      const prevConfig = resolveReviewConfig(prevRecord.algorithm, prevRecord.interaction);
      prevRecord.algorithm = prevConfig.algorithm;
      prevRecord.interaction = prevConfig.interaction;
      rawRecord.baseSessionData = prevRecord;
      break;
    }
  }
}
```

### 2. `src/models/session.ts` — Session 类型新增字段

在 `Session` 类型中添加可选的 `baseSessionData` 字段：

```typescript
export type Session = {
  algorithm: SchedulingAlgorithm;
  interaction: InteractionStyle;
  sm2_repetitions?: number;
  sm2_interval?: number;
  sm2_eFactor?: number;
  sm2_grade?: number;
  progressive_repetitions?: number;
  progressive_interval?: number;
  fixed_multiplier?: number;
  lbl_progress?: string;
  baseSessionData?: Session;  // 新增：非今日的最近 session 数据
} & SessionCommon;
```

### 3. `src/components/overlay/PracticeOverlay.tsx` — 使用基底数据 + 提醒 UI

#### 3.1 提取 baseSessionData 到 ref map

从 `practiceData` 中提取每张卡片的 `baseSessionData`，存入 ref map。`practiceData` 不受乐观更新影响，所以 `baseSessionData` 在整个 overlay 生命周期内稳定。

```tsx
const baseSessionDataMap = React.useRef<Record<string, Session>>({});

React.useEffect(() => {
  const map: Record<string, Session> = {};
  for (const [uid, session] of Object.entries(practiceData)) {
    if ((session as Session).baseSessionData) {
      map[uid] = (session as Session).baseSessionData!;
    }
  }
  baseSessionDataMap.current = map;
}, [practiceData]);
```

#### 3.2 修改 `onPracticeClick` — 使用非今日基底数据

**核心变更**：构建 `practiceProps` 时，使用非今日基底数据作为 SM2 计算的输入，而非 `currentCardData`。

**基底数据选取逻辑**：
1. 若 `baseSessionDataMap` 中有该卡片的 `baseSessionData`（今日之前 overlay 打开时已评分）→ 使用它
2. 否则使用 `practiceData[currentCardRefUid]`（今日之前未评分，practiceData 即为非今日数据）
3. 兜底使用 `currentCardData`

```tsx
const onPracticeClick = React.useCallback(
  (gradeData) => {
    if (isDone) return;

    if (isLineByLineActive && !lineByLineIsCardComplete) {
      onLineByLineGrade(gradeData.sm2_grade);
      return;
    }

    // 使用非今日基底数据，防止同日多次打分累加
    const baseData = baseSessionDataMap.current[currentCardRefUid]
      ? { ...generateNewSession(), ...baseSessionDataMap.current[currentCardRefUid] }
      : (practiceData[currentCardRefUid] || currentCardData);

    const practiceProps = {
      ...baseData,
      ...gradeData,
      fixed_multiplier: intervalMultiplier,
      algorithm,
      interaction,
    };

    // 检测是否为重复打分（今日已评分），显示提醒
    const isReScoring = currentCardData?.dateCreated
      && dateUtils.isSameDay(currentCardData.dateCreated, new Date());
    if (isReScoring) {
      setShowOverwriteReminder(true);
    }

    if (!isCramming && currentCardRefUid) {
      const now = new Date();
      const optimisticSession = generatePracticeData({
        ...practiceProps,
        dateCreated: now,
      });
      setSessionOverrides((prev) => ({
        ...prev,
        [currentCardRefUid]: {
          ...baseData,
          ...optimisticSession,
          dateCreated: now,
        },
      }));
    }

    handlePracticeClick(practiceProps);
    setShowAnswers(false);

    const isForgot = gradeData.sm2_grade === 0;
    const insertIndex = currentIndex + 1 + forgotReinsertOffset;

    if (isForgot && forgotReinsertOffset > 0 && currentCardRefUid) {
      setCardQueue((prev) => {
        const newQueue = [...prev];
        const targetIndex = Math.min(insertIndex, newQueue.length);
        newQueue.splice(targetIndex, 0, currentCardRefUid);
        return newQueue;
      });
    }

    setCurrentIndex((prev) => prev + 1);
  },
  [
    handlePracticeClick, isDone, practiceData, currentCardData, algorithm,
    interaction, intervalMultiplier, currentCardRefUid, forgotReinsertOffset,
    isCramming, isLineByLineActive, lineByLineIsCardComplete, onLineByLineGrade,
  ]
);
```

**需要新增 import**：`import { generateNewSession } from '~/queries/utils';`（已有 `generateNewSession` 的间接引用，需确认直接 import 路径）

#### 3.3 新增覆盖提醒 UI

**状态**：
```tsx
const [showOverwriteReminder, setShowOverwriteReminder] = React.useState(false);
```

**自动消失定时器**：
```tsx
React.useEffect(() => {
  if (showOverwriteReminder) {
    const timer = setTimeout(() => setShowOverwriteReminder(false), 2500);
    return () => clearTimeout(timer);
  }
}, [showOverwriteReminder]);
```

**JSX**（放在 Dialog 内部，DialogBody 同级）：
```tsx
{showOverwriteReminder && (
  <OverwriteReminder>今日已评分，此次打分将覆盖今日数据</OverwriteReminder>
)}
```

**styled-component**：
```tsx
const OverwriteReminder = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.75);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 100;
  animation: fadeInOut 2.5s ease-in-out;
  pointer-events: none;

  @keyframes fadeInOut {
    0% { opacity: 0; }
    15% { opacity: 1; }
    75% { opacity: 1; }
    100% { opacity: 0; }
  }
`;
```

## 数据流验证

### 场景 1：同日首次打分（正常流程）
- `practiceData[cardUid].dateCreated` ≠ 今天 → 无 `baseSessionData`
- `baseData = practiceData[cardUid]`（非今日数据）
- SM2 基于非今日数据计算 → ✅ 正确

### 场景 2：同日二次打分（同一 overlay 会话内回溯）
- 首次打分后 `sessionOverrides[cardUid]` 有乐观更新，`currentCardData.dateCreated` = 今天
- `practiceData[cardUid]` 不变（仍为非今日数据），无 `baseSessionData`
- `baseData = practiceData[cardUid]`（非今日数据，与首次打分相同基底）
- SM2 基于相同基底重新计算 → ✅ 覆盖而非累加
- 显示覆盖提醒 → ✅

### 场景 3：今日之前已打分，重新打开 overlay 再打分
- `practiceData[cardUid].dateCreated` = 今天 → 有 `baseSessionData`（非今日数据）
- `baseData = baseSessionDataMap.current[cardUid]`（非今日数据）
- SM2 基于非今日数据计算 → ✅ 覆盖而非累加
- 显示覆盖提醒 → ✅

### 场景 4：新卡片首次打分
- `practiceData[cardUid]` 有 `isNew: true` 和默认值
- `baseData = practiceData[cardUid]`（默认值）
- SM2 基于默认值计算 → ✅ 正确

### 场景 5：Cram 模式
- `isCramming = true`，不执行乐观更新，不持久化
- `baseData` 仍为非今日数据，SM2 计算正确 → ✅

## 不需要修改的文件

| 文件 | 原因 |
|------|------|
| `save.ts` | 已有同日 Session Block 去重逻辑，存储层正确覆盖 |
| `Footer.tsx` | `gradeFn` 仅调用 `onPracticeClick`，无需改动 |
| `practice.ts` | SM2 算法本身无问题，问题在于输入数据 |
| `today.ts` | 到期卡片计算逻辑无需改动 |
| `app.tsx` | `handlePracticeClick` 无需改动 |

## 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `src/queries/data.ts` | `parseLatestSession` 新增 `baseSessionData` 解析（~15 行） |
| `src/models/session.ts` | `Session` 类型新增 `baseSessionData?: Session`（1 行） |
| `src/components/overlay/PracticeOverlay.tsx` | baseSessionDataMap + onPracticeClick 使用基底数据 + 覆盖提醒 UI（~40 行） |
