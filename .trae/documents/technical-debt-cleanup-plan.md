# 技术债务系统性清理计划

## 背景

项目经历了从旧架构（`ReviewModes` 枚举 + `meta block` + `cardType/reviewMode` 字段）到新架构（`SchedulingAlgorithm × InteractionStyle` + 统一 session block + `{owner}_{purpose}` 字段命名）的重大重构。虽然核心功能已完成迁移，但代码库中残留了大量过时引用、不一致命名、死代码和未清理的遗留定义。这些技术债务会随迭代持续累积，需要系统性对齐。

## 发现的技术债务分类

### A 类：代码逻辑与设计原则不一致（影响正确性）

| # | 问题 | 位置 | 严重程度 |
|---|------|------|----------|
| A1 | LBL+SM2 路径未保留 `progressive_repetitions`，违反算法独立原则 | useLineByLineReview.ts:216-224 | 中 |
| A2 | `LineByLineChildData` 接口 SM2 字段为必填，迫使 Fixed 路径填充无意义的默认值 | session.ts:68-74 | 中 |
| A3 | `savePracticeData` "删除全部→重写"策略存在字段丢失风险 | save.ts:147-166 | 中 |

### B 类：过时概念残留（影响可维护性）

| # | 问题 | 位置 | 严重程度 |
|---|------|------|----------|
| B1 | `modeIncrementalRead` 颜色定义已无实际用途（READ 已移除） | theme.ts:45 | 低 |
| B2 | `isLBLReviewMode` 与 `isLineByLineUI` 功能完全重复 | session.ts:151-155 | 低 |
| B3 | `isFixedMode` / `isSpacedMode` 与 `isFixedAlgorithm` / `isSpacedAlgorithm` 功能重复 | session.ts:141-149 | 低 |
| B4 | `NewRecords` 接口完全未使用 | session.ts:60-62 | 低 |
| B5 | `useOnBlockInteract.tsx` 中 `Arrive;` 无效表达式 | useOnBlockInteract.tsx:13 | 低 |
| B6 | `save.ts` 重复导入 `stringUtils` 和 `parseConfigString` | save.ts:24+27 | 低 |
| B7 | `useCachedData.tsx` 重复导入 `queries` 和 `saveCacheData` | useCachedData.tsx:8-9 | 低 |
| B8 | PracticeOverlay.tsx 注释引用旧概念 `reviewMode` | PracticeOverlay.tsx:9 | 低 |

### C 类：测试与文档中的过时引用（影响新开发者理解）

| # | 问题 | 位置 | 严重程度 |
|---|------|------|----------|
| C1 | 测试用例名称仍用 "Incremental Read" | PracticeOverlay.test.tsx:232,258 | 低 |
| C2 | `shouldReinsertReadCard` 函数名含 "Read" | PracticeOverlay.test.tsx:260 | 低 |
| C3 | 代码注释中 "原 Incremental Read 行为" 的历史参考 | useLineByLineReview.ts:92, Footer.tsx:296 | 低 |

### D 类：数据迁移不完整（影响数据完整性）

| # | 问题 | 位置 | 严重程度 |
|---|------|------|----------|
| D1 | `lineByLineReview` 字段未加入 `FIELDS_TO_DELETE`，迁移后残留为幽灵字段 | MigrateLegacyDataPanel.tsx:718 | 中 |
| D2 | `progressiveInterval` → `progressive_interval` 映射缺失 | MigrateLegacyDataPanel.tsx:708-716 | 低-中 |
| D3 | `intervalMultiplier` 统一映射为 `fixed_multiplier`，对 Progressive 卡片语义不精确 | MigrateLegacyDataPanel.tsx:714 | 低 |

### E 类：调试日志残留（影响生产环境整洁度）

| # | 问题 | 位置 | 严重程度 |
|---|------|------|----------|
| E1 | MigrateLegacyDataPanel.tsx 中 15 处 `console.log` 调试日志 | MigrateLegacyDataPanel.tsx | 中 |
| E2 | extension.tsx 中 3 处 `console.log` 初始化日志 | extension.tsx:48,95,113 | 低 |

---

## 实施步骤

### 第一阶段：修复代码逻辑不一致（A 类）

**步骤 1：修复 LBL+SM2 路径丢失 `progressive_repetitions`**
- 文件：`src/hooks/useLineByLineReview.ts`
- 在 SM2 路径的 `updatedProgress` 中添加 `progressive_repetitions: existingData?.progressive_repetitions`
- 确保与文件头注释声明的"算法独立原则"一致

**步骤 2：重构 `LineByLineChildData` 接口**
- 文件：`src/models/session.ts`
- 将 SM2 字段改为可选：`sm2_interval?: number; sm2_repetitions?: number; sm2_eFactor?: number;`
- 更新 `useLineByLineReview.ts` 中的写入代码，Fixed 路径不再填充 SM2 默认值
- 更新 `data.ts` 中解析 `lbl_progress` 的代码，处理可选字段

**步骤 3：为 `savePracticeData` 添加字段完整性校验**
- 文件：`src/queries/save.ts`
- 在重写 session block 前，校验写入数据是否包含所有 `SESSION_SNAPSHOT_KEYS` 中存在的字段
- 对缺失字段发出 `console.warn`，并从前一次 session 数据中补全

