# 修复按钮间隔预估显示累加数据的问题

## 问题分析

当用户回溯到今日已打分的卡片时，Footer 按钮上的 tooltip（如 "Review tomorrow" / "Review Saturday"）仍然基于**累积的 `currentCardData`** 计算间隔预估，而非基于非今日基底数据。

**根因**：Footer.tsx 的 `intervalEstimates` 直接从 `currentCardData` 解构 `sm2_interval`、`sm2_repetitions`、`sm2_eFactor` 等字段来计算各评分的预估间隔。但 `currentCardData` 在首次打分后已被乐观更新为累积值，导致预估结果错误。

**示例**：
- 卡片原始：repetitions=2, interval=6
- 首次打 Perfect(5) 后：repetitions=3, interval=15（乐观更新到 currentCardData）
- 回溯后按钮显示：基于 repetitions=3, interval=15 计算 → "Review Saturday"（错误）
- 期望显示：基于原始 repetitions=2, interval=6 计算 → "Review tomorrow"（正确）

## 实施方案

### 1. `PracticeOverlay.tsx` — MainContext 新增 `baseCardData`

在 MainContext 中新增 `baseCardData` 字段，传递非今日基底数据给 Footer。

**修改 MainContextProps 接口**：
```typescript
interface MainContextProps {
  intervalMultiplier: number;
  setIntervalMultiplier: (multiplier: number) => void;
  onPracticeClick: (props: handlePracticeProps) => void;
  currentIndex: number;
  renderMode: RenderMode;
  isLineByLine: boolean;
  lineByLineCurrentIndex: number;
  lineByLineTotal: number;
  cardMeta: import('~/models/session').CardMeta | undefined;
  baseCardData: Session | undefined;  // 新增
}
```

**计算 baseCardData**（与 onPracticeClick 中相同的逻辑）：
```tsx
const baseCardData = React.useMemo(() => {
  if (!currentCardRefUid) return currentCardData;
  if (baseSessionDataMap.current[currentCardRefUid]) {
    return { ...generateNewSession(), ...baseSessionDataMap.current[currentCardRefUid] };
  }
  return practiceData[currentCardRefUid] || currentCardData;
}, [currentCardRefUid, practiceData, currentCardData]);
```

**MainContext.Provider 传入**：
```tsx
<MainContext.Provider
  value={{
    ...
    baseCardData,
  }}
>
```

### 2. `Footer.tsx` — intervalEstimates 使用 baseCardData

从 MainContext 读取 `baseCardData`，用它替代 `currentCardData` 来计算 `intervalEstimates`。

```tsx
const { intervalMultiplier, baseCardData } = React.useContext(MainContext);

const intervalEstimates: IntervalEstimates = React.useMemo(() => {
  const dataForEstimates = baseCardData || currentCardData;
  if (!dataForEstimates) return;
  ...
  const { sm2_interval, sm2_repetitions, sm2_eFactor, ... } = dataForEstimates;
  ...
}, [baseCardData, currentCardData, intervalMultiplier, algorithmFromSession]);
```

## 修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `src/components/overlay/PracticeOverlay.tsx` | MainContextProps 新增 `baseCardData`；计算 baseCardData memo；Provider 传入 |
| `src/components/overlay/Footer.tsx` | 从 MainContext 读取 `baseCardData`；`intervalEstimates` 使用 `baseCardData` 替代 `currentCardData` |
