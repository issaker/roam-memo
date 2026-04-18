# Tasks

## Phase 1: DailyNote 牌堆 — 数据层（无 UI 依赖，可独立进行）

- [x] Task 1: 新增 DailyNote 常量和设置项
  - [x] 1.1: 在 `src/constants.ts` 中新增 `DAILYNOTE_DECK_KEY = 'DailyNote'` 常量
  - [x] 1.2: 在 `src/hooks/useSettings.ts` 的 `Settings` 类型中新增 `dailynoteEnabled: boolean` 字段
  - [x] 1.3: 在 `defaultSettings` 中新增 `dailynoteEnabled: true`
  - [x] 1.4: 在 `SETTING_TYPES` 中新增 `dailynoteEnabled: 'boolean'`
  - [x] 1.5: 在 `src/queries/settings.ts` 的 `saveSettingsToPage` 和 `loadSettingsFromPage` 中新增 `dailynoteEnabled` 字段的持久化支持

- [x] Task 2: 实现 DailyNote 查询函数
  - [x] 2.1: 在 `src/queries/utils.ts` 中新增 `getDailyNoteBlockUids()` 函数，使用 Datalog 查询获取所有 DailyNote 页面的非空一级 block UID
  - [x] 2.2: 查询逻辑：`[:find ?blockUid :where [?page :page/create-email] [?page :block/children ?block] [?block :block/uid ?blockUid] [?block :block/string ?str] [(not= ?str "")]]`
  - [x] 2.3: 返回类型为 `Promise<string[]>`

- [x] Task 3: 集成 DailyNote 牌堆到数据获取流程
  - [x] 3.1: 修改 `src/hooks/useTags.tsx`，接收 `dailynoteEnabled` 参数，当为 `true` 时将 `DAILYNOTE_DECK_KEY` 追加到 `tagsList` 末尾
  - [x] 3.2: 修改 `src/queries/data.ts` 的 `getSessionData`，当 `tag === DAILYNOTE_DECK_KEY` 时调用 `getDailyNoteBlockUids()` 替代 `getPageReferenceIds` + `getSelectedTagPageBlocksIds`
  - [x] 3.3: 修改 `src/app.tsx`，将 `dailynoteEnabled` 传递给 `useTags`

## Phase 2: DailyNote 牌堆 — UI 层（依赖 Phase 1）

- [x] Task 4: DailyNote 牌堆 UI 展示
  - [x] 4.1: 修改 `src/components/overlay/Header.tsx` 的 `TagSelector`，当 tag 为 `DAILYNOTE_DECK_KEY` 时显示日历图标（`icon="calendar"`）作为标识
  - [x] 4.2: 在 SettingsForm 中新增 "Enable DailyNote Deck" 复选框设置项，默认启用

## Phase 3: Memo 设置保存机制修改（与 Phase 1/2 无依赖，可并行）

- [x] Task 5: 重构 SettingsForm 为纯表单状态管理
  - [x] 5.1: 移除 SettingsForm 的 `updateSetting` prop
  - [x] 5.2: 移除所有 onChange 中的 `updateSetting` 调用，仅保留 `setFormSettings`
  - [x] 5.3: 使用 `React.forwardRef` + `React.useImperativeHandle` 暴露 `getSettings()` 方法，返回当前 `formSettings`
  - [x] 5.4: 更新 `SettingsFormSettings` 接口，新增 `dailynoteEnabled: boolean` 字段

- [x] Task 6: 重构 SettingsDialog 添加 Apply/Close 按钮
  - [x] 6.1: 新增 `onApplyAndClose` prop（类型：`(settings: SettingsFormSettings) => void`）
  - [x] 6.2: 使用 `useRef` 获取 SettingsForm 的 `getSettings()` 方法
  - [x] 6.3: 在对话框底部添加 "Apply & Close" 按钮（Blueprint.Button intent="primary"），点击后调用 `onApplyAndClose(formRef.current.getSettings())`
  - [x] 6.4: 在对话框底部添加 "Close" 按钮（Blueprint.Button），点击后调用 `onClose`（丢弃更改）
  - [x] 6.5: 移除 Blueprint.Dialog 默认的关闭按钮行为或确保 Close 按钮与 onClose 一致

- [x] Task 7: 连接 PracticeOverlay 的 Apply/Close 逻辑
  - [x] 7.1: 在 PracticeOverlay 中新增 `handleApplyAndClose` 回调：遍历 formSettings 调用 `updateSetting` 保存每个字段 → 关闭设置对话框 → 调用 `onCloseCallback` 关闭 PracticeOverlay
  - [x] 7.2: 将 `handleApplyAndClose` 传递给 SettingsDialog 的 `onApplyAndClose` prop
  - [x] 7.3: 确保 SettingsDialog 的 "Close" 按钮仅关闭设置对话框，不影响 PracticeOverlay

- [x] Task 8: 更新 settingsPanelConfig 适配新 SettingsForm
  - [x] 8.1: 更新 settingsPanelConfig 中 SettingsForm 的使用方式，移除 `updateSetting` prop
  - [x] 8.2: 为 settingsPanelConfig 添加独立的保存逻辑（可使用 ref 获取 formSettings 后批量保存，或保持其独立的 debounced 机制）

## Phase 4: 文档更新与验证（依赖 Phase 1-3）

- [x] Task 9: 更新文档
  - [x] 9.1: 更新 `README.md`：在 Features 章节新增 "DailyNote Deck" 描述；更新 "Settings Architecture" 章节反映显式保存机制；更新 "Multi Deck Support" 描述
  - [x] 9.2: 确认 `THEME_SYSTEM.md` 无需变更（本次不涉及样式变量修改）

- [x] Task 10: 全量验证
  - [x] 10.1: 运行 `npx jest --no-coverage` 确保所有测试通过
  - [x] 10.2: 运行 `npm run typecheck` 确保类型检查通过
  - [x] 10.3: 验证 DailyNote 牌堆功能：启用/禁用切换、牌堆选择器显示、卡片获取和排序
  - [x] 10.4: 验证设置保存机制：修改设置 → Close 丢弃 → 重新打开确认原始值；修改设置 → Apply & Close → 重新打开确认新值生效
  - [x] 10.5: 验证边界情况：无 DailyNote 页面时的行为；DailyNote 牌堆与常规牌堆卡片重叠；settingsPanelConfig 功能正常

# Task Dependencies

- Task 2 (DailyNote 查询) — 无依赖，可独立进行
- Task 1 (常量和设置) — 无依赖，可独立进行
- Task 3 (数据获取集成) — 依赖 Task 1 和 Task 2
- Task 4 (UI 展示) — 依赖 Task 3
- Task 5 (SettingsForm 重构) — 无依赖，可与 Phase 1/2 并行
- Task 6 (SettingsDialog 按钮) — 依赖 Task 5
- Task 7 (PracticeOverlay 连接) — 依赖 Task 6
- Task 8 (settingsPanelConfig 适配) — 依赖 Task 5
- Task 9 (文档更新) — 依赖 Task 4 和 Task 7
- Task 10 (全量验证) — 依赖 Task 9
