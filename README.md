# Memo - Spaced Repetition for Roam

A spaced repetition plugin for [Roam Research](https://roamresearch.com), using a modified SuperMemo 2 (SM2) algorithm.

![Demo Preview](https://user-images.githubusercontent.com/1279335/189250105-656e6ba3-7703-46e6-bc71-ee8c5f3e39ab.gif)

## Table of Contents

- [What is Spaced Repetition](#what-is-spaced-repetition)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Features](#features)
- [Architecture: SchedulingAlgorithm × InteractionStyle](#architecture-schedulingalgorithm--interactionstyle)
  - [Scheduling Algorithms](#scheduling-algorithms)
  - [Interaction Styles](#interaction-styles)
  - [Algorithm Details](#algorithm-details)
  - [Interaction Style Details](#interaction-style-details)
  - [Dynamic Switching](#dynamic-switching)
- [Design Decisions](#design-decisions)
- [Data Migration](#data-migration)
- [Urgency-Based Due Card Sorting](#urgency-based-due-card-sorting)
- [Settings Architecture](#settings-architecture)
- [Data Architecture](#data-architecture)
- [Development](#development)
- [Bug Reports & Feature Requests](#bug-reports--feature-requests)

## What is Spaced Repetition

Spaced repetition reviews information based on how well you remember it, focusing more on difficult cards and less on easy ones. This is one of the most effective methods for long-term memorization.

## Installation

This is a modified and upgraded version of the original Memo plugin. It cannot be installed via Roam Depot. Instead, load it using the `{{[[roam/js]]}}` block on any page in your Roam graph:

````
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
````

## Getting Started

1. Tag any block you wish to memorize with `#memo` (or your configured tag).
2. Click "Review" in the sidebar to launch.
3. Start reviewing.

> **Tip:** Child blocks are treated as answers and are initially hidden. Click "Show Answer" to reveal them.

## Features

### Multi Deck Support

Enter a comma-separated list of tags in "Tag Pages" in settings to create multiple decks. Supports quoted tags containing commas (e.g., `"french exam, fun facts"`). A special "DailyNote" deck is available (enabled by default) that aggregates all top-level blocks from your daily journal pages.

### DailyNote Deck

A special deck that aggregates all top-level blocks from your Roam Research DailyNote pages (daily journal entries) into a single review deck. Each first-level block on any DailyNote page becomes a review card.

- Enabled by default; can be toggled off in Settings via "Enable DailyNote Deck"
- Appears at the bottom of the deck selector with a calendar icon
- Cards follow the same urgency-based sorting as regular decks
- Cards that overlap with regular decks share the same session data

### Text Masking (Cloze)

Hide text for recall practice using braces `{}`, e.g., `{hide me}`. Cloze text is masked with a background color overlay and revealed on answer.

### Daily Limits

Set a daily review limit in settings. The plugin ensures ~25% of reviewed cards are new, with round-robin distribution across decks for fairness.

### Shuffle Cards

Enable card shuffling in settings to randomize the order of new and due cards during review.

### Cram Mode

After finishing due cards, continue reviewing all cards in the deck without affecting scheduling. Useful for exam prep.

### History Data Cleanup

Clean up old session history data from the data page. Configure how many recent date session blocks to keep per card (default: 3). Older session blocks beyond the specified count will be deleted. This helps reduce data page size over time.

### Breadcrumbs

Show the block's page hierarchy as breadcrumbs for context. Toggle with `b` key. Visibility preference is persisted across sessions.

### Mode Indicator Badge

The header bar displays color-coded badges derived from the card's **Scheduling Algorithm** and **Interaction Style**, providing instant visual identification of the current review configuration.

**Algorithm badge** (left of status tags):

| Badge | Group | Algorithms | Color |
| ----- | ----- | ---------- | ----- |
| **Spaced** | Spaced | `SM2`, `PROGRESSIVE` | Green |
| **Fixed** | Fixed | `FIXED_DAYS/WEEKS/MONTHS/YEARS` | Orange |

**Interaction badge** (shown when not Normal):

| Badge | Interaction Style | Description |
| ----- | ----------------- | ----------- |
| **LBL** | `LBL` | Line-by-Line review |
| **Read** | `READ` | Incremental Read |

The dialog border color also dynamically matches the algorithm group color, reinforcing the visual cue across the entire window. Can be toggled via the "Show Review Mode Borders" setting.

### Keyboard Shortcuts

| Action         | Shortcut   |
| -------------- | ---------- |
| Show answer    | `space`    |
| Skip           | `s` or `→` |
| Previous card  | `←`        |
| Breadcrumbs    | `b`        |
| Close memo     | `esc`      |
| Perfect / Next | `space`    |
| Forgot         | `f`        |
| Hard           | `h`        |
| Good           | `g`        |
| Edit interval  | `e`        |

### Command Palette

Type "Memo: Start Review Session" in the command palette (`Cmd+P` / `Ctrl+P`).

## Privacy & Security

- All practice data is stored in your Roam graph on the configured data page.
- Memo does not send practice/session payloads to any external server.
- The legacy Roam-SR remote bulk import path has been removed to protect user privacy.

## Architecture: SchedulingAlgorithm × InteractionStyle

The review system uses a **two-dimensional orthogonal architecture**: each card is configured by independently choosing a **Scheduling Algorithm** (how intervals are calculated) and an **Interaction Style** (how the card is presented during review). These two dimensions are fully independent — any algorithm can pair with any interaction style, producing 18 possible combinations without requiring new enum values.

| Dimension | Purpose | Values |
|-----------|---------|--------|
| **Scheduling Algorithm** | Controls interval calculation | `SM2`, `PROGRESSIVE`, `FIXED_DAYS`, `FIXED_WEEKS`, `FIXED_MONTHS`, `FIXED_YEARS` |
| **Interaction Style** | Controls card presentation | `NORMAL`, `LBL`, `READ` |

All definitions are in `src/models/session.ts`.

### Scheduling Algorithms

| Algorithm | Group | Label | Description |
|-----------|-------|-------|-------------|
| `SM2` | Spaced | SM2 | Modified SuperMemo 2 — adaptive intervals based on grading |
| `PROGRESSIVE` | Spaced | Progressive | Exponential curve (2→6→12→24→48→96 days) |
| `FIXED_DAYS` | Fixed | Fixed Days | Fixed day interval |
| `FIXED_WEEKS` | Fixed | Fixed Weeks | Fixed week interval |
| `FIXED_MONTHS` | Fixed | Fixed Months | Fixed month interval |
| `FIXED_YEARS` | Fixed | Fixed Years | Fixed year interval |

Adding a new algorithm only requires registering it in the enum and `ALGORITHM_META`.

### Interaction Styles

| Style | Label | Icon | Description |
|-------|-------|------|-------------|
| `NORMAL` | Normal | `layers` | Standard card review — show question, reveal answer |
| `LBL` | Line by Line | `list` | Per-child Q&A with independent scheduling |
| `READ` | Incremental Read | `book` | Per-child sequential reading with Progressive intervals |

### Algorithm Details

#### SM2 Algorithm (Memory Training)

Uses a **modified SM2 algorithm** to optimize long-term memory retention with grading: Forgot / Hard / Good / Perfect.

- **Interval Calculation**: `interval × eFactor × (grade/5)` — grade-based adjustment (Grade 3 → 60%, Grade 4 → 80%, Grade 5 → 100%)
- **E-Factor Update**: Always updated. Lower grades → more frequent reviews. Minimum eFactor = 1.3.
- **Reset Behavior**: Grade 0 → review again today (interval=0); Grades 1-2 → review tomorrow (interval=1)
- **Grade Mapping**: Forgot(0), Hard(2), Good(4), Perfect(5)

#### Progressive Algorithm (Progressive Review)

A relaxed approach for content you want to revisit regularly with automatic interval growth:

- Schedule: 2 → 6 → 12 → 24 → 48 → 96 days...
- Calculation: `progressiveInterval(n)` — standalone exponential curve independent of SM2
- Fully independent: only modifies `progressiveRepetitions`, never pollutes SM2 fields

> **Tip:** New cards default to the Progressive algorithm for a gentler learning experience. Switch to SM2 anytime for more granular control.

#### Fixed Interval Algorithms (Days / Weeks / Months / Years)

Manual fixed intervals for predictable review schedules. The interval multiplier is configurable per card via the interval editor (`E` key).

### Interaction Style Details

#### Line by Line (LBL)

Each child block is treated as an independent Q&A item with its own scheduling data.

1. The parent block (question) is shown with all children hidden
2. Click "Show Answer" to reveal one child block at a time in outline order
3. Grade each child using the standard SM2 buttons (Forgot/Hard/Good/Perfect)
4. Each child block keeps its own independent SM2 data
5. Review starts from the top and skips to the first due child
6. After the last due child is graded, the session advances to the next card

**Visual indicators:** L2/5 tag shows line progress; mastered lines display with reduced opacity; active line has a green left border.

#### Incremental Read (READ)

A line-by-line reading mode for long-form content based on **Incremental Reading** methodology.

| Aspect | LBL | Incremental Read |
|--------|-----|------------------|
| Purpose | Memory reinforcement | Reading comprehension |
| Per session | Review all due children | Read one child, then next card |
| Grading | SM2 buttons | "Next" button only |
| Scheduling | SM2 per child | Progressive per child |

**Workflow:** Select Incremental Read → first unread child is revealed → click "Next" → next time the card appears, the next unread child is shown → after all children are read, cycle restarts.

**Reinsertion:** Clicking "Next" reinserts the card into the review queue N cards later (configurable via "Reinsert 'Incremental Read' Cards After N Cards" setting, default: 3). Set to 0 to disable. Reinsertion only happens when there is still another unread or due child line; the last child does not reinsert.

### Dynamic Switching

Each card's `algorithm` and `interaction` are stored in the **latest session block**. Changes take effect immediately on card navigation — no session restart required. Two independent selectors (bottom-right of the grading area) replace the old single `reviewMode` dropdown.

## Design Decisions

### Why migrate from 8 ReviewModes to Algorithm × Interaction?

The original architecture used a combined `ReviewModes` enum with 8 values, where each value encoded both scheduling and interaction behavior (e.g., `SPACED_INTERVAL_LBL` = SM2 + LBL). This design had fundamental limitations:

- **Not orthogonal**: Adding a new algorithm or interaction required defining N new enum values (one per combination)
- **Not extensible**: Combinations like PROGRESSIVE + LBL or FIXED_DAYS + READ were impossible without new enum entries
- **Coupled concerns**: Scheduling logic and presentation logic were mixed in a single dimension

The new two-dimensional design (`SchedulingAlgorithm` × `InteractionStyle`) separates these concerns completely. Adding a new algorithm or interaction is independent — they combine automatically.

### Why remove runtime backward compatibility in favor of data migration?

The old system maintained runtime compatibility by reading `reviewMode::` fields and decomposing them into `{ algorithm, interaction }` on every card load. This added complexity to the data loading path and created a permanent compatibility layer that could never be removed.

The new approach uses a **one-time data migration** that converts `reviewMode::` fields to `algorithm::` + `interaction::` at the data level. This:

- **Simplifies** the data loading pipeline — no legacy resolution needed
- **Secures** the data format — the source of truth is always the new fields
- **Eliminates** the permanent compatibility tax from the codebase

### Why add LBL forgot reinsertion?

Previously, when a user clicked "Forgot" on an LBL child line, the card would simply record the grade and move on. This was inconsistent with how normal cards behave — a "Forgot" normal card is reinserted into the review queue for another attempt within the same session. LBL forgot reinsertion brings LBL cards in line with this behavior, ensuring a consistent review experience across all interaction styles.

## Data Migration

After upgrading to the new `SchedulingAlgorithm × InteractionStyle` architecture, you should run the Data Migration tool once to convert your existing data.

### How to migrate

1. Open the Memo overlay and click the gear icon to access **Settings**
2. Navigate to the **Data Migration** section
3. Click the migration button to start

### What the migration does

The migration converts your data from the old format to the new format:

- **`reviewMode::` → `algorithm::` + `interaction::`**: Each old `reviewMode` value (e.g., `SPACED_INTERVAL_LBL`) is decomposed into its constituent parts (`algorithm:: SM2` + `interaction:: LBL`)
- **`cardType::` → `reviewMode::`**: Very old `cardType` fields are renamed first
- **Missing reviewMode**: Cards without a mode are inferred from their existing data fields
- **Meta block merge**: Orphaned meta block fields are merged into the latest session block
- **`lineByLineReview:: Y` → LBL interaction**: The old LBL flag is converted to the new interaction style

The migration is **safe to run multiple times** — already-migrated cards are skipped.

> **Important:** Run the migration once after upgrading. All new card data will use the `algorithm::` + `interaction::` format automatically.

## Urgency-Based Due Card Sorting

Due cards are sorted by **memory urgency** using a three-level priority system:

| Priority | Sort Key      | Direction     | Rationale                                                |
| -------- | ------------- | ------------- | -------------------------------------------------------- |
| 1st      | `nextDueDate` | Earlier first | More overdue → lower retrieval strength → higher urgency |
| 2nd      | `eFactor`     | Lower first   | Lower eFactor → faster forgetting rate → higher urgency  |
| 3rd      | `repetitions` | Fewer first   | Fewer reps → less stable memory → higher urgency         |

When `shuffleCards` is enabled, this sort is overridden by random shuffling.

## Settings Architecture

Settings use a **single-source-of-truth** design with `extensionAPI.settings` as the primary store and the Roam data page as a persistent backup.

| Layer | Role | Persistence | When Written |
|-------|------|-------------|-------------|
| `extensionAPI.settings` | **Primary** | Roam Depot: persistent · roam/js: in-memory | On "Apply & Close" |
| Roam data page (`roam/memo`) | **Backup** | Persistent (blocks) | Debounced 5s after last change |

**Key design decisions:**

1. **Explicit save**: Settings are only saved when the user clicks "Apply & Close" in the Settings dialog. This prevents queue errors and risks from immediate setting application
2. **Apply & Close**: Saves all settings, closes the Settings dialog and the Practice Overlay. The user must manually reopen the plugin window for new settings to take full effect
3. **Close (discard)**: Closes the Settings dialog without saving any changes made in the current session
4. **Page as backup, not source**: The data page is only read at startup when `extensionAPI.settings` is empty (roam/js cold start)
5. **5-second debounced page sync**: Coalesces rapid changes into a single write, reducing Roam sync indicator load
6. **Unmount flush**: Pending debounced syncs are flushed immediately when the overlay closes

In **roam/js mode**, an in-memory overlay wraps `extensionAPI.settings` to provide working `getAll/set/get` methods. Settings are lost on page reload, which is why the data page backup exists.

## Data Architecture

All practice data is stored on a Roam page (default: `roam/memo`). Each card's data follows a **unified session-block architecture** — all fields are stored in session records, with no separate meta block.

### Session Block Layout

The latest session block is the single source of truth for the card's current state:

```
((cardUid))
├── [[April 14th, 2026]] 🟢    ← Latest session (SINGLE SOURCE OF TRUTH)
│   ├── algorithm:: SM2
│   ├── interaction:: LBL
│   ├── nextDueDate:: [[April 15th, 2026]]
│   ├── lineByLineProgress:: {"childUid": {...}}
│   ├── grade:: 5
│   ├── eFactor:: 2.5
│   ├── repetitions:: 3
│   ├── interval:: 6
│   ├── progressiveRepetitions:: 2
│   └── intervalMultiplier:: 6
└── [[April 13th, 2026]] 🔴    ← Older session
    └── ...
```

**Key principles:**

- `algorithm` and `interaction` are the primary fields for scheduling configuration
- `nextDueDate` is stored in each session block alongside algorithm-specific fields
- Each algorithm only modifies its OWN fields; all other fields are inherited unchanged from the previous session

### Algorithm Independence & Full Field Inheritance

| Algorithm | Calculated Fields | Inherited Fields (unchanged) |
|-----------|-------------------|------------------------------|
| SM2 | `grade`, `interval`, `repetitions`, `eFactor` | `progressiveRepetitions`, `intervalMultiplier` |
| Progressive | `progressiveRepetitions`, `intervalMultiplier` | `interval`, `repetitions`, `eFactor` |
| Fixed Days/Weeks/Months/Years | `intervalMultiplier` | `interval`, `repetitions`, `eFactor`, `progressiveRepetitions` |

Switching algorithms never loses data — each algorithm preserves all fields from other algorithms.

### lineByLineProgress Data Format

The `lineByLineProgress` field stores per-child scheduling data as JSON:

```json
{
  "childUid1": {
    "nextDueDate": "2026-04-16T00:00:00.000Z",
    "interval": 2,
    "repetitions": 1,
    "eFactor": 2.5,
    "progressiveRepetitions": 1
  }
}
```

- **LBL interaction** uses SM2 fields (`interval`, `repetitions`, `eFactor`) per child
- **Incremental Read interaction** uses `progressiveRepetitions` per child

### Full Data Page Structure

```
roam/memo (page)
├── data (heading block)
│   ├── ((cardUid1))
│   │   ├── [[Date]] 🟢
│   │   │   ├── algorithm:: SM2
│   │   │   ├── interaction:: NORMAL
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

### Project Structure

```
src/
├── extension.tsx          # Plugin entry point (onload/onunload)
├── app.tsx                # Root React component, orchestrates review workflow
├── practice.ts            # SM2 algorithm + Fixed Interval algorithm
├── constants.ts           # Shared constants (including DAILYNOTE_DECK_KEY)
├── models/
│   ├── session.ts         # Session & CardMeta models, SchedulingAlgorithm, InteractionStyle, ALGORITHM_META, INTERACTION_META
│   └── practice.ts        # Today's review status model
├── queries/
│   ├── data.ts            # Core data layer
│   ├── today.ts           # Today's review calculation
│   ├── save.ts            # Write practice data to Roam session blocks
│   ├── cache.ts           # Per-tag cache
│   ├── settings.ts        # Settings page persistence
│   ├── utils.ts           # Roam API query helpers
│   └── legacyRoamSr.ts    # Roam-SR data migration
├── hooks/
│   ├── useSettings.ts     # Settings single-source-of-truth
│   ├── usePracticeData.tsx # Practice data fetching with ref-based caching
│   ├── useCurrentCardData.tsx # Active card data with latest-session resolution
│   ├── useLineByLineReview.ts # LBL & Incremental Read interaction logic
│   ├── useBlockInfo.tsx   # Block content + breadcrumbs
│   ├── useCloze.tsx       # Cloze deletion ({text} masking)
│   ├── useCachedData.ts   # Per-tag cache management
│   ├── useTags.tsx        # Tag list parsing with quoted-tag support
│   └── ...                # Other UI interaction hooks
├── contexts/
│   └── PracticeSessionContext.tsx # Session-level state
├── components/
│   ├── overlay/
│   │   ├── PracticeOverlay.tsx  # Main review overlay
│   │   ├── Header.tsx           # Header with algorithm/interaction badges
│   │   ├── CardBlock.tsx        # Card rendering with answer toggle
│   │   ├── Footer.tsx           # Grading controls + algorithm & interaction selectors
│   │   ├── LineByLineView.tsx   # Line-by-line child block rendering
│   │   ├── SettingsDialog.tsx   # Settings dialog with HistoryCleanup integration
│   │   └── HistoryCleanup.tsx   # History data cleanup UI
│   ├── SettingsForm.tsx         # Settings form component
│   ├── SidePanelWidget.tsx      # Sidebar review button + stats
│   ├── ButtonTags.tsx           # Deck selector buttons
│   ├── MigrateLegacyDataPanel.tsx # Data migration tool
│   └── ...                      # Other UI components
├── utils/
│   ├── date.ts            # Date operations
│   ├── string.ts          # String parsing
│   ├── dom.ts             # DOM simulation
│   ├── async.ts           # Sleep + debounce
│   ├── mediaQueries.ts    # Responsive breakpoints
│   ├── zIndexFix.ts       # CSS z-index fix injection
│   └── testUtils.ts       # Test helpers
└── theme.ts               # Theme color definitions
```

## Bug Reports & Feature Requests

Create issues at https://github.com/issaker/roam-memo-Supermemo

---

Original author: [digitalmaster](https://github.com/digitalmaster/roam-memo)
