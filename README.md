# Memo - Spaced Repetition for Roam

A spaced repetition plugin for [Roam Research](https://roamresearch.com), using a modified SuperMemo 2 (SM2) algorithm.

![Demo Preview](https://user-images.githubusercontent.com/1279335/189250105-656e6ba3-7703-46e6-bc71-ee8c5f3e39ab.gif)

## What is Spaced Repetition

Spaced repetition reviews information based on how well you remember it, focusing more on difficult cards and less on easy ones. This is one of the most effective methods for long-term memorization.

## Installation

Install "Memo" via Roam Depot.

## Getting Started

1. Tag any block you wish to memorize with `#memo` (or your configured tag).
2. Click "Review" in the sidebar to launch.
3. Start reviewing.

> **Tip:** Child blocks are treated as answers and are initially hidden. Click "Show Answer" to reveal them.

## Features

### Multi Deck Support

Enter a comma-separated list of tags in "Tag Pages" in settings to create multiple decks.

### Text Masking (Cloze)

Hide text for recall practice:
- Use braces `{}`, e.g., `{hide me}`
- Note: Roam's native `^^highlight^^` syntax is now preserved as-is and not treated as cloze

### Daily Limits

Set a daily review limit in settings. The plugin ensures ~25% of reviewed cards are new.

### Cram Mode

After finishing due cards, continue reviewing all cards in the deck without affecting scheduling. Useful for exam prep.

### Keyboard Shortcuts

| Action          | Shortcut   |
| --------------- | ---------- |
| Show answer     | `space`    |
| Skip            | `s` or `→` |
| Previous card   | `←`        |
| Breadcrumbs     | `b`        |
| Perfect         | `space`    |
| Forgot          | `f`        |
| Hard            | `h`        |
| Good            | `g`        |

### Command Palette

Type "Memo: Start Review Session" in the command palette (`Cmd+P` / `Ctrl+P`).

## Review Modes

The plugin offers two review modes:

### Spaced Interval Mode (Memory Training)
Uses the SM2 algorithm to optimize long-term memory retention with grading: Forgot / Hard / Good / Perfect.

### Fixed Interval Mode (Progressive Reading)
A relaxed approach for content you want to revisit regularly. Includes **Progressive Mode** with automatic interval growth:
- Review schedule: 2 days → 6 days → 12 days → 24 days → 48 days → 96 days → and so on
- **Algorithm**: 
  - First review: Fixed 2-day interval (gentler than SM2's standard 1 day)
  - Second review: Fixed 6-day interval
  - Subsequent reviews: Calculated from `progressiveRepetitions` using standard exponential sequence, independent of manual interval settings
  - Calculation: `nextInterval = (6 × 2^(progressiveRepetitions - 2)) × 2.0`
- **Independent counter**: Progressive mode maintains its own `progressiveRepetitions` counter, completely separate from standard SM2 mode's `repetitions`, `interval`, and `eFactor`
- **Mode isolation**: Switching from Days/Weeks/Months modes to Progressive automatically resets to the standard progressive sequence—manual interval settings don't interfere
- **Design philosophy**: A fully automated approach that eliminates manual grading and configuration while providing scientifically-backed spaced repetition

> **Important Design Note**: In Progressive mode, the `intervalMultiplier` field stores the **actual next review interval** (same as what UI displays). The calculation process is:
> 1. Calculate `expectedInterval` from standard sequence: `6 × 2^(progressiveRepetitions - 2)`
> 2. Apply SM2 Good logic: `actualInterval = expectedInterval × 2.0`
> 3. Store `actualInterval` in `intervalMultiplier` for data persistence
> 
> Example sequence: progReps=0 → 2 days, progReps=1 → 6 days, progReps=2 → 12 days, progReps=3 → 24 days...

> **Tip:** New cards default to Progressive mode for a gentler learning experience. Switch to Spaced Interval mode anytime if you want more granular control over difficulty ratings.

## Recent Updates

- **2026-04 Card Rendering Flicker Fix** — Fixed UI flickering when navigating between cards with different structures (e.g., from Q&A card to single-block card). Root cause: state judgment was faster than DOM rendering, causing stale content to briefly appear. Solution: Added `isRendered` flag that delays automatic answer display until Roam API completes rendering. This ensures clean transitions without visual artifacts.
- **2026-04 Breadcrumb Order Fix** — Fixed breadcrumb display order to perfectly match Roam native. Roam's `:block/parents` API returns unordered ancestor array, so the plugin now queries each parent's depth via pull API and sorts by hierarchy depth. This ensures correct root-to-leaf order regardless of API return order.
- **2026-04 Color Theme System** — Unified color management with CSS variables for automatic light/dark theme adaptation. Eliminated hardcoded colors and duplicate code for better maintainability.
- **2026-04 Progressive Mode Algorithm Fix** — Fixed state pollution issue where manual interval settings from Days/Weeks modes could interfere with Progressive mode calculations. Progressive mode now uses pure function design based solely on `progressiveRepetitions`, ensuring consistent exponential growth sequence (2→6→12→24→48→96) regardless of mode switching history.
- **2025-04 Breadcrumbs persistence** — User's breadcrumb visibility preference is now saved to localStorage and restored on next session
- **Mobile navigation buttons** — ◀ ▶ buttons in the footer for card navigation on all devices
- **Focus fix** — Resolved focus loss when navigating between blocks with arrow keys or selecting text
- **Forgot reinsertion** — Configurable reinsertion of "Forgot" cards into the current session queue (N cards later)

## Development Notes

### Build Configuration

- Webpack UMD output with `library.type: 'umd'` and `library.export: 'default'`
- Babel preset-env for ES5 compatibility
- External dependencies: React, ReactDOM, BlueprintJS, ChronoNode

**⚠️ CRITICAL: Do NOT remove `library.export: 'default'`!**

When building for Roam Research via `[[roam/js]]` loading, the webpack configuration **MUST** include `export: 'default'` in the library output settings. Removing this causes:
- `Uncaught SyntaxError: Unexpected token 'export'` error in browser
- Plugin fails to load silently (no UI appears)
- Script execution stops before reaching `onload()` function

This is required because Roam Research loads the plugin via `<script>` tag, and the UMD wrapper needs proper default export handling to work in browser environments.


**Correct configuration:**
```javascript
output: {
  library: {
    name: 'RoamMemo',
    type: 'umd',
    export: 'default',  // ⚠️ MUST NOT be removed
  },
}
```

### roam/js Loading

This plugin supports loading via `[[roam/js]]` page:

```javascript
if (!window.roamMemoLoaded) {
  window.roamMemoLoaded = true;
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/gh/issaker/roam-memo@main/extension.js';
  script.type = 'text/javascript';
  script.onload = () => window.RoamMemo?.onload({ extensionAPI: window.roamAlphaAPI });
  document.head.appendChild(script);
}
```

**roam/js Limitations:**
- Settings are persisted to the `roam/memo` page (not Roam Depot's settings panel)
- Uses `window.roamAlphaAPI` instead of full `extensionAPI`
- Settings dialog is accessible via gear icon in the practice overlay

## Bug Reports & Feature Requests

Create issues at https://github.com/kingfengji/roam-memo

---

Original author: [kingfengji](https://github.com/kingfengji/roam-memo)
