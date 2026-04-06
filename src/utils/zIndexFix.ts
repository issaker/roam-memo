/**
 * 样式注入模块 - 用于修复 Roam Research 图片悬浮窗口的层级问题
 */

const STYLE_ID = 'roam-memo-z-index-fix';

// 定义需要注入的 CSS 样式
const zIndexFixCSS = `
/* Roam Research 图片悬浮窗口的层级提升 (已成功部分)*/
/* 加固：有些情况下 z-index 需要打到 dialog/portal 上才会影响堆叠 */
.bp3-portal:has(.bp3-overlay.bp3-overlay-open):has(.bp3-multistep-dialog-log-footer),
.bp3-portal:has(.bp3-overlay.bp3-overlay-open):has(.bp3-multistep-dialog-footer) {
  z-index: 1 ;
}

/* 2. 提升 Roam 图片浮层的 Z-index */
/* 使用 ID 选择器保证特异性 */
#rm-modal-portal {
  z-index: 2 ; /* Roam 图片浮层整体的 z-index，最高 */
}
`;

/**
 * 注入 CSS 样式到页面中
 */
export const injectZIndexFixStyles = (): void => {
  // 检查是否已经存在样式元素
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  // 创建新的 style 元素
  const styleElement = document.createElement('style');
  styleElement.id = STYLE_ID;
  styleElement.textContent = zIndexFixCSS;

  // 将样式添加到文档头部
  document.head.appendChild(styleElement);
};

/**
 * 移除注入的 CSS 样式
 */
export const removeZIndexFixStyles = (): void => {
  const styleElement = document.getElementById(STYLE_ID);
  if (styleElement) {
    styleElement.remove();
  }
};