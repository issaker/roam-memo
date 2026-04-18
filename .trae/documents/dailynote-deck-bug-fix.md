# DailyNote 特殊牌组 Bug 分析与修复计划

## 一、设计意图

DailyNote 牌组的设计意图是：**将 Roam Research 中所有日记页面（Daily Notes / Journal Pages）的顶层 block 聚合为一个可复习的特殊牌组**。

具体来说：
1. **虚拟牌组**：DailyNote 不对应任何 Roam 中的 Tag 页面，而是通过特殊查询动态聚合
2. **卡片来源**：所有日记页面的**顶层 block**（非嵌套子 block）
3. **默认启用**：`dailynoteEnabled` 默认值为 `true`
4. **与普通牌组共享调度逻辑**：卡片收集后，新卡/到期卡分类、SM2 调度、每日限额等逻辑与普通牌组完全一致
5. **UI 区分**：牌组选择器中 DailyNote 牌组显示日历图标 📅

设置界面的描述为：
> "Aggregate all top-level blocks from your DailyNote pages into a special deck for review."

---

## 二、设计实现逻辑

### 2.1 完整数据流

```
用户设置 dailynoteEnabled = true
        │
        ▼
   useTags Hook → 将 'DailyNote' 追加到 tagsList
        │
        ▼
   getPracticeData 遍历 tagsList
   对每个 tag 调用 getSessionData
        │
        ├── tag === 'DailyNote' ?
        │       ├── YES → getDailyNoteBlockUids()
        │       │         执行 dailyNoteBlockUidsQuery
        │       │         返回所有日记页面非空顶层块的 UID
        │       └── NO  → getPageReferenceIds + getSelectedTagPageBlocksIds
        │
        ▼
   用 UID 集合过滤 pluginPageData 得到 sessionData
        │
        ▼
   addNewCards（用 cardUids 找新卡）
   addDueCards（用 sessionData 找到期卡）
   limitRemainingPracticeData / calculateCombinedCounts / calculateTodayStatus
        │
        ▼
   PracticeOverlay: 卡片队列 = [...dueUids, ...newUids]
```

### 2.2 关键代码位置

