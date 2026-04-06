import ReactDOM from 'react-dom';
import App from './app';
import { FocusStyleManager } from '@blueprintjs/core';
import { injectZIndexFixStyles, removeZIndexFixStyles } from './utils/zIndexFix';

const container_id: string = 'roam-memo-wrapper';

const createAndRenderContainer = () => {
  const siblingElm = document.querySelector('.rm-left-sidebar__daily-notes');
  if (!siblingElm || !siblingElm.parentNode) {
    console.warn('Memo: Could not find sidebar element');
    return null;
  }
  
  const newContainerElm = document.createElement('div');
  newContainerElm.id = container_id;
  newContainerElm.classList.add('log-button');
  siblingElm.parentNode.insertBefore(newContainerElm, siblingElm.nextSibling);

  return newContainerElm;
};
function onload({ extensionAPI }: { extensionAPI: any }) {
  try {
    console.log('Memo: Initializing...');
    
    // Create a compatible extensionAPI for roam/js loading
    // When loaded via roam/js, extensionAPI might be window.roamAlphaAPI which doesn't have settings.panel
    const compatibleExtensionAPI = extensionAPI || {};
    
    // In-memory settings storage for roam/js mode
    const inMemorySettings: Record<string, any> = {};
    
    // Always ensure we have proper settings methods with in-memory storage
    // This is critical for roam/js mode where settings need to persist across components
    if (!compatibleExtensionAPI.settings) {
      compatibleExtensionAPI.settings = {};
    }
    
    // Override settings methods to use in-memory storage (always override to ensure proper behavior)
    // Remove verbose logging to prevent console spam
    const _originalGetAll = compatibleExtensionAPI.settings.getAll;
    const _originalSet = compatibleExtensionAPI.settings.set;
    const _originalGet = compatibleExtensionAPI.settings.get;
    
    compatibleExtensionAPI.settings.getAll = () => {
      // Merge in-memory settings with any existing settings
      const existingSettings = _originalGetAll ? _originalGetAll() : {};
      return { ...existingSettings, ...inMemorySettings };
    };
    
    compatibleExtensionAPI.settings.set = (key: string, value: any) => {
      inMemorySettings[key] = value;
      // Also call original set if it exists (for Roam Depot compatibility)
      if (_originalSet) _originalSet(key, value);
      // Dispatch custom event to notify settings change
      window.dispatchEvent(new CustomEvent('roamMemoSettingsChanged', { detail: { key, value } }));
    };
    
    compatibleExtensionAPI.settings.get = (key: string) => {
      // Check in-memory first, then fall back to original
      if (key in inMemorySettings) return inMemorySettings[key];
      return _originalGet ? _originalGet(key) : undefined;
    };
    
    // Ensure settings.panel exists
    if (!compatibleExtensionAPI.settings.panel) {
      compatibleExtensionAPI.settings.panel = {
        create: () => {
          // Silently handle settings panel creation in roam/js mode
        },
      };
    }
    
    window.roamMemo = {
      extensionAPI: compatibleExtensionAPI,
    };

    FocusStyleManager.onlyShowFocusOnTabs();

    // 注入 z-index 修复样式
    injectZIndexFixStyles();
    console.log('Memo: Z-index fix styles injected');

    const container = createAndRenderContainer();
    if (container) {
      ReactDOM.render(<App />, container);
      console.log('Memo: Initialized successfully');
    } else {
      console.error('Memo: Failed to create container - sidebar element not found');
    }
  } catch (error) {
    console.error('Memo: Initialization failed', error);
  }
}

function onunload() {
  const container = document.getElementById(container_id);

  if (container) {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
  }

  // 移除 z-index 修复样式
  removeZIndexFixStyles();
  console.log('Memo: Z-index fix styles removed');
}

const plugin = {
  onload: onload,
  onunload: onunload,
};

export default plugin;

if (typeof window !== 'undefined') {
  (window as any).RoamMemo = plugin;
}
