/**
 * Roam Memo Theme System
 * 
 * Design Principle:
 * - All colors inherit from Roam body (background + text)
 * - Functional colors (intent, borders, cloze masks) are defined separately
 * - This ensures unified theme adaptation for any Roam theme (light/dark/auto/custom)
 * 
 * Roam sets colors on body element, we use CSS inherit to get them.
 */

// Intent color mapping - uses CSS custom properties that adapt to theme
export const intentColors = {
  primary: 'var(--roam-primary-color, #8cb4ff)',
  success: 'var(--roam-success-color, #56d364)',
  warning: 'var(--roam-warning-color, #d29922)',
  danger: 'var(--roam-danger-color, #f85149)',
  none: 'inherit',
  default: 'inherit',
};

// Helper function to get color by intent
export const getIntentColor = (intent?: string): string => {
  if (!intent) return 'inherit';
  return intentColors[intent as keyof typeof intentColors] || 'inherit';
};

// Common color utilities
export const colors = {
  // Transparent backgrounds with opacity for overlays (buttons, etc.)
  overlayLight: 'rgba(255, 255, 255, 0.05)',
  overlayLightHover: 'rgba(255, 255, 255, 0.1)',
  
  // Cloze card background (light gray for hidden state)
  clozeHidden: '#e1e3e5',
  clozeVisible: 'transparent',
  
  // Border colors
  borderSubtle: 'rgba(128, 128, 128, 0.15)',
  
  // Text colors
  textMuted: 'var(--roam-text-muted-color, #888)',
  
  // Text opacity variants
  textSecondary: '0.6',
  textTertiary: '0.5',
};

// Background color inheritance - simple hardcoded fallback based on Roam theme class
// Apply to overlay container to prevent transparent layers from showing body background
export const backgroundStyles = {
  // CSS for overlay container - prevents transparent layers from showing through
  overlayBackgroundCSS: `
    /* Light theme: white background */
    .bp3-portal {
      background-color: #ffffff;
    }
    
    /* Dark theme: Roam uses html.rs-dark class */
    html.rs-dark .bp3-portal {
      background-color: #182026;
    }
    
    /* Auto theme: inherit from body */
    html.rs-auto .bp3-portal {
      background-color: inherit;
    }
  `,
  
  // CSS for Dialog component itself (transparent is fine since parent handles background)
  dialogBackgroundCSS: `
    background-color: transparent;
    color: inherit;
  `,
};
