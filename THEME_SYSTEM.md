# Roam Memo Theme System

## Design Principle

**Simplicity** — All colors inherit from Roam body automatically via CSS. Only functional colors (intent, cloze masks, mode indicators) are explicitly defined in `theme.ts`.

## How It Works

### 1. Automatic Inheritance (Core Mechanism)

Roam Research sets background and text colors on `<body>`. Our components inherit these via CSS `inherit`:

```tsx
const Dialog = styled(Blueprint.Dialog)`
  /* Background and text color inherit from Roam body automatically */
  /* Supports light/dark/auto all theme modes */
`;
```

### 2. Functional Colors (theme.ts)

Only colors that require explicit definition are declared in `theme.ts`:

```typescript
export const colors = {
  // Transparent overlays for buttons
  overlayLight: 'rgba(128, 128, 128, 0.08)',
  overlayLightHover: 'rgba(128, 128, 128, 0.12)',

  // Cloze mask (fixed value — does not change with theme)
  clozeHidden: '#e1e3e5',

  // Border colors
  borderSubtle: 'rgba(128, 128, 128, 0.15)',

  // Card mode indicator colors (aligned with intent colors for visual consistency)
  modeSpaced: 'var(--roam-success-color, #56d364)', // Spaced = green = same as "New" tag
  modeFixed: 'var(--roam-warning-color, #d29922)', // Fixed = orange = same as "Past Due" tag

  // Line-by-line review accents
  lineByLineCurrentBorder: 'var(--roam-success-color, #56d364)',
  lineByLineMasteredBorder: 'rgba(128, 128, 128, 0.15)',
};

// Intent color mapping (uses Roam CSS variables)
export const intentColors = {
  primary: 'var(--roam-primary-color, #8cb4ff)',
  success: 'var(--roam-success-color, #56d364)',
  warning: 'var(--roam-warning-color, #d29922)',
  danger: 'var(--roam-danger-color, #f85149)',
};
```

### 3. Theme Adaptation Flow

```
Roam Body (rs-light/rs-dark/rs-auto)
    ↓ CSS inherit
Dialog container
    ↓ CSS inherit
Header / Footer / CardBlock
    ↓ uses intent colors
Buttons (primary/success/warning/danger)
    ↓ uses mode colors
ModeBadge (success=Spaced / warning=Fixed)
Dialog border (modeSpaced / modeFixed)
```

## File Structure

```
src/
├── theme.ts              # Single source of color definitions
├── app.tsx               # Main app (no theme-related logic)
└── components/overlay/
    ├── PracticeOverlay.tsx  # Dialog inherits background + dynamic border color (based on algorithm group)
    ├── Footer.tsx           # Buttons use intent colors
    └── CardBlock.tsx        # Cloze mask uses fixed color
```

## Key Design Decisions

| Before (over-engineered) | After (simplified) |
|---|---|
| JS dynamically reads body colors and injects CSS | Pure CSS `inherit` |
| MutationObserver watches theme changes | Zero JS theme logic |
| Manual handling of rs-light/rs-dark/rs-auto | Automatic via CSS |
| Multiple `!important` overrides | `!important` only when necessary (mobile fullscreen, Blueprint overrides) |
| Multiple color definition files | Single source: `theme.ts` |

## FAQ

### Q: Why not use CSS variables?

A: We already do! `intentColors` uses `var(--roam-primary-color)` and other Roam native variables.

### Q: Why is the cloze mask hardcoded to #e1e3e5?

A: This is a fixed light gray per design spec — it doesn't change with theme to ensure readability.

### Q: Why use !important on mobile?

A: Required to override Blueprint.js defaults for fullscreen behavior.

### Q: Why are there only two mode colors (Spaced/Fixed)?

A: The READ interaction style has been removed from the system (its functionality is now covered by LBL + Progressive/Fixed). LBL + Fixed cards use `modeFixed` (orange) instead of a separate color. This keeps the visual system simple: green = SM2, orange = everything else.

## Maintenance Guide

### Adding a New Color

Add to `theme.ts`:

```typescript
export const colors = {
  // ...existing colors
  myNewColor: 'var(--roam-some-variable, #fallback)',
};
```

### Changing Button Colors

Use the intent system:

```tsx
<ControlButton intent="primary">Primary Button</ControlButton>
<ControlButton intent="success">Success Button</ControlButton>
```

### Debugging Theme Issues

1. Check if Roam body has correct class names (rs-light/rs-dark)
2. Confirm component doesn't explicitly set `background-color`
3. Use browser DevTools to inspect computed styles

## Technical Details

### Blueprint.js Compatibility

- Dialog background: auto-adapts via CSS inherit
- Button intent: maps to Roam colors via `getIntentColor()`
- Popover/Tooltip: inherits parent container styles

### Mobile Special Handling

- Backdrop transparency (allows click-through)
- Fullscreen positioning (overrides Blueprint defaults)
- safe-area-inset for bottom toolbar adaptation
