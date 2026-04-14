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
| **Read** | Incremental Read Mode | Blue | Same as primary intent |

The dialog border color also dynamically matches the mode badge color, reinforcing the visual cue across the entire window. Can be toggled via the "Show Review Mode Borders" setting.

### Keyboard Shortcuts

| Action          | Shortcut   |
| --------------- | ---------- |
| Show answer     | `space`    |
| Skip            | `s` or `→` |
| Previous card   | `←`        |
| Breadcrumbs     | `b`        |
| Perfect / Next  | `space`    |
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

### Fixed Interval Mode (Progressive Review)

A relaxed approach for content you want to revisit regularly. Includes **Progressive Mode** with automatic interval growth:

- Review schedule: 2 → 6 → 12 → 24 → 48 → 96 days...
- Calculation: `nextInterval = 6 × 2^(progressiveRepetitions - 2)` for progReps ≥ 2; progReps 0 and 1 use hardcoded 2 and 6 days
- Progressive mode maintains its own `progressiveRepetitions` counter, independent of SM2's `repetitions`, `interval`, and `eFactor`
- Also supports manual intervals: Days, Weeks, Months, Years

> **Tip:** New cards default to Progressive mode for a gentler learning experience. Switch to Spaced Interval mode anytime for more granular control.

### Incremental Read Mode (Progressive Reading)

A line-by-line reading mode designed for long-form content. Based on the **Incremental Reading** methodology, it breaks reading into digestible chunks with spaced intervals between sections.

**How it differs from LBL Review:**

| Aspect | LBL Review (SPACED_INTERVAL_LBL) | Incremental Read (FIXED_PROGRESSIVE_LBL) |
|--------|-----------------------------------|------------------------------------------|
| Purpose | Memory reinforcement | Reading comprehension |
| Per session | Review all due children | Read one child, then next card |
| Grading | SM2 buttons (Forgot/Hard/Good/Perfect) | "Next" button only |
| Scheduling | SM2 per child | Progressive per child |
| Next appearance | When any child is due | When next child is due |

**Per-child Progressive intervals:**
- Each child block gets its own independent Progressive interval counter
- Schedule: 2 → 6 → 12 → 24 → 48 → 96 days per child
- A 20-child article: all children start at 2-day intervals, not just the first few
- The card's `nextDueDate` is set to the earliest child due date

**Workflow:**
1. Select "Incremental Read" from the mode selector (📖 icon)
2. The first unread child block is revealed
3. Click "Next" to mark it as read and advance to the next card
4. Next time the card appears, the next unread child is shown
5. After all children are read, the cycle restarts from the beginning

### Dynamic Review Mode Switching

Each card's `reviewMode` is stored in the **meta block** on the Data Page as the single source of truth. Changes take effect immediately on card navigation — no session restart required.

### Urgency-Based Due Card Sorting

Due cards are sorted by **memory urgency** using a three-level priority system, ensuring the most at-risk cards are always reviewed first:

| Priority | Sort Key | Direction | Rationale |
|----------|----------|-----------|-----------|
| 1st | `nextDueDate` | Earlier first | More overdue → lower retrieval strength → higher urgency |
| 2nd | `eFactor` | Lower first | Lower eFactor → faster forgetting rate → higher urgency |
| 3rd | `repetitions` | Fewer first | Fewer reps → less stable memory → higher urgency |

**Example:** A card 5 days overdue with eFactor 1.3 and 1 repetition will appear before a card 1 day overdue with eFactor 2.5 and 5 repetitions — because it has the highest risk of being forgotten.

When `shuffleCards` is enabled, this sort is overridden by random shuffling.

### Line-by-Line Review

A specialized card-level review mode for cards with multiple child blocks (outline structure). When enabled, each child block is treated as an independent Q&A item with its own spaced repetition schedule.

**How it works:**
1. Mark a card as line-by-line via the **LBL** checkbox in the header (only visible when a card has child blocks)
2. The `LBL` switch belongs to the current card itself, not to a global session flag
3. On review, the parent block (question) is shown with all children hidden
4. Click "Show Answer" to reveal one child block at a time in outline order
5. After each child is revealed, grade it using the standard SM2 buttons (Forgot/Hard/Good/Perfect)
6. Each child block keeps its own independent SM2 data
7. Every time the card appears, review starts from the top and skips directly to the first child that is still due
8. After the last due child is graded, the session automatically advances to the next card
9. The line-by-line interaction only activates in `Spaced Interval Mode`; in `Fixed Interval Mode` the same card remains a fully expanded reading card

**Memory state tracking:**
- Children with `nextDueDate` in the future are considered mastered — shown directly, no "Show Answer" needed
- Children with no review history or past-due `nextDueDate` require active review
- The card's main `nextDueDate` is set to the earliest child due date, ensuring the card appears as "due" when any child needs review
- `lineByLineReview`, `lineByLineProgress`, and the line-by-line parent `nextDueDate` are stored in a dedicated card-level `meta` block, so card metadata stays structurally separate from historical review sessions

**Visual indicators:**
- **LBL checkbox** in the header toggles line-by-line mode for the current card
- **L2/5** tag shows current line progress (current line / total lines)
- Mastered lines display with reduced opacity and a subtle left border
- The current active line has a green left border highlight

