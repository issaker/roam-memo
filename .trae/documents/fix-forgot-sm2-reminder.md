# 计划：修复 Forgot 卡片的覆盖提醒和 SM2 算法基础数据问题

## 问题分析

### 问题 1：Forgot 卡片不应显示"今日已学习，此次学习将覆盖今日数据"提醒

**现状**：在 [PracticeOverlay.tsx:323-327](src/components/overlay/PracticeOverlay.tsx#L323-L327) 中，`isReScoring` 检测逻辑仅判断 `dateCreated` 是否为今天，不区分"同日重新评分"和"forgot 后再复习"两种场景：

```typescript
const isReScoring = currentCardData?.dateCreated
  && dateUtils.isSameDay(currentCardData.dateCreated, new Date());
if (isReScoring) {
  setShowOverwriteReminder(true);
}
```

**问题**：当用户标记一张卡片为 "Forgot" 后，该卡片会被重新插入复习队列（通过 `forgotReinsertOffset`），用户必然要在今天内再次复习它。此时显示"覆盖数据"提醒是不必要的，因为 Forgot 卡片今天必须再复习，不存在"覆盖"的歧义。

**修复方案**：在 `isReScoring` 条件中增加判断——如果当前卡片的上一次评分是 `sm2_grade === 0`（Forgot），则不显示覆盖提醒。

---

### 问题 2：SM2 算法在 Forgot 后再复习时使用了错误的基础数据

**现状**：在 [PracticeOverlay.tsx:311-313](src/components/overlay/PracticeOverlay.tsx#L311-L313) 中，`baseData` 的计算逻辑优先使用 `baseSessionDataMap`：

```typescript
const baseData = currentCardRefUid && baseSessionDataMap.current[currentCardRefUid]
    ? { ...generateNewSession(), ...baseSessionDataMap.current[currentCardRefUid] }
    : (currentCardRefUid ? practiceData[currentCardRefUid] : currentCardData) || currentCardData;
```

`baseSessionDataMap` 存储的是**今天第一次复习之前**的卡片状态（即昨天的 SM2 数据）。这个设计的初衷是支持"同日重新评分"场景——如果用户把 Good 改成 Perfect，应该基于评分前的状态重新计算。

**问题**：当卡片被标记 "Forgot" 后重新插入队列再次复习时，`baseData` 仍然使用 `baseSessionDataMap` 中的旧数据（例如 interval=6, repetitions=2），而不是 Forgot 后的重置状态（interval=0, repetitions=0）。这导致 SM2 算法在计算时**完全忽略了 Forgot 的重置效果**，相当于用户从未 Forgot 过。

**具体影响举例**：
1. 用户复习卡片，标记 Forgot → SM2 重置为 interval=0, repetitions=0, eFactor 下降
2. 卡片重新插入队列，用户再次复习并打 Good(4)
3. **期望行为**：基于重置状态计算 → interval=1, repetitions=1（从零开始）
4. **实际行为**：基于旧状态计算 → interval=round(6 * 2.5 * 4/5)=12, repetitions=3（完全跳过了重置）

同样的问题也存在于 [PracticeOverlay.tsx:147-153](src/components/overlay/PracticeOverlay.tsx#L147-L153) 的 `baseCardData` useMemo 中，影响 Footer 中间隔预估的显示。

**修复方案**：当 `currentCardData.sm2_grade === 0`（卡片上一次被标记为 Forgot）时，不使用 `baseSessionDataMap`，而是使用 `currentCardData`（包含 Forgot 后的重置状态）作为 SM2 计算的基础数据。

---

## 实施步骤

### 步骤 1：修复覆盖提醒逻辑

**文件**：`src/components/overlay/PracticeOverlay.tsx`

修改 `isReScoring` 条件，增加 `currentCardData.sm2_grade !== 0` 判断：

```typescript
// 修改前
const isReScoring = currentCardData?.dateCreated
  && dateUtils.isSameDay(currentCardData.dateCreated, new Date());

// 修改后
const isReScoring = currentCardData?.dateCreated
  && dateUtils.isSameDay(currentCardData.dateCreated, new Date())
  && currentCardData.sm2_grade !== 0;
```

### 步骤 2：修复 `baseData` 的 SM2 基础数据逻辑

**文件**：`src/components/overlay/PracticeOverlay.tsx`

修改 `onPracticeClick` 中的 `baseData` 计算，当卡片上一次评分为 Forgot 时使用 `currentCardData`：

```typescript
// 修改前
const baseData = currentCardRefUid && baseSessionDataMap.current[currentCardRefUid]
    ? { ...generateNewSession(), ...baseSessionDataMap.current[currentCardRefUid] }
    : (currentCardRefUid ? practiceData[currentCardRefUid] : currentCardData) || currentCardData;

// 修改后
const isForgotReReview = currentCardData?.sm2_grade === 0;
const baseData = (currentCardRefUid && baseSessionDataMap.current[currentCardRefUid] && !isForgotReReview)
    ? { ...generateNewSession(), ...baseSessionDataMap.current[currentCardRefUid] }
    : (currentCardRefUid ? practiceData[currentCardRefUid] : currentCardData) || currentCardData;
```

### 步骤 3：修复 `baseCardData` 的 SM2 基础数据逻辑（间隔预估显示）

**文件**：`src/components/overlay/PracticeOverlay.tsx`

修改 `baseCardData` useMemo，与 `baseData` 保持一致的逻辑：

```typescript
// 修改前
const baseCardData = React.useMemo(() => {
    if (!currentCardRefUid) return currentCardData;
    if (baseSessionDataMap.current[currentCardRefUid]) {
      return { ...generateNewSession(), ...baseSessionDataMap.current[currentCardRefUid] };
    }
    return practiceData[currentCardRefUid] || currentCardData;
  }, [currentCardRefUid, practiceData, currentCardData]);

// 修改后
const baseCardData = React.useMemo(() => {
    if (!currentCardRefUid) return currentCardData;
    const isForgotReReview = currentCardData?.sm2_grade === 0;
    if (baseSessionDataMap.current[currentCardRefUid] && !isForgotReReview) {
      return { ...generateNewSession(), ...baseSessionDataMap.current[currentCardRefUid] };
    }
    return practiceData[currentCardRefUid] || currentCardData;
  }, [currentCardRefUid, practiceData, currentCardData]);
```

### 步骤 4：验证

- 运行现有测试确保无回归
- 手动验证以下场景：
  1. Forgot 后再复习：不显示覆盖提醒，SM2 基于重置状态计算
  2. 同日重新评分（非 Forgot）：仍显示覆盖提醒，SM2 基于 baseSessionData 计算
  3. 正常复习流程：不受影响
