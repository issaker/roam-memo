# 数据字段系统重构计划

## 问题根因分析

### Bug 1: 数据字段重复（最关键）

**根因**: [save.ts:133-153](src/queries/save.ts#L133-L153) 中 `savePracticeData` 函数将 `algorithm` 和 `interaction` **写了两次**：

1. **第一次**（133-146行）：`for` 循环遍历 `data` 对象的所有 key，包括 `algorithm` 和 `interaction`，为每个 key 创建子 block
2. **第二次**（148-153行）：循环结束后，又显式创建了 `algorithm::` 和 `interaction::` block

每次调用 `savePracticeData` 都会产生重复字段。这就是用户看到 `interaction:: NORMAL` 和 `algorithm:: SM2` 各出现两次的直接原因。

### Bug 2: 幽灵字段 `intervalMultiplierType`

`intervalMultiplierType` 仅存在于 [SESSION_SNAPSHOT_KEYS](src/queries/data.ts#L141)（快照合并键列表），但：
- 不在 `Session` 类型定义中
- 不被 `savePracticeData` 写入
- 不被任何代码读取
- 功能上完全等同于 `algorithm:: PROGRESSIVE`

这是遗留的废弃字段，只会造成混淆。

### Bug 3: `InteractionStyle.READ`（Incremental Read）与 LBL 语义重复

当前三种交互模式：
- `NORMAL` — 普通翻卡
- `LBL` — 逐行交互（SM2 打分）
- `READ` — 逐行交互（Progressive 自动翻页）

`READ` 本质上就是 `LBL + Progressive`。算法已经决定了交互方式（SM2 用打分，Progressive 用 Next），再单独增加一种交互类型只会让用户困惑。

### Bug 4: 字段命名不规范

当前字段如 `repetitions`、`interval`、`eFactor` 没有标明归属算法，调试时无法快速定位问题。

---

## 重构方案

### Phase 1: 修复重复字段 Bug（紧急，无破坏性变更）

**修改文件**: `src/queries/save.ts`

1. 在 `savePracticeData` 的 for 循环中，跳过 `algorithm` 和 `interaction`（与跳过 `reviewMode` 一样），因为它们在循环后显式写入
2. 修改 133-146 行的循环，增加跳过条件：
   ```typescript
   if (key === 'reviewMode') continue;
   if (key === 'algorithm') continue;  // 新增
   if (key === 'interaction') continue; // 新增
   ```
3. 添加数据清理函数 `deduplicateSessionFields`，扫描并删除已存在的重复 `algorithm::` 和 `interaction::` block

**修改文件**: `src/components/MigrateLegacyDataPanel.tsx`

4. 在迁移面板中增加"清理重复字段"功能，调用 `deduplicateSessionFields`

### Phase 2: 移除幽灵字段 `intervalMultiplierType`

**修改文件**: `src/queries/data.ts`

1. 从 `SESSION_SNAPSHOT_KEYS` 数组中移除 `'intervalMultiplierType'`
2. 在 `parseFieldValuesFromChildren` 中添加跳过逻辑：`if (key === 'intervalMultiplierType') continue;`

**修改文件**: `src/components/MigrateLegacyDataPanel.tsx`

3. 在迁移面板中增加清理 `intervalMultiplierType::` block 的逻辑

### Phase 3: 合并 READ 到 LBL（简化交互类型）

**核心思路**: 移除 `InteractionStyle.READ`，LBL 的行为完全由算法决定：
- **LBL + SM2**: 每行子 block 用 SM2 打分（Forgot/Hard/Good/Perfect），"Forgot" 触发向后插队，其他打分进入下一行
- **LBL + Progressive**: 只显示 "Next" 按钮，自动翻页，以插队方式 N 张后再读下一行

#### 3.1 修改类型定义

**修改文件**: `src/models/session.ts`

1. 从 `InteractionStyle` 枚举中移除 `READ = 'READ'`
2. 从 `INTERACTION_META` 中移除 `READ` 条目
3. 移除 `isIncrementalReadMode` 函数
4. 修改 `isLineByLineUI` 为：`interaction === InteractionStyle.LBL`
5. 更新 `resolveReviewConfig`：遇到 `'READ'` 值时映射为 `InteractionStyle.LBL`

#### 3.2 修改 LBL 行为逻辑

**修改文件**: `src/hooks/useLineByLineReview.ts`

1. 移除 `isIncrementalRead` 参数
2. 用算法判断替代交互类型判断：
   - `isIncrementalRead` → `algorithm === SchedulingAlgorithm.PROGRESSIVE`（或更广泛地 `isFixedAlgorithm(algorithm)`）
   - Progressive/Fixed 算法 + LBL = 自动翻页模式（原 Incremental Read 行为）
   - SM2 + LBL = 打分模式（原 LBL 行为）
3. 修改初始化逻辑：Progressive + LBL 时自动 reveal 当前子 block
4. 修改打分逻辑：
   - Progressive + LBL：使用 `progressiveInterval()`，触发 read reinsert
   - SM2 + LBL：使用 `supermemo()`，"Forgot" 触发 forgot reinsert

#### 3.3 修改 UI 组件

**修改文件**: `src/components/overlay/Footer.tsx`

1. 从 `INTERACTION_OPTIONS` 中移除 `READ` 选项
2. 修改 `GradingControlsWrapper` 中的模式判断：
   - `isIncrementalReadActive` → `isLineByLineUI && isFixedMode(algorithm)`（LBL + Fixed/Progressive）
3. `IncrementalReadControls` 组件重命名为 `LblNextControls` 或保持原名但调整条件

**修改文件**: `src/components/overlay/PracticeOverlay.tsx`

1. 移除所有 `isIncrementalReadMode` 调用
2. 用算法判断替代：`isIncrementalRead` → `isLineByLineUI && isFixedMode(algorithm)`
3. 修改 `showAnswers` 初始化逻辑

#### 3.4 修改设置

**修改文件**: `src/components/SettingsForm.tsx`

1. 将 "Reinsert 'Incremental Read' Cards After N Cards" 重命名为 "Reinsert 'LBL Next' Cards After N Cards"
2. 更新描述文字

**修改文件**: `src/hooks/useSettings.ts`

1. `readReinsertOffset` 保留字段名不变（内部命名，用户不可见），或重命名为 `lblNextReinsertOffset`

#### 3.5 修改迁移映射

**修改文件**: `src/components/MigrateLegacyDataPanel.tsx`

1. 修改 `LEGACY_MODE_TO_CONFIG`：`FIXED_PROGRESSIVE_LBL` 映射为 `{ algorithm: PROGRESSIVE, interaction: LBL }`（原来是 `READ`）

#### 3.6 修改数据读写

**修改文件**: `src/queries/save.ts`

1. `updateReviewConfig` 中遇到 `READ` 值时映射为 `LBL`

**修改文件**: `src/queries/data.ts`

1. `parseFieldValuesFromChildren` 中遇到 `interaction: 'READ'` 时映射为 `'LBL'`

### Phase 4: 字段命名规范化

**命名规则**: `{归属}_{用途}`

| 旧字段名 | 新字段名 | 归属 | 说明 |
|----------|---------|------|------|
| `algorithm` | `algorithm` | 通用 | 配置字段，无需前缀 |
| `interaction` | `interaction` | 通用 | 配置字段，无需前缀 |
| `nextDueDate` | `nextDueDate` | 通用 | 通用字段，无需前缀 |
| `dateCreated` | `dateCreated` | 通用 | 通用字段，无需前缀 |
| `repetitions` | `sm2_repetitions` | SM2 | SM2 重复次数 |
| `interval` | `sm2_interval` | SM2 | SM2 间隔天数 |
| `eFactor` | `sm2_eFactor` | SM2 | SM2 易度因子 |
| `grade` | `sm2_grade` | SM2 | SM2 打分 |
| `progressiveRepetitions` | `progressive_repetitions` | Progressive | 已符合规范 |
| `intervalMultiplier` | 拆分为两个字段 | — | 见下方说明 |
| — | `progressive_interval` | Progressive | Progressive 计算出的间隔 |
| — | `fixed_multiplier` | Fixed | Fixed 的用户配置乘数 |
| `lineByLineProgress` | `lbl_progress` | LBL | LBL 逐行进度 |

**`intervalMultiplier` 拆分说明**:
- 当前 `intervalMultiplier` 在 Progressive 路径存储的是**计算输出**（2, 6, 12, 24...）
- 在 Fixed 路径存储的是**用户输入**（如 3 表示每 3 天）
- 拆分后语义更清晰，且符合 Mode Independence Principle（每个算法只操作自己的字段）

**`LineByLineChildData` JSON 内部键名**:

| 旧键名 | 新键名 | 说明 |
|--------|--------|------|
| `nextDueDate` | `nextDueDate` | 通用，不变 |
| `interval` | `sm2_interval` | SM2 间隔 |
| `repetitions` | `sm2_repetitions` | SM2 重复次数 |
| `eFactor` | `sm2_eFactor` | SM2 易度因子 |
| `progressiveRepetitions` | `progressive_repetitions` | Progressive 重复次数 |

#### 4.1 修改类型定义

**修改文件**: `src/models/session.ts`

1. 更新 `Session` 类型的字段名
2. 更新 `LineByLineChildData` 的字段名
3. 更新 `NewSession` 类型

#### 4.2 修改算法逻辑

**修改文件**: `src/practice.ts`

1. `generatePracticeData` 返回值使用新字段名
2. SM2 路径：返回 `sm2_repetitions`, `sm2_interval`, `sm2_eFactor`, `sm2_grade`
3. Progressive 路径：返回 `progressive_repetitions`, `progressive_interval`
4. Fixed 路径：返回 `fixed_multiplier`
5. Mode Independence Principle：每个路径只操作自己的字段，其他字段原样传递

#### 4.3 修改数据读写

**修改文件**: `src/queries/data.ts`

1. 更新 `SESSION_SNAPSHOT_KEYS` 使用新字段名
2. `parseFieldValuesFromChildren` 添加旧名→新名映射（兼容旧数据）
3. `mergeSessionSnapshot` 使用新字段名

**修改文件**: `src/queries/save.ts`

1. `savePracticeData` 使用新字段名写入
2. `upsertLatestSessionField` 使用新字段名
3. `updateLineByLineProgress` 使用新字段名
4. `updateReviewConfig` 使用新字段名

#### 4.4 修改 UI 和 Hook

**修改文件**: `src/hooks/useLineByLineReview.ts`

1. 使用新字段名访问 `lbl_progress` 和 `LineByLineChildData`
2. 更新 `progressive_interval` 和 `fixed_multiplier` 的使用

**修改文件**: `src/components/overlay/PracticeOverlay.tsx`

1. 使用新字段名访问 card data

**修改文件**: `src/components/overlay/Footer.tsx`

1. 使用新字段名访问 interval estimates

**修改文件**: `src/queries/utils.ts`

1. `generateNewSession` 使用新字段名

**修改文件**: `src/queries/today.ts`

1. 排序逻辑使用新字段名（`sm2_eFactor`, `sm2_repetitions`）

### Phase 5: 数据迁移

**修改文件**: `src/components/MigrateLegacyDataPanel.tsx`

添加完整的迁移逻辑：

1. **清理重复字段**: 删除 session block 中重复的 `algorithm::` 和 `interaction::` block
2. **删除废弃字段**: 删除所有 `intervalMultiplierType::` block
3. **转换交互类型**: 将 `interaction:: READ` 转换为 `interaction:: LBL`
4. **重命名字段**: 将旧字段名 block 转换为新字段名 block
   - `repetitions::` → `sm2_repetitions::`
   - `interval::` → `sm2_interval::`
   - `eFactor::` → `sm2_eFactor::`
   - `grade::` → `sm2_grade::`
   - `progressiveRepetitions::` → `progressive_repetitions::`
   - `intervalMultiplier::` → `progressive_interval::` 或 `fixed_multiplier::`（根据算法判断）
   - `lineByLineProgress::` → `lbl_progress::`
5. **重命名 JSON 内部键**: 解析 `lbl_progress` JSON，重命名内部键

**修改文件**: `src/queries/data.ts`

6. 在 `parseFieldValuesFromChildren` 中添加旧名→新名的兼容映射，确保旧数据仍可正确读取

---

## 实施顺序和依赖关系

```
Phase 1 (修复重复 Bug) ← 独立，可先实施
    ↓
Phase 2 (移除幽灵字段) ← 独立，可先实施
    ↓
Phase 3 (合并 READ → LBL) ← 依赖 Phase 1（避免在重复字段上操作）
    ↓
Phase 4 (字段命名规范化) ← 依赖 Phase 3（基于简化后的交互模型）
    ↓
Phase 5 (数据迁移) ← 依赖 Phase 4（需要知道新字段名）
```

## 风险评估

1. **Phase 1-2**: 低风险，纯粹的 bug 修复和清理
2. **Phase 3**: 中风险，需要仔细处理 READ → LBL 的行为映射，确保 LBL + Progressive 的行为与原 Incremental Read 完全一致
3. **Phase 4**: 高风险，字段重命名涉及所有数据读写路径，需要确保旧数据兼容
4. **Phase 5**: 中风险，数据迁移需要处理大量 block 操作，需要批量处理和错误恢复

## 测试要点

1. 验证 `savePracticeData` 不再产生重复字段
2. 验证 LBL + SM2 行为：打分 → 下一行，Forgot → 插队
3. 验证 LBL + Progressive 行为：Next → 翻页插队，与原 Incremental Read 一致
4. 验证 NORMAL + SM2/Fixed 行为不受影响
5. 验证旧数据（旧字段名）能正确读取
6. 验证新数据使用新字段名写入
7. 验证数据迁移后所有字段正确转换