## Data Architecture

All practice data is stored on a Roam page (default: `roam/memo`). Each card's data is split into two layers:

### 1. CardMeta (persistent, card-level) — Single Source of Truth

Stored in the `meta` block. These fields define the card's identity and behavior:

```
((cardUid))
├── meta                        ← Card-level persistent data
│   ├── reviewMode:: SPACED_INTERVAL    ← Algorithm mode (SINGLE SOURCE OF TRUTH)
│   ├── lineByLineReview:: Y            ← Line-by-line toggle
│   ├── lineByLineProgress:: {...}      ← Per-child progress data
│   └── nextDueDate:: [[Date]]          ← Earliest due date
```

### 2. Session Records (per-review, historical)

Stored as date-headed blocks. These record algorithm-specific parameters at each review:

```
├── [[Date]] 🟢                ← Session heading (emoji = grade)
│   ├── nextDueDate:: [[Date]]
│   ├── grade:: 5
│   ├── eFactor:: 2.5
│   └── repetitions:: 3
└── [[Date]] 🔴
    └── ...
```

**Key principle:** `reviewMode` lives ONLY in the meta block. Session records contain algorithm-specific parameters (grade, interval, eFactor, etc.) but NOT reviewMode. This ensures a single source of truth and prevents mode conflicts.

### lineByLineProgress Data Format

The `lineByLineProgress` field in the meta block stores per-child scheduling data as JSON:

```json
{
  "childUid1": {
    "nextDueDate": "2026-04-16T00:00:00.000Z",
    "interval": 2,
    "repetitions": 1,
    "eFactor": 2.5,
    "progressiveRepetitions": 1
  },
  "childUid2": {
    "nextDueDate": "2026-04-20T00:00:00.000Z",
    "interval": 6,
    "repetitions": 2,
    "eFactor": 2.5,
    "progressiveRepetitions": 2
  }
}
```

- **LBL Review mode** uses SM2 fields (`interval`, `repetitions`, `eFactor`) per child
- **Incremental Read mode** uses `progressiveRepetitions` per child for Progressive scheduling
- Both modes share the same data structure; `progressiveRepetitions` is optional and only used by Read mode

### Full Data Page Structure

```
roam/memo (page)
├── data (heading block)
│   ├── ((cardUid1))
│   │   ├── meta
│   │   │   ├── reviewMode:: SPACED_INTERVAL
│   │   │   ├── lineByLineReview:: Y
│   │   │   ├── lineByLineProgress:: {"childUid": {...}}
│   │   │   └── nextDueDate:: [[Date]]
│   │   ├── [[Date]] 🟢
│   │   │   ├── nextDueDate:: [[Date]]
│   │   │   ├── grade:: 5
│   │   │   └── eFactor:: 2.5
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

## Data Migration

The Data Migration tool (accessible via Settings → Data Migration) performs three tasks:

1. **cardType → reviewMode**: Renames legacy `cardType::` to `reviewMode::` in meta blocks
2. **Missing reviewMode**: Infers and writes `reviewMode` to meta for cards without one
3. **Session cleanup**: Removes redundant `reviewMode::` from session records (reviewMode belongs only in meta)

Safe to run multiple times — already-migrated cards are skipped.

## Real-Time Data Synchronization

The `useCurrentCardData` hook implements a **dual-layer data resolution** strategy:

```
Session Queue (one-time read)     Data Page (real-time polling, 2s)
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

**Layer 2 — Data Page Polling (real-time):** Every 2 seconds, the hook reads the latest session data for the current card directly from the Data Page via `getPluginPageData({ limitToLatest: true })`. This detects external changes (history deletion, reviewMode edits) and updates the display immediately.

**Optimistic updates:** When the user toggles reviewMode in the UI, `applyOptimisticCardMeta` provides instant feedback before the next poll confirms the change.

**Shallow comparison:** Polling compares only key session fields (interval, repetitions, eFactor, reviewMode, nextDueDate, dateCreated) to avoid unnecessary re-renders when data hasn't meaningfully changed.

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
├── constants.ts           # Shared constants (meta block name, meta-session key routing)
├── models/
│   ├── session.ts         # Session & CardMeta data models, review mode definitions
│   └── practice.ts        # Today's review status model
├── queries/
│   ├── data.ts            # Core data layer (read practice data from Roam page)
│   ├── today.ts           # Today's review calculation (due/new/completed)
│   ├── save.ts            # Write practice data + card metadata to Roam blocks
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
│   ├── MigrateLegacyDataPanel.tsx # Data migration tool
│   └── RoamSrImportPanel.tsx    # Roam-SR data import
├── utils/
│   ├── date.ts            # Date operations (addDays, customFromNow)
│   ├── string.ts          # String parsing (Roam date format, config strings)
│   ├── dom.ts             # DOM simulation (mouse click events)
│   ├── async.ts           # Sleep + debounce
│   ├── mediaQueries.ts    # Responsive breakpoints
│   └── zIndexFix.ts       # CSS z-index fix injection
└── theme.ts               # CSS variable definitions for light/dark themes
```

## Bug Reports & Feature Requests

Create issues at https://github.com/issaker/roam-memo-Supermemo

---

Original author: [digitalmaster](https://github.com/digitalmaster/roam-memo)
