/**
 * Roam Memo Theme System
 * 
 * This theme system inherits colors from the host application (Roam Research)
 * to ensure visual consistency across light and dark modes.
 * 
 * Roam switches themes via html class (rs-light/rs-dark), with colors set on body.
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
  // Inherit from body - automatically adapts to theme changes
  // Using 'inherit' ensures real-time updates when Roam switches themes
  backgroundInherit: 'inherit',
  colorInherit: 'inherit',
  
  // Transparent backgrounds with opacity for overlays
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

// Get background color from document body (fallback to dark theme default)
export const getBodyBackgroundColor = (): string => {
  if (typeof window !== 'undefined' && document.body) {
    return getComputedStyle(document.body).backgroundColor || '#1a1a1a';
  }
  return '#1a1a1a';
};
