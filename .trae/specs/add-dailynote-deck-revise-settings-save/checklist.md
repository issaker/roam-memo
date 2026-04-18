# Checklist

## DailyNote 牌堆

- [x] `DAILYNOTE_DECK_KEY` 常量定义在 `src/constants.ts` 中
- [x] `dailynoteEnabled: boolean` 设置项已添加到 `Settings` 类型、`defaultSettings`、`SETTING_TYPES`
- [x] `dailynoteEnabled` 在 `saveSettingsToPage` 和 `loadSettingsFromPage` 中正确持久化
- [x] `getDailyNoteBlockUids()` 查询函数正确获取所有 DailyNote 页面的非空一级 block UID
- [x] `useTags` 在 `dailynoteEnabled` 为 `true` 时将 `DAILYNOTE_DECK_KEY` 追加到 `tagsList` 末尾
- [x] `getSessionData` 对 `DAILYNOTE_DECK_KEY` 使用专用查询逻辑（`getDailyNoteBlockUids`）
- [x] `app.tsx` 正确传递 `dailynoteEnabled` 给 `useTags`
- [x] TagSelector 中 `DAILYNOTE_DECK_KEY` 牌堆显示日历图标标识
- [x] SettingsForm 中新增 "Enable DailyNote Deck" 复选框，默认启用
- [x] DailyNote 牌堆中的 due 卡按三级优先级排序（nextDueDate → eFactor → repetitions）
- [x] DailyNote 牌堆中的 new 卡按现有逻辑排序
- [x] 禁用 DailyNote 牌堆后，牌堆选择器中不显示 "DailyNote"
- [x] DailyNote 牌堆与常规牌堆的卡片重叠时，session 数据共享正确

## Memo 设置保存机制

- [x] SettingsForm 不再在 onChange 中调用 `updateSetting`
- [x] SettingsForm 通过 `React.useImperativeHandle` 暴露 `getSettings()` 方法
- [x] SettingsDialog 底部有 "Apply & Close" 和 "Close" 两个按钮
- [x] 点击 "Apply & Close" 后：所有设置被保存、设置对话框关闭、PracticeOverlay 关闭
- [x] 点击 "Close" 后：设置对话框关闭、更改被丢弃、PracticeOverlay 不受影响
- [x] 修改设置后点击 "Close"，再次打开设置对话框时显示原始值（非修改值）
- [x] 修改设置后点击 "Apply & Close"，重新打开插件后新设置生效
- [x] settingsPanelConfig 正确适配新的 SettingsForm 接口
- [x] 卸载时的 flush 机制仍然正常工作

## 文档与测试

- [x] README.md 已更新：新增 DailyNote Deck 功能描述、更新 Settings Architecture、更新 Multi Deck Support
- [x] THEME_SYSTEM.md 已确认无需变更
- [x] `npx jest --no-coverage` 全部通过
- [x] `npm run typecheck` 无错误
