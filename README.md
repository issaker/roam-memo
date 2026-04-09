# Memo - Spaced Repetition for Roam

A spaced repetition plugin for [Roam Research](https://roamresearch.com), using a modified SuperMemo 2 (SM2) algorithm.

![Demo Preview](https://user-images.githubusercontent.com/1279335/189250105-656e6ba3-7703-46e6-bc71-ee8c5f3e39ab.gif)

## What is Spaced Repetition

Spaced repetition reviews information based on how well you remember it, focusing more on difficult cards and less on easy ones. This is one of the most effective methods for long-term memorization.

## Installation

This is a modified and upgraded version of the original Memo plugin. It cannot be installed via Roam Depot. Instead, load it using the `{{[[roam/js]]}}` block on any page in your Roam graph:

```
- {{[[roam/js]]}}
    - ```javascript
      if (!window.roamMemoLoaded) {
        window.roamMemoLoaded = true;
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/gh/issaker/roam-memo@main/extension.js';
        script.onload = function() {
          if (window.RoamMemo && window.RoamMemo.onload) {
            window.RoamMemo.onload({ extensionAPI: window.roamAlphaAPI });
          }
        };
        document.head.appendChild(script);
      }
      ```
```

## Getting Started

1. Tag any block you wish to memorize with `#memo` (or your configured tag).
2. Click "Review" in the sidebar to launch.
3. Start reviewing.

> **Tip:** Child blocks are treated as answers and are initially hidden. Click "Show Answer" to reveal them.

## Features

### Multi Deck Support

Enter a comma-separated list of tags in "Tag Pages" in settings to create multiple decks. Supports quoted tags containing commas (e.g., `"french exam, fun facts"`).

### Text Masking (Cloze)

Hide text for recall practice using braces `{}`, e.g., `{hide me}`. Cloze text is masked with a background color overlay and revealed on answer.

### Daily Limits

Set a daily review limit in settings. The plugin ensures ~25% of reviewed cards are new, with round-robin distribution across decks for fairness.

### Shuffle Cards

Enable card shuffling in settings to randomize the order of new and due cards during review.

### Cram Mode

After finishing due cards, continue reviewing all cards in the deck without affecting scheduling. Useful for exam prep.

### Breadcrumbs

Show the block's page hierarchy as breadcrumbs for context. Toggle with `b` key. Visibility preference is persisted across sessions.

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
| Edit interval   | `e`        |

### Command Palette

Type "Memo: Start Review Session" in the command palette (`Cmd+P` / `Ctrl+P`).

## Review Modes

### Spaced Interval Mode (Memory Training)

Uses a **modified SM2 algorithm** to optimize long-term memory retention with grading: Forgot / Hard / Good / Perfect.

**Algorithm:**
- **Interval Calculation**: `interval × eFactor × (grade/5)` — grade-based adjustment (Grade 3 → 60%, Grade 4 → 80%, Grade 5 → 100%)
- **E-Factor Update**: Always updated. Lower grades → more frequent reviews. Minimum eFactor = 1.3.
- **Reset Behavior**: Grade 0 → review again today (interval=0); Grades 1-2 → review tomorrow (interval=1)
- **Grade Mapping**: Forgot(0), Hard(2), Good(4), Perfect(5) — grades 1 and 3 are skipped for simplicity

### Fixed Interval Mode (Progressive Reading)

A relaxed approach for content you want to revisit regularly. Includes **Progressive Mode** with automatic interval growth:

- Review schedule: 2 → 6 → 12 → 24 → 48 → 96 days...
- Calculation: `nextInterval = (6 × 2^(progressiveRepetitions - 2)) × 2.0` for progReps ≥ 2; progReps 0 and 1 use hardcoded 2 and 6 days
- Progressive mode maintains its own `progressiveRepetitions` counter, independent of SM2's `repetitions`, `interval`, and `eFactor`
- Also supports manual intervals: Days, Weeks, Months, Years

> **Tip:** New cards default to Progressive mode for a gentler learning experience. Switch to Spaced Interval mode anytime for more granular control.

### Dynamic Review Mode Switching

Each card's `reviewMode` is read from the Data Page in real-time on every card navigation. Changes to `reviewMode::` on the Data Page take effect immediately — no session restart required.

## Data Storage

All practice data is stored on a Roam page (default: `roam/memo`) with this structure:

```
roam/memo (page)
├── data (heading block)
│   ├── ((cardUid1))
│   │   ├── [[Date]] 🟢        ← session heading (emoji = grade)
│   │   │   ├── nextDueDate:: [[Date]]
│   │   │   ├── grade:: 5
│   │   │   └── reviewMode:: SPACED_INTERVAL
│   │   └── [[Date]] 🔴
│   │       └── ...
│   └── ((cardUid2))
│       └── ...
├── cache (heading block)
│   └── [[tagName]]
│       ├── renderMode:: normal
│       └── ...
└── settings (heading block)
    ├── tagsListString:: memo
    └── ...
```

## Development

### Build

```bash
npm install
npm run build        # Production build → build/extension.js
npm run typecheck    # TypeScript type checking
npm run test         # Run tests
```

### Build Configuration

- Webpack UMD output with `library.type: 'umd'` and `library.export: 'default'`
- Babel preset-env for ES5 compatibility
- External dependencies: React, ReactDOM, BlueprintJS, ChronoNode

**⚠️ CRITICAL: Do NOT remove `library.export: 'default'`!**

Roam Research loads the plugin via `<script>` tag. The UMD wrapper needs proper default export handling. Removing this causes `Uncaught SyntaxError: Unexpected token 'export'` and the plugin fails silently.

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

This plugin is loaded via `{{[[roam/js]]}}` as described in the Installation section above.

**roam/js Limitations:**
- Settings are persisted to the `roam/memo` page (not Roam Depot's settings panel)
- Uses `window.roamAlphaAPI` instead of full `extensionAPI`
- Settings dialog is accessible via gear icon in the practice overlay

### Project Structure

```
src/
├── extension.tsx          # Plugin entry point (onload/onunload)
├── app.tsx                # Root React component, orchestrates review workflow
├── practice.ts            # SM2 algorithm + Fixed Interval algorithm
├── models/
│   ├── session.ts         # Session data model (review modes, interval types)
│   └── practice.ts        # Today's review status model
├── queries/
│   ├── data.ts            # Core data layer (read/write practice data)
│   ├── today.ts           # Today's review calculation (due/new/completed)
│   ├── save.ts            # Write practice data to Roam blocks
│   ├── cache.ts           # Per-tag cache (renderMode, etc.)
│   ├── settings.ts        # Settings persistence to Roam page
│   ├── utils.ts           # Roam API query helpers
│   └── legacyRoamSr.ts    # Roam-SR data migration
├── hooks/
│   ├── useSettings.ts     # Settings management with dual-mode support
│   ├── usePracticeData.tsx # Practice data fetching with ref-based caching
│   ├── useCurrentCardData.tsx # Active card session data resolution
│   ├── useBlockInfo.tsx   # Block content + breadcrumbs
│   ├── useCloze.tsx       # Cloze deletion ({text} masking)
│   ├── useCachedData.ts   # Per-tag cache management
│   ├── useTags.tsx        # Tag list parsing with quoted-tag support
│   └── ...                # Other UI interaction hooks
├── components/
│   ├── overlay/
│   │   ├── PracticeOverlay.tsx  # Main review overlay
│   │   ├── CardBlock.tsx        # Card rendering with answer toggle
│   │   └── Footer.tsx           # Grading controls + navigation
│   ├── SidePanelWidget.tsx      # Sidebar review button + stats
│   ├── ButtonTags.tsx           # Deck selector buttons
│   └── RoamSrImportPanel.tsx    # Roam-SR data import
├── utils/
│   ├── date.ts            # Date operations (addDays, customFromNow)
│   ├── string.ts          # String parsing (Roam date format, config strings)
│   ├── dom.ts             # DOM simulation (mouse click events)
│   ├── object.ts          # Deep clone utility
│   ├── async.ts           # Sleep + debounce
│   ├── mediaQueries.ts    # Responsive breakpoints
│   └── zIndexFix.ts       # CSS z-index fix injection
└── theme.ts               # CSS variable definitions for light/dark themes
```

## Bug Reports & Feature Requests

Create issues at https://github.com/kingfengji/roam-memo

---

Original author: [kingfengji](https://github.com/kingfengji/roam-memo)
