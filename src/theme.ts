/**
 * Roam Memo Theme System
 * 
 * Design Principle:
 * - All colors inherit from Roam body automatically via CSS
 * - Only functional colors (intent, cloze masks) are explicitly defined
 * - Simple and straightforward - no complex JS injection needed
 */

// Intent color mapping - uses Roam's CSS variables
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
  overlayLight: 'rgba(128, 128, 128, 0.08)',
  overlayLightHover: 'rgba(128, 128, 128, 0.12)',
  
  // Cloze card background (light gray for hidden state)
  clozeHidden: '#e1e3e5',
  clozeVisible: 'transparent',
  
  // Border colors
  borderSubtle: 'rgba(128, 128, 128, 0.15)',
  
  // Text colors
  textMuted: 'var(--roam-text-muted-color, #888)',

  // Card mode indicator colors (aligned with intent colors for visual consistency)
  modeSpaced: 'var(--roam-success-color, #56d364)',
  modeFixed: 'var(--roam-warning-color, #d29922)',

  // Line-by-line review accents
  lineByLineCurrentBorder: 'var(--roam-success-color, #56d364)',
  lineByLineMasteredBorder: 'rgba(128, 128, 128, 0.15)',
};
