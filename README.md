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
        script.src = 'https://cdn.jsdelivr.net/gh/issaker/roam-memo-Supermemo@main/extension.js';
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

### Mode Indicator Badge

The header bar displays a color-coded mode badge to the left of the status tags (New / Past Due / etc.), providing instant visual identification of the current card's review mode:

| Mode Badge | Review Mode | Color | Aligned With |
|------------|-------------|-------|--------------|
| **Spaced** | Spaced Interval Mode | Green | Same as "New" tag |
| **Fixed** | Fixed Interval Mode | Orange | Same as "Past Due" tag |

The dialog border color also dynamically matches the mode badge color, reinforcing the visual cue across the entire window.

**Dark Mode Adaptation:** In dark mode, the border color brightness is automatically reduced by 50% using CSS `color-mix()` to minimize visual stimulation while maintaining mode visibility.

**Settings Control:** The "Mode Border Color" toggle in Memo Settings allows users to enable/disable this feature. Changes take effect immediately without restarting the session.

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

### Urgency-Based Due Card Sorting

Due cards are sorted by **memory urgency** using a three-level priority system, ensuring the most at-risk cards are always reviewed first:

| Priority | Sort Key | Direction | Rationale |
|----------|----------|-----------|-----------|
| 1st | `nextDueDate` | Earlier first | More overdue → lower retrieval strength → higher urgency |
| 2nd | `eFactor` | Lower first | Lower eFactor → faster forgetting rate → higher urgency |
| 3rd | `repetitions` | Fewer first | Fewer reps → less stable memory → higher urgency |

**Example:** A card 5 days overdue with eFactor 1.3 and 1 repetition will appear before a card 1 day overdue with eFactor 2.5 and 5 repetitions — because it has the highest risk of being forgotten.

When `shuffleCards` is enabled, this sort is overridden by random shuffling.

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

## Real-Time Data Synchronization

### Problem

When a user modifies card history on the Data Page (e.g., deleting a session record) during an active review session, the UI displayed stale expected review times (e.g., "Review in 24 days") because the session data was only read once at session start.

### Architecture

The `useCurrentCardData` hook implements a **dual-layer data resolution** strategy:

```
Session Queue (one-time read)     Data Page (real-time polling, 200ms)
        │                                    │
        ▼                                    ▼
  Card queue + sessions[]           getPluginPageData()
  (captured at session start)       (reads latest session per card)
        │                                    │
        └──────────┬─────────────────────────┘
                   ▼
          currentCardData (displayed in UI)
```

**Layer 1 — Session Queue (one-time read):** The card queue and full session history are read once when the review session starts and remain fixed until the session closes. This ensures stable card ordering and prevents queue disruption.

**Layer 2 — Data Page Polling (real-time):** Every 200ms, the hook reads the latest session data for the current card directly from the Data Page via `getPluginPageData({ limitToLatest: true })`. This detects external changes (history deletion, reviewMode edits) and updates the display immediately.

### Key Design Decisions

- **Shallow comparison (`isSessionDataChanged`):** Polling compares only key session fields (interval, repetitions, eFactor, reviewMode, nextDueDate, dateCreated) to avoid unnecessary re-renders when data hasn't meaningfully changed.
- **No immediate fetch on mount:** The first poll fires after 200ms, not immediately. Effect 1 already provides initial data from the sessions array, so the brief delay is imperceptible.
- **Review mode override:** When the user toggles reviewMode in the UI, a temporary override takes precedence over live data. The override is automatically cleared once the Data Page reflects the persisted change.
- **Refs for polling stability:** `reviewModeOverrideRef` and `reviewModeRef` allow the polling callback to access the latest state values without restarting the interval on every state change.

### Mode-Specific Data Isolation (Bug Fix)

**Problem:** When a card had Progressive mode data (`progressiveRepetitions: 1`) and the user switched to Days mode to set a manual interval, then switched back to Progressive mode, the system incorrectly calculated the next review date because `progressiveRepetitions` was `undefined` in the Days session — causing the Progressive counter to reset to 0.

**Root causes:**
1. `practice()` did not forward `progressiveRepetitions` to `generatePracticeData()`, so the field was always `undefined` regardless of history
2. No historical lookback: when a mode-specific field was `undefined`, the system used `|| 0` instead of searching earlier sessions for the last valid value
3. The 200ms polling effect in `PracticeOverlay` reset `intervalMultiplierType` from the latest session on every update, overriding the user's manual mode switch

**Fix (3 files):**
- **`practice.ts`:** `progressiveRepetitions` is now destructured and passed to `generatePracticeData()`, preserving the counter across sessions
- **`useCurrentCardData.tsx`:** New `resolveModeSpecificData()` function searches backward through session history for the last valid value of a mode-specific field (e.g., `progressiveRepetitions` for Progressive, `intervalMultiplier` for Days/Weeks/Months/Years, `repetitions`/`interval`/`eFactor` for SM2)
- **`PracticeOverlay.tsx`:** `resolvedCardData` applies `resolveModeSpecificData()` before passing data to the Footer and `onPracticeClick`; the interval state initialisation effect now only runs when the card changes (tracked via `prevCardRefUidRef`), not on every polling update

### Review Mode Inheritance Bug Fix

**Problem:** During a review session, when the previous card used Progressive mode and the user clicked "Next", the next card would incorrectly inherit the Progressive mode even though its most recent history record explicitly specified `reviewMode:: SPACED_INTERVAL`. This caused users to be unable to correctly identify the current card's review mode, impacting learning experience and review effectiveness.

**Root causes:**
1. **`reviewModeOverride` not cleared on card navigation (useCurrentCardData.tsx):** Effect 2 only cleared `reviewModeOverride` when `dataPageTitle` was unavailable. When Data Page access was available, the effect relied on the polling effect (Effect 3) to clear the override. However, the polling effect only checks whether the **current** card's data matches the override — after navigating to a new card, the new card's `reviewMode` typically doesn't match the stale override, so the override was **never cleared** and incorrectly applied to the new card.
2. **Stale `currentCardData` in intervalMultiplierType reset effect (PracticeOverlay.tsx):** The reset effect depended on `currentCardData`, which is updated asynchronously by `useCurrentCardData`'s Effect 1. During the first render after a card change, `currentCardData` still contained the **previous** card's data. The effect used this stale data to set `intervalMultiplierType`, copying the previous card's Progressive type to the new card. On the next render, `cardChanged` was `false`, preventing correction.

**Fix (2 files):**
- **`useCurrentCardData.tsx`:** Effect 2 now **always** clears `reviewModeOverride` and resets `reviewMode` to `latestSession?.reviewMode` on card navigation, regardless of whether `dataPageTitle` is available. Additionally, `latestSession` is now exposed as a return value for use by `PracticeOverlay`.
- **`PracticeOverlay.tsx`:** The `intervalMultiplierType` reset effect now uses `latestSession` (derived immediately from sessions via `useMemo`) instead of the asynchronously-updated `currentCardData`. This ensures the effect always operates on the correct new card's data during card transitions.

**Test coverage (5 new tests):**
- Progressive → SPACED_INTERVAL card navigation loads correct mode
- Multiple cards with different modes switch correctly in sequence
- Review history consistency with actual review mode
- `reviewModeOverride` cleared on card navigation to prevent mode inheritance
- `latestSession` correctly derived from sessions

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
│   ├── useCurrentCardData.tsx # Active card data with real-time Data Page polling
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

Create issues at https://github.com/issaker/roam-memo-Supermemo

---

Original author: [digitalmaster](https://github.com/digitalmaster/roam-memo)
