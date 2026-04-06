import ReactDOM from 'react-dom';
import App from './app';
import { FocusStyleManager } from '@blueprintjs/core';

console.log('Memo: Initializing...');

const container_id: string = 'roam-memo-wrapper';

const createAndRenderContainer = () => {
  // @TODO: This is where I want it personally, but maybe make this a configurable setting?
  const siblingElm = document.querySelector('.rm-left-sidebar__daily-notes');
  
  // 如果找不到目标元素，尝试其他位置（支持 roam/js 加载）
  if (!siblingElm || !siblingElm.parentNode) {
    console.warn('Memo: Sidebar not found, trying alternative location...');
    const alternativeContainer = document.querySelector('.roam-body-main') || document.body;
    const newContainerElm = document.createElement('div');
    newContainerElm.id = container_id;
    newContainerElm.classList.add('log-button');
    alternativeContainer.appendChild(newContainerElm);
    return newContainerElm;
  }
  
  const newContainerElm = document.createElement('div');
  newContainerElm.id = container_id;
  newContainerElm.classList.add('log-button'); // match style
  siblingElm.parentNode.insertBefore(newContainerElm, siblingElm.nextSibling);

  return newContainerElm;
};

// 创建降级的 extensionAPI（当通过 {{[[roam/js]]}} 加载时使用）
function createFallbackAPI() {
  console.log('Memo: Using fallback API (no extensionAPI available)');
  
  return {
    settings: {
      panel: {
        create: () => {},
      },
    },
    commands: {
      create: () => {},
    },
    ui: {
      components: {
        create: () => null,
      },
    },
    // 添加其他需要的 API 方法
  };
}

function onload({ extensionAPI }) {
  // This just makes life easier (instead of having to pipe it down everywhere I
  // want to dynamically fetch the latest config)
  window.roamMemo = {
    extensionAPI: extensionAPI || createFallbackAPI(),  // 提供降级 API
  };

  FocusStyleManager.onlyShowFocusOnTabs();

  const container = createAndRenderContainer();
  ReactDOM.render(<App />, container);

  console.log('Memo: Initialized');
}

function onunload() {
  const container = document.getElementById(container_id);

  if (container) {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
  }

  console.log('Memo: Unloaded');
}

export default {
  onload: onload,
  onunload: onunload,
};

// 支持直接通过 {{[[roam/js]]}} 加载（自动初始化）
if (typeof window !== 'undefined' && !window.roamMemo) {
  console.log('Memo: Detected direct script load, initializing without extensionAPI');
  
  // 延迟执行，等待 DOM 完全加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      onload({ extensionAPI: null });
    });
  } else {
    setTimeout(() => {
      onload({ extensionAPI: null });
    }, 1000);
  }
}
