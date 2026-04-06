# Roam Memo - 通过 roam/js 加载指南

## 概述

Roam Memo 现在支持通过 `[[roam/js]]` 页面以 JavaScript 脚本注入的方式加载，无需使用 Roam Depot。

## 使用方法

### 方式 1：从远程 URL 加载（推荐）

1. 在 Roam Research 中导航到 `[[roam/js]]` 页面
2. 创建一个新的代码块
3. 选择语言为 `javascript`
4. 粘贴以下代码：

```javascript
if (!window.roamMemoLoaded) {
  window.roamMemoLoaded = true;
  
  const script = document.createElement('script');
  // 使用 jsDelivr CDN（推荐，正确处理 Content-Type）
  script.src = 'https://cdn.jsdelivr.net/gh/issaker/roam-memo@main/extension.js';
  // 或者使用 GitHub raw URL（可能被浏览器阻止）
  // script.src = 'https://raw.githubusercontent.com/issaker/roam-memo/main/extension.js';
  script.type = 'text/javascript';
  script.crossOrigin = 'anonymous';
  
  script.onload = function() {
    console.log('✅ Roam Memo loaded successfully');
    if (window.RoamMemo && window.RoamMemo.onload) {
      window.RoamMemo.onload({ extensionAPI: window.roamAlphaAPI });
    }
  };
  
  script.onerror = function(e) {
    console.error('❌ Failed to load Roam Memo', e);
    console.error('Please check your network connection or try using the offline method');
    window.roamMemoLoaded = false;
  };
  
  document.head.appendChild(script);
}
```

5. 点击代码块右侧的三个点菜单
6. 选择 **"Yes, I Know What I'm Doing"**
7. 刷新页面

### 方式 2：离线使用（嵌入完整代码）

如果您希望完全离线使用：

1. 打开项目根目录下的 `extension.js` 文件
2. 复制全部内容
3. 在 `[[roam/js]]` 页面创建 JavaScript 代码块
4. 粘贴整个文件内容
5. 在代码末尾添加：

```javascript
if (window.RoamMemo && window.RoamMemo.onload) {
  setTimeout(() => {
    window.RoamMemo.onload({ extensionAPI: window.roamAlphaAPI });
  }, 100);
}
```

6. 点击 "Yes, I Know What I'm Doing"
7. 刷新页面

## 技术说明

### UMD 格式

编译后的 `extension.js` 使用 UMD（Universal Module Definition）格式，可以：
- ✅ 在浏览器中直接通过 `<script>` 标签加载
- ✅ 作为 CommonJS 模块使用
- ✅ 作为 AMD 模块使用
- ✅ 导出全局变量 `window.RoamMemo`

### 全局变量

加载后，插件会暴露以下全局变量：

- `window.RoamMemo` - 插件对象，包含 `onload` 和 `onunload` 方法
- `window.roamMemo` - 插件运行时配置，包含 `extensionAPI`

### 自动初始化

当通过 `<script>` 标签加载时，脚本会自动：
1. 将插件对象赋值给 `window.RoamMemo`
2. 在 `onload` 事件中调用初始化函数
3. 在侧边栏创建插件 UI

## 更新插件

### 远程加载方式
只需重新加载 Roam Research 页面即可获取最新版本。

### 离线方式
1. 运行 `npm run build` 重新构建
2. 复制新的 `extension.js` 内容
3. 替换 `[[roam/js]]` 中的代码

## 故障排除

### 插件未加载

检查浏览器控制台（F12）：
- ✅ 看到 "Memo: Initializing..." - 脚本已加载
- ✅ 看到 "Memo: Initialized" - 插件初始化成功
- ❌ 看到错误信息 - 检查网络连接或代码是否正确

### 重复加载

如果看到多次 "Memo: Initializing..."，说明脚本被多次加载。确保：
- 只在一个代码块中添加加载代码
- `window.roamMemoLoaded` 标志正常工作

### 侧边栏没有显示

检查：
- 左侧边栏是否可见
- 是否有 `.rm-left-sidebar__daily-notes` 元素
- 控制台是否有 "Could not find sidebar element" 警告

## 与 Roam Depot 的区别

| 特性 | roam/js 脚本注入 | Roam Depot |
|------|-----------------|------------|
| 设置复杂度 | 简单 | 需要配置开发者扩展 |
| 更新方式 | 自动（远程）/手动（离线） | 自动 |
| 管理界面 | 无 | 有 UI 管理 |
| 适用场景 | 快速测试、离线使用 | 长期使用 |

## 开发调试

如果您想调试插件：

1. 运行开发模式：
   ```bash
   npm run dev
   ```

2. 这会生成带 source map 的 `extension.js`

3. 在浏览器开发者工具中可以查看原始 TypeScript 代码

## 注意事项

⚠️ **重要提示**：
- 不要同时使用 Roam Depot 和 roam/js 加载，会导致插件运行两次
- 如果使用 roam/js 方式，请从 Roam Depot 中移除该插件
- 确保 GitHub 仓库的 `main` 分支上有最新的 `extension.js`

### ⚠️ roam/js 模式的限制

由于 roam/js 模式使用的是 `window.roamAlphaAPI` 而不是完整的 Roam Depot `extensionAPI`，以下功能**受限**：

- ⚠️ **设置不持久化** - 设置更改不会保存到 Roam，刷新页面后会重置为默认值
- ✅ **设置对话框可用** - 点击插件弹窗右上角的齿轮图标可以打开设置面板

**解决方案**：
- 每次使用时通过设置对话框配置（刷新后需要重新设置）
- 如需持久化设置，请使用 Roam Depot 安装
- 或者手动修改代码中的 `defaultSettings`
