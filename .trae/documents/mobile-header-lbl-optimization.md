# 实施计划：移动端状态栏简化 + LBL 卡片完成逻辑优化

## 需求概述

1. **移动端状态栏精简**：手机端顶部只显示面包屑开关、设置面板开关、卡片队列数量，隐藏其他信息
2. **LBL 卡片完成状态**：逐行阅读/逐行记忆卡片在所有子 block 完成前，视为未完成今日复习，不改变队列排序
3. **LBL 记忆卡片 Forgot 翻页**：逐行记忆卡片 Forgot 后翻到下一张卡，而非继续下一行子 block

---

## 任务 1：移动端状态栏精简

### 涉及文件
- [Header.tsx](file:///Users/a123/Documents/chengxu%20project/roam-memo-main/src/components/overlay/Header.tsx)

### 当前状态
Header 右侧区域依次显示：
1. LBL 行号标签 (`L1/5`)
2. 面包屑切换按钮 (eye-open/eye-off)
3. 设置按钮 (cog)
4. ModeBadge (Spaced/Fixed/LBL 标签)
5. StatusBadge (New/Due Today/Past Due/Cramming 标签)
6. 卡片计数 (`3/15`)
7. 关闭按钮

Header 左侧区域显示：
1. BoxIcon (box 图标)
2. TagSelector (标签选择器，含 due/new 计数)

### 修改方案
在移动端（`@media (max-width: 768px)`）隐藏以下元素：
- **TagSelector**（左侧整个标签选择器区域，含 BoxIcon）
- **LBL 行号标签** (`L1/5`)
- **ModeBadge**（Spaced/Fixed/LBL）
- **StatusBadge**（New/Due Today/Past Due/Cramming）

保留显示：
- 面包屑切换按钮
- 设置按钮
- 卡片队列数量 (`3/15`)
- 关闭按钮

### 实现步骤
1. 在 `Header.tsx` 中引入 `mediaQueries` 或使用内联 CSS `@media (max-width: 768px)` 
2. 为需要隐藏的元素添加 CSS class，在移动端设置 `display: none`
3. 具体修改：
   - 左侧 `div.flex.items-center`（含 BoxIcon + TagSelector）：添加移动端隐藏样式
   - LBL 行号 `Blueprint.Tag`：添加移动端隐藏样式
   - ModeBadge `span[data-testid="mode-badge"]`：添加移动端隐藏样式
   - StatusBadge `span[data-testid="status-badge"]`：添加移动端隐藏样式

### 实现方式
使用 `styled-components` 的 `css` helper 或直接在 `HeaderWrapper` 中添加媒体查询，为需要隐藏的元素添加 `.mobile-hide` class：

```css
@media (max-width: 768px) {
  .mobile-hide {
    display: none !important;
  }
}
```

然后在对应元素上添加 `className="mobile-hide"`。

---

## 任务 2：LBL 卡片完成状态优化

### 涉及文件
- [today.ts](file:///Users/a123/Documents/chengxu%20project/roam-memo-main/src/queries/today.ts) — `calculateCompletedTodayCounts` 函数

### 当前行为
`calculateCompletedTodayCounts` 判断卡片是否"今日已完成"的逻辑：
```typescript
const isCompletedToday = cardData && dateUtils.isSameDay(cardData.dateCreated, new Date());
```
只要 `dateCreated` 是今天，就计为"已完成今日复习"。

**问题**：LBL 卡片在部分子 block 被复习后，`dateCreated` 被更新为今天（在 `sessionOverrides` 中设置），导致卡片被计入"已完成今日复习"。这会：
- 增加 `completed` 计数，影响 `limitRemainingPracticeData` 的限额计算
- 可能导致卡片在重启会话后队列位置变化

### 修改方案
在 `calculateCompletedTodayCounts` 中，对 LBL 卡片增加额外判断：
- 如果卡片的 `interaction === 'LBL'` 且有 `lbl_progress`
- 且 `nextDueDate` 是今天（表示仍有未完成的子 block，因为 `updateLineByLineProgress` 在有未读子 block 时将 `nextDueDate` 设为今天）
- 则不计入"已完成今日复习"

### 实现步骤
修改 `calculateCompletedTodayCounts` 函数：

```typescript
Object.keys(currentTagSessionData).forEach((cardUid) => {
  const cardData = currentTagSessionData[cardUid];
  if (cardData?.isNew) return;
  const isCompletedToday =
    cardData && dateUtils.isSameDay(cardData.dateCreated, new Date());

  if (isCompletedToday) {
    // LBL 卡片在有未完成子 block 时不计入"已完成今日复习"
    if (cardData.interaction === 'LBL' && cardData.lbl_progress) {
      const progress = JSON.parse(cardData.lbl_progress);
      const hasDueChildren = Object.values(progress).some((child: any) =>
        child?.nextDueDate && new Date(child.nextDueDate) <= new Date()
      );
      if (hasDueChildren) return;
    }

    count++;
    completedUids.push(cardUid);
  }
});
```

**判断逻辑说明**：
- 解析 `lbl_progress`，检查是否存在任何子 block 的 `nextDueDate <= now`
- 如果存在，说明仍有子 block 未彻底完成（包括 Forgot 后 interval=0 的子 block），不计为已完成
- 如果所有子 block 的 `nextDueDate` 都在未来，说明已彻底完成，计为已完成
- 非 LBL 卡片或没有 `lbl_progress` 的 LBL 卡片，保持原有逻辑

---

## 任务 3：LBL 记忆卡片 Forgot 后翻页

### 涉及文件
- [useLineByLineReview.ts](file:///Users/a123/Documents/chengxu%20project/roam-memo-main/src/hooks/useLineByLineReview.ts) — `onLineByLineGrade` 函数（LBL + SM2 分支）

### 当前行为
LBL + SM2 模式下，当用户标记 Forgot（grade === 0）：
1. 当前子 block 用 SM2 算法计算间隔（interval=0, nextDueDate=今天）
2. 卡片被插队到队列后方 `currentIndex + 1 + forgotReinsertOffset` 位置
3. `lineByLineCurrentChildIndex` 递增，继续显示下一行子 block

**问题**：Forgot 已经把卡片插到 N 张以后让用户再次复习，此时继续阅读下一行子 block 不符合记忆规律。正确的做法是翻到下一张卡，等卡片再次从队列出现时再继续。

### 修改方案
当 grade === 0（Forgot）时：
1. 保持现有的 SM2 计算和插队逻辑不变
2. 将 `setCurrentIndex(prev => prev + 1)` 替代 `setLineByLineCurrentChildIndex(nextIndex)`，翻到下一张卡
3. 不更新 `lineByLineRevealedCount`（保持当前揭示状态，下次回来时 useEffect 会重新计算）
4. 设置 `setShowAnswers(false)`

### 实现步骤
修改 `onLineByLineGrade` 中 LBL + SM2 分支（约第 197-264 行）：

**修改前**（关键部分）：
```typescript
if (grade === 0 && forgotReinsertOffset > 0 && currentCardRefUid) {
  // ... 插队逻辑
}

const nextIndex = lineByLineCurrentChildIndex + 1;
const isCardFinished = nextIndex >= childUidsList.length;

if (isCardFinished) {
  setCurrentIndex((prev) => prev + 1);
  // ...
  return;
}

setLineByLineCurrentChildIndex(nextIndex);
setLineByLineRevealedCount(nextIndex);
setShowAnswers(false);
```

**修改后**：
```typescript
if (grade === 0 && forgotReinsertOffset > 0 && currentCardRefUid) {
  // ... 插队逻辑（保持不变）
}

// Forgot: 翻到下一张卡，而非继续下一行子 block
if (grade === 0) {
  setCurrentIndex((prev) => prev + 1);
  setShowAnswers(false);
  return;
}

const nextIndex = lineByLineCurrentChildIndex + 1;
const isCardFinished = nextIndex >= childUidsList.length;

if (isCardFinished) {
  setCurrentIndex((prev) => prev + 1);
  // ...
  return;
}

setLineByLineCurrentChildIndex(nextIndex);
setLineByLineRevealedCount(nextIndex);
setShowAnswers(false);
```

**行为说明**：
- Forgot 后，卡片被插队到 N 张以后，用户翻到队列中的下一张卡
- 当卡片再次从队列出现时，`useLineByLineReview` 的 `useEffect` 会根据 `lbl_progress` 重新计算 `firstDueIndex`，找到第一个 due 的子 block（即 Forgot 的那行），从那里继续复习
- 非 Forgot 的打分（Hard/Good/Perfect）行为不变，继续下一行子 block

---

## 实施顺序

1. 任务 1：移动端状态栏精简（Header.tsx）
2. 任务 2：LBL 卡片完成状态优化（today.ts）
3. 任务 3：LBL 记忆卡片 Forgot 翻页（useLineByLineReview.ts）
4. 构建验证：运行 `npm run build` 确认无编译错误