### 第二阶段：清理过时概念残留（B 类）

**步骤 4：移除 `modeIncrementalRead` 颜色定义**
- 文件：`src/theme.ts` — 删除 `modeIncrementalRead` 行
- 文件：`src/components/overlay/Header.tsx` — 搜索并移除对 `modeIncrementalRead` 的引用
- 同步更新 `THEME_SYSTEM.md` 中的相关说明

**步骤 5：统一重复的辅助函数**
- 文件：`src/models/session.ts`
- 保留 `isLBLReviewMode`（更准确的命名），删除 `isLineByLineUI`
- 更新所有导入 `isLineByLineUI` 的文件（Footer.tsx, useLineByLineReview.ts）改为 `isLBLReviewMode`
- 保留 `isFixedAlgorithm` / `isSpacedAlgorithm`（更准确的命名），删除 `isFixedMode` / `isSpacedMode`
- 更新所有导入 `isFixedMode` / `isSpacedMode` 的文件改为 `isFixedAlgorithm` / `isSpacedAlgorithm`
- 删除 `isSpacedMode` 对应的测试用例（session.test.ts）

**步骤 6：清理未使用的导出**
- 文件：`src/models/session.ts` — 移除 `NewRecords` 接口的 `export`（保留定义供内部使用）
- 其他未使用导出（`ReviewConfig`, `AlgorithmGroup`, `AlgorithmMeta`, `InteractionMeta`）保留，因为它们是类型定义，可能被未来代码使用

**步骤 7：清理死代码和重复导入**
- 文件：`src/hooks/useOnBlockInteract.tsx` — 删除 `Arrive;` 无效表达式
- 文件：`src/queries/save.ts` — 统一使用 `stringUtils.parseConfigString`，移除具名导入
- 文件：`src/hooks/useCachedData.tsx` — 统一使用 `queries.saveCacheData`，移除具名导入

**步骤 8：更新 PracticeOverlay.tsx 注释**
- 文件：`src/components/overlay/PracticeOverlay.tsx:9`
- 将 `reviewMode, intervalMultiplier` 更新为 `algorithm, interaction, intervalMultiplier`

### 第三阶段：清理测试与文档过时引用（C 类）

**步骤 9：更新测试用例**
- 文件：`src/components/overlay/PracticeOverlay.test.tsx`
- 将 `'Incremental Read (PROGRESSIVE + READ) shows line-by-line reading UI'` 重命名为 `'LBL + Progressive shows line-by-line reading UI'`
- 将 `'Incremental Read reinsertion stops on the last line'` 重命名为 `'LBL reinsertion stops on the last line'`
- 将 `shouldReinsertReadCard` 重命名为 `shouldReinsertLblCard`（需同步修改函数定义处）

**步骤 10：清理注释中的历史参考**
- 文件：`src/hooks/useLineByLineReview.ts:92` — 将 "原 Incremental Read 行为" 改为更准确的描述
- 文件：`src/components/overlay/Footer.tsx:296` — 同上

### 第四阶段：补全数据迁移逻辑（D 类）

**步骤 11：补全迁移字段清理**
- 文件：`src/components/MigrateLegacyDataPanel.tsx`
- 将 `lineByLineReview` 加入 `FIELDS_TO_DELETE`：`const FIELDS_TO_DELETE = ['intervalMultiplierType', 'lineByLineReview'];`
- 将 `progressiveInterval` 加入 `FIELD_RENAME_MAP`：`progressiveInterval: 'progressive_interval'`（防御性映射）
- 添加注释说明 `intervalMultiplier → fixed_multiplier` 映射的设计决策

### 第五阶段：清理调试日志（E 类）

**步骤 12：替换/移除调试日志**
- 文件：`src/components/MigrateLegacyDataPanel.tsx` — 将 15 处 `console.log` 替换为条件日志或移除
  - 方案：引入 `DEBUG_MIGRATION` 常量，仅在开发模式下输出日志
- 文件：`src/extension.tsx` — 移除 3 处 `console.log`（初始化日志对用户无价值）
- 保留所有 `console.error`（错误处理日志是合理的）

### 第六阶段：验证

**步骤 13：运行完整测试套件**
- `npm run typecheck` — 确保类型检查通过
- `npm run test` — 确保所有测试通过
- 手动验证关键路径：SM2 复习、LBL+SM2 复习、LBL+Progressive 复习、Fixed 复习

---

## 风险评估

| 步骤 | 风险 | 缓解措施 |
|------|------|----------|
| 步骤 2（重构接口） | 中 — 可能影响 lbl_progress 解析逻辑 | 仔细检查 data.ts 中的 JSON.parse 路径 |
| 步骤 5（统一函数） | 低 — 纯重命名，IDE 可追踪 | 全局搜索确认无遗漏 |
| 步骤 11（迁移补全） | 低 — 仅添加防御性映射，不影响已迁移数据 | 迁移本身设计为幂等 |
| 步骤 12（日志清理） | 低 — 仅移除 console.log | 保留 console.error |

## 预期成果

- 消除 3 处代码逻辑与设计原则不一致
- 移除 8 处过时概念残留
- 清理 3 处测试/文档过时引用
- 补全 2 处数据迁移遗漏
- 清理 ~18 处调试日志残留
- 代码库概念模型与新架构完全对齐，无歧义引用
