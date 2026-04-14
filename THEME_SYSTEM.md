# Roam Memo 主题系统说明

## 设计原则

**简单直接** - 所有颜色自动从 Roam body 继承，无需复杂的 JS 注入逻辑。

## 工作原理

### 1. 自动继承（核心机制）

Roam Research 在 `<body>` 元素上设置背景色和文字颜色，我们的组件通过 CSS `inherit` 自动继承这些颜色：

```tsx
const Dialog = styled(Blueprint.Dialog)`
  /* 背景和文字颜色自动从 Roam body 继承 */
  /* 支持 light/dark/auto 所有主题模式 */
`;
```

### 2. 功能性颜色（theme.ts）

只有需要明确定义的颜色才在 `theme.ts` 中声明：

```typescript
export const colors = {
  // 按钮半透明遮罩
  overlayLight: 'rgba(128, 128, 128, 0.08)',
  overlayLightHover: 'rgba(128, 128, 128, 0.12)',
  
  // 填空题遮罩（固定值）
  clozeHidden: '#e1e3e5',
  
  // 边框颜色
  borderSubtle: 'rgba(128, 128, 128, 0.15)',

  // 卡片模式指示颜色（与 intent 颜色对齐，用于 ModeBadge 和 Dialog 边框）
  modeSpaced: 'var(--roam-success-color, #56d364)',  // Spaced 模式 = 绿色 = 与 "New" 标签一致
  modeFixed: 'var(--roam-warning-color, #d29922)',    // Fixed 模式 = 橙色 = 与 "Past Due" 标签一致

  // 逐行复习边框颜色
  lineByLineCurrentBorder: 'var(--roam-success-color, #56d364)',
  lineByLineMasteredBorder: 'rgba(128, 128, 128, 0.15)',
};

// Intent 颜色映射（使用 Roam CSS 变量）
export const intentColors = {
  primary: 'var(--roam-primary-color, #8cb4ff)',
  success: 'var(--roam-success-color, #56d364)',
  warning: 'var(--roam-warning-color, #d29922)',
  danger: 'var(--roam-danger-color, #f85149)',
};
```

### 3. 主题适配流程

```
Roam Body (rs-light/rs-dark/rs-auto)
    ↓ CSS inherit
Dialog 容器
    ↓ CSS inherit
Header / Footer / CardBlock
    ↓ 使用 intent 颜色
Buttons (primary/success/warning/danger)
    ↓ 使用模式颜色
ModeBadge (success=Spaced / warning=Fixed)
Dialog 边框 (modeSpaced / modeFixed)
```

## 文件结构

```
src/
├── theme.ts              # 唯一的颜色定义文件（含 modeSpaced/modeFixed 与逐行复习边框变量）
├── app.tsx               # 主应用（无主题相关逻辑）
└── components/overlay/
    ├── PracticeOverlay.tsx  # Dialog 继承背景色 + 动态边框颜色（基于 reviewMode）
    ├── Footer.tsx           # 按钮使用 intent 颜色
    └── CardBlock.tsx        # 填空题遮罩使用固定色
```

## 关键改动

### ✅ 简化前
- JS 动态读取 body 颜色并注入 CSS
- MutationObserver 监听主题变化
- 手动处理 rs-light/rs-dark/rs-auto
- 多处使用 `!important` 覆盖样式

### ✅ 简化后
- 纯 CSS `inherit` 自动继承
- 零 JS 主题逻辑
- 只在必要时使用 `!important`（移动端全屏、Blueprint 覆盖）
- 单一数据源：`theme.ts`

## 2026-04-14 更新摘要

- 逐行复习的当前行高亮和已掌握行边框改为统一复用 `theme.ts` 中的样式变量
- 新增 `lineByLineCurrentBorder` 与 `lineByLineMasteredBorder` 两个样式变量，分别用于当前行和已掌握行的左侧边框
- 这次修复没有引入新的主题机制，仍然遵守“能继承就继承，只把功能色放进主题文件”的原则
- 新增 `Show Review Mode Borders` 设置项，允许关闭模式边框显示；关闭后仍回退到统一的 subtle border，不改变主题继承模型
- 逐行复习只在 `Spaced Interval Mode` 下激活，因此 `Fixed Interval Mode` 仍保持整卡展开的阅读体验，不新增额外主题分支

## 常见问题

### Q: 为什么不用 CSS 变量？
A: 已经在使用了！`intentColors` 使用 `var(--roam-primary-color)` 等 Roam 原生变量。

### Q: 填空题遮罩为什么硬编码 #e1e3e5？
A: 这是设计规范要求的固定浅灰色，不随主题变化，确保可读性。

### Q: 移动端为什么要用 !important？
A: 必须覆盖 Blueprint.js 的默认样式以实现全屏效果，这是必要的。

## 维护指南

### 添加新颜色
在 `theme.ts` 中添加：
```typescript
export const colors = {
  // ...existing colors
  myNewColor: 'var(--roam-some-variable, #fallback)',
};
```

### 修改按钮颜色
使用 intent 系统：
```tsx
<ControlButton intent="primary">Primary Button</ControlButton>
<ControlButton intent="success">Success Button</ControlButton>
```

### 调试主题问题
1. 检查 Roam body 是否有正确的类名（rs-light/rs-dark）
2. 确认组件没有显式设置 `background-color`
3. 浏览器 DevTools 检查 computed styles

## 技术细节

### Blueprint.js 兼容性
- Dialog 背景：通过 CSS inherit 自动适配
- Button intent：使用 `getIntentColor()` 映射到 Roam 颜色
- Popover/Tooltip：继承父容器样式

### 移动端特殊处理
- 背景层透明化（允许点击穿透）
- 全屏定位（覆盖 Blueprint 默认行为）
- safe-area-inset 适配底部工具栏

---

**最后更新**: 2026-04-14
**简化目标**: 移除过度工程化，保持简单直接