| 文件 | 作用 |
|------|------|
| [constants.ts](src/constants.ts) | `DAILYNOTE_DECK_KEY = 'DailyNote'` |
| [useTags.tsx](src/hooks/useTags.tsx) | 当 dailynoteEnabled 时追加 'DailyNote' 到 tagsList |
| [utils.ts L193-206](src/queries/utils.ts#L193-L206) | **`dailyNoteBlockUidsQuery` 和 `getDailyNoteBlockUids()`** ← 🔴 BUG 所在 |
| [data.ts L365-397](src/queries/data.ts#L365-L397) | `getSessionData` 中 DailyNote 分支逻辑 |
| [today.ts](src/queries/today.ts) | 卡片分类/调度（DailyNote 无特殊处理） |

### 2.3 当前 Datalog 查询（有 Bug）

```clojure
[:find ?blockUid
 :where
 [?page :page/create-email]          ← 🔴 问题所在
 [?page :block/children ?block]
 [?block :block/uid ?blockUid]
 [?block :block/string ?str]
 [(not= ?str "")]]
```

---

## 三、Bug 根因分析

### 3.1 核心问题：`:page/create-email` 属性不存在

经过调研 Roam Research 的数据模型，发现：

1. **`:page/create-email` 不是有效的 Datalog 属性**。Roam 的 JSON 导出格式中，页面属性名为 `create-email`（无 `page/` 前缀），在 Datalog 中对应的是 `:create-email` 而非 `:page/create-email`。

2. **即使改为 `:create-email` 也不对**。因为 Roam 中**所有页面**（包括普通页面和日记页面）都有 `create-email` 属性，它记录的是创建该页面的用户邮箱。用 `:create-email` 筛选会返回**所有页面的所有顶层 block**，而非仅日记页面。

3. **当前查询返回 0 结果**。由于 `:page/create-email` 在 Roam Datalog schema 中不存在，查询静默失败返回空数组 → `cardUids['DailyNote'] = []` → `addNewCards` 找不到新卡 → `addDueCards` 找不到到期卡 → 牌组显示 0 张卡片 → 直接展示 "You're all caught up!" 画面。

### 3.2 因果链

```
:page/create-email 属性不存在
    → Datalog 查询返回 []
    → getDailyNoteBlockUids() 返回 []
    → cardUids['DailyNote'] = []
    → sessionData['DailyNote'] = {}
    → addNewCards: 无新卡 (newUids = [])
    → addDueCards: 无到期卡 (dueUids = [])
    → today.tags['DailyNote'] = { due: 0, new: 0, status: Finished }
    → PracticeOverlay: isDone = true → 显示 "You're all caught up!"
```

### 3.3 正确识别日记页面的方法

Roam Research 中日记页面（Daily Notes）的唯一可靠标识是**页面标题格式**：

- 英文格式：`"January 1st, 2024"`, `"February 2nd, 2024"`, `"March 3rd, 2024"` 等
- 格式模式：`月份名 + 日期(1-2位) + 序数后缀(st/nd/rd/th) + 逗号 + 空格 + 4位年份`

这与项目中已有的 `mockDateToRoamDateString` 和 `mockPageTitleToDate` 函数所使用的格式完全一致。

---

## 四、修复方案

### 方案：基于页面标题格式识别日记页面

修改 `getDailyNoteBlockUids()` 函数，使用两步查询：

1. **第一步**：Datalog 查询获取所有页面的 `uid` 和 `title`
2. **第二步**：在 JavaScript 中用正则过滤出日记页面
3. **第三步**：Datalog 查询获取这些日记页面的顶层 block UID

#### 修改文件：`src/queries/utils.ts`

```typescript
// 新增：日记页面标题正则（Roam 标准英文日期格式）
export const DAILY_NOTE_TITLE_PATTERN = /^[A-Z][a-z]+ \d{1,2}(st|nd|rd|th), \d{4}$/;

// 新增：获取所有页面标题和 UID 的查询
export const allPagesQuery = `
  [:find ?uid ?title
   :where
   [?page :node/title ?title]
   [?page :block/uid ?uid]]
`;

// 新增：获取指定页面顶层 block 的查询
export const pageTopLevelBlocksQuery = `
  [:find ?blockUid
   :in $ ?pageUid
   :where
   [?page :block/uid ?pageUid]
   [?page :block/children ?block]
   [?block :block/uid ?blockUid]
   [?block :block/string ?str]
   [(not= ?str "")]]
`;

// 修改：getDailyNoteBlockUids 函数
export const getDailyNoteBlockUids = async (): Promise<string[]> => {
  // Step 1: 获取所有页面
  const pages = window.roamAlphaAPI.q(allPagesQuery);

  // Step 2: 过滤日记页面
  const dailyNotePageUids = pages
    .filter((arr) => DAILY_NOTE_TITLE_PATTERN.test(arr[1]))
    .map((arr) => arr[0]);

  if (!dailyNotePageUids.length) {
    return [];
  }

  // Step 3: 获取日记页面的顶层 block
  const blockUids: string[] = [];
  for (const pageUid of dailyNotePageUids) {
    const blocks = window.roamAlphaAPI.q(pageTopLevelBlocksQuery, pageUid);
    blockUids.push(...blocks.map((arr) => arr[0]));
  }

  return blockUids;
};
```

#### 同时修改：`src/utils/testUtils.ts`

更新 mock 中的 `dailyNoteBlockUidsQuery` 引用，替换为新的查询 mock。

---

## 五、实施步骤

1. **修改 `src/queries/utils.ts`**：
   - 新增 `DAILY_NOTE_TITLE_PATTERN` 常量
   - 新增 `allPagesQuery` 查询
   - 新增 `pageTopLevelBlocksQuery` 查询
   - 重写 `getDailyNoteBlockUids()` 函数
   - 保留旧的 `dailyNoteBlockUidsQuery` 常量（标记为 deprecated）以避免破坏测试

2. **修改 `src/utils/testUtils.ts`**：
   - 更新 mock 查询以匹配新的查询模式
   - 添加 `allPagesQuery` 和 `pageTopLevelBlocksQuery` 的 mock

3. **运行测试验证**：`npm run test`

4. **类型检查**：`npm run typecheck`
