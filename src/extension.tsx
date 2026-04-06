import ReactDOM from 'react-dom';
import App from './app';
import { FocusStyleManager } from '@blueprintjs/core';

console.log('Memo: Initializing...');

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
  // Create a compatible extensionAPI for roam/js loading
  // When loaded via roam/js, extensionAPI might be window.roamAlphaAPI which doesn't have settings.panel
  const compatibleExtensionAPI = extensionAPI || {};
  
  // If settings.panel doesn't exist, create a stub to prevent errors
  if (!compatibleExtensionAPI.settings) {
    compatibleExtensionAPI.settings = {
      panel: {
        create: () => {
          console.warn('Memo: Settings panel not available in roam/js mode. Use Roam Depot for full settings support.');
        },
      },
      getAll: () => ({}),
      set: () => {
        console.warn('Memo: Settings save not available in roam/js mode.');
      },
      get: () => undefined,
    };
  } else if (!compatibleExtensionAPI.settings.panel) {
    compatibleExtensionAPI.settings.panel = {
      create: () => {
        console.warn('Memo: Settings panel not available. Using default settings.');
      },
    };
  }
  
  window.roamMemo = {
    extensionAPI: compatibleExtensionAPI,
  };

  FocusStyleManager.onlyShowFocusOnTabs();

  const container = createAndRenderContainer();
  if (container) {
    ReactDOM.render(<App />, container);
    console.log('Memo: Initialized');
  } else {
    console.error('Memo: Failed to create container');
  }
}

function onunload() {
  const container = document.getElementById(container_id);

  if (container) {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
    console.log('Memo: Unloaded');
  }
}

const plugin = {
  onload: onload,
  onunload: onunload,
};

export default plugin;

if (typeof window !== 'undefined') {
  (window as any).RoamMemo = plugin;
}
