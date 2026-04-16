# Memo - Spaced Repetition for Roam

A spaced repetition plugin for [Roam Research](https://roamresearch.com), using a modified SuperMemo 2 (SM2) algorithm.

![Demo Preview](https://user-images.githubusercontent.com/1279335/189250105-656e6ba3-7703-46e6-bc71-ee8c5f3e39ab.gif)

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

Enter a comma-separated list of tags in "Tag Pages" in settings to create multiple decks. Supports quoted tags containing commas (e.g., `"french exam, fun facts"`).

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

The header bar displays a color-coded mode badge to the left of the status tags (New / Past Due / etc.), providing instant visual identification of the current card's review mode:

| Mode Badge | Review Mode           | Color  | Aligned With           |
| ---------- | --------------------- | ------ | ---------------------- |
| **Spaced** | Spaced Interval Mode  | Green  | Same as "New" tag      |
| **Fixed**  | Fixed Interval Mode   | Orange | Same as "Past Due" tag |
| **Read**   | Incremental Read Mode | Orange | Same as "Past Due" tag |

The dialog border color also dynamically matches the mode badge color, reinforcing the visual cue across the entire window. Can be toggled via the "Show Review Mode Borders" setting.

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
- Calculation: `progressiveInterval(n)` — a standalone exponential curve independent of SM2:
  - n=0 → 2 days, n=1 → 6 days (hardcoded on-ramps)
  - n≥2 → `6 × 2^(n-1)` days (exponential growth from 6-day base)
- Progressive mode is fully independent: its only parameter is `progressiveRepetitions`, which it increments on each review. It does NOT modify SM2 fields (`repetitions`, `interval`, `eFactor`), preventing cross-mode data pollution
- Also supports manual intervals: Days, Weeks, Months, Years

> **Tip:** New cards default to Progressive mode for a gentler learning experience. Switch to Spaced Interval mode anytime for more granular control.

### Incremental Read Mode (Progressive Reading)

A line-by-line reading mode designed for long-form content. Based on the **Incremental Reading** methodology, it breaks reading into digestible chunks with spaced intervals between sections.

**How it differs from LBL Review:**

| Aspect          | LBL Review (SPACED_INTERVAL_LBL)       | Incremental Read (FIXED_PROGRESSIVE_LBL) |
| --------------- | -------------------------------------- | ---------------------------------------- |
| Purpose         | Memory reinforcement                   | Reading comprehension                    |
| Per session     | Review all due children                | Read one child, then next card           |
| Grading         | SM2 buttons (Forgot/Hard/Good/Perfect) | "Next" button only                       |
| Scheduling      | SM2 per child                          | Progressive per child                    |
| Next appearance | When any child is due                  | When next child is due                   |

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

**Reinsertion:** When you click "Next" on an Incremental Read card, the card is automatically reinserted into the review queue N cards later (configurable via "Reinsert 'Incremental Read' Cards After N Cards" setting, default: 3). Set to 0 to disable reinsertion.

**Queue progression rules:**

- Reinsertion only happens when there is still another unread or due child line to continue later in the same review session
- If the current child is already the last child block, clicking "Next" advances normally and does **not** reinsert the card into the current session queue
- Reinserted cards now resume from the correct next child line inside the same session instead of replaying stale line progress from the session start snapshot

### Dynamic Review Mode Switching

Each card's `reviewMode` is stored in the **latest session block** on the Data Page. Changes take effect immediately on card navigation — no session restart required.

### Urgency-Based Due Card Sorting

Due cards are sorted by **memory urgency** using a three-level priority system, ensuring the most at-risk cards are always reviewed first:

| Priority | Sort Key      | Direction     | Rationale                                                |
| -------- | ------------- | ------------- | -------------------------------------------------------- |
| 1st      | `nextDueDate` | Earlier first | More overdue → lower retrieval strength → higher urgency |
| 2nd      | `eFactor`     | Lower first   | Lower eFactor → faster forgetting rate → higher urgency  |
| 3rd      | `repetitions` | Fewer first   | Fewer reps → less stable memory → higher urgency         |

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
- `lineByLineProgress` and the line-by-line parent `nextDueDate` are stored in the latest session block

**Visual indicators:**

- **LBL checkbox** in the header toggles line-by-line mode for the current card
- **L2/5** tag shows current line progress (current line / total lines)
- Mastered lines display with reduced opacity and a subtle left border
- The current active line has a green left border highlight

## Data Architecture

All practice data is stored on a Roam page (default: `roam/memo`). Each card's data follows a **unified session-block architecture** — all fields are stored in session records, with no separate meta block.

### Unified Session Block Layout

All fields (reviewMode, nextDueDate, lineByLineProgress, grade, eFactor, etc.) are stored uniformly in session blocks. The latest session block is the single source of truth for the card's current state:

```
((cardUid))
├── [[April 14th, 2026]] 🟢    ← Latest session (SINGLE SOURCE OF TRUTH)
│   ├── reviewMode:: FIXED_PROGRESSIVE
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

- `reviewMode` and `nextDueDate` are stored in each session block alongside algorithm-specific fields
- `lineByLineReview` has been removed — LBL functionality is encoded directly in the `reviewMode` value (e.g. `SPACED_INTERVAL_LBL`, `FIXED_PROGRESSIVE_LBL`)
- Each mode only modifies its OWN fields; all other fields are inherited unchanged from the previous session (see Mode Independence below)

### Mode Independence & Full Field Inheritance

Each review mode only calculates and updates its own data fields. When saving, all fields from the previous session are fully inherited, ensuring that switching modes never loses data from any mode.

| Mode                          | Calculated Fields                              | Inherited Fields (unchanged)                                   |
| ----------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| SM2 (Spaced Interval)         | `grade`, `interval`, `repetitions`, `eFactor`  | `progressiveRepetitions`, `intervalMultiplier`                 |
| Progressive                   | `progressiveRepetitions`, `intervalMultiplier` | `interval`, `repetitions`, `eFactor`                           |
| Fixed Days/Weeks/Months/Years | `intervalMultiplier`                           | `interval`, `repetitions`, `eFactor`, `progressiveRepetitions` |

**Example:** If a card has SM2 data (`interval=11, repetitions=3, eFactor=2.26`) and the user switches to Progressive mode, the Progressive session inherits those SM2 fields unchanged. When switching back to SM2, the algorithm uses the preserved SM2 values — Progressive mode never pollutes them.

**Backward compatibility:** Older sparse session histories are now normalized on read. The data layer reconstructs a complete latest-session snapshot by carrying forward the newest known value for each mode-owned state field, so querying the latest session block remains sufficient even for pre-fix data.

### lineByLineProgress Data Format

The `lineByLineProgress` field in the latest session block stores per-child scheduling data as JSON:

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
│   │   ├── [[Date]] 🟢
│   │   │   ├── reviewMode:: SPACED_INTERVAL
│   │   │   ├── nextDueDate:: [[Date]]
│   │   │   ├── lineByLineProgress:: {"childUid": {...}}
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

The Data Migration tool (accessible via Settings → Data Migration) performs four tasks:

1. **cardType → reviewMode**: Renames legacy `cardType::` to `reviewMode::` in meta blocks
2. **Missing reviewMode**: Infers and writes `reviewMode` for cards without one
3. **Meta block merge**: Moves `reviewMode`, `nextDueDate`, `lineByLineProgress` from the meta block into the latest session block, then deletes the meta block
4. **lineByLineReview → LBL reviewMode**: Converts `lineByLineReview:: Y` to the corresponding LBL reviewMode (e.g. `SPACED_INTERVAL` → `SPACED_INTERVAL_LBL`)

Safe to run multiple times — already-migrated cards are skipped.

## Real-Time Data Synchronization

The `useCurrentCardData` hook reads card data from the session queue and derives the current reviewMode from the latest session:

```
Session Queue (one-time read)
        │
        ▼
  Card queue + sessions[]
  (captured at session start)
        │
        ▼
  latestSession → cardMeta → reviewMode (displayed in UI)
```

**Data resolution:** The card queue and full session history are read once when the review session starts. The latest session record is the single source of truth for `reviewMode`, `nextDueDate`, and `lineByLineProgress`.

**Optimistic updates:** When the user toggles reviewMode in the UI, `applyOptimisticCardMeta` provides instant feedback before the data is persisted.

**Fallback:** When cardMeta is not yet loaded, reviewMode falls back to the session queue's reviewMode, then to DEFAULT_REVIEW_MODE.

## 2026-04-16 Update Summary

- **Incremental Read:** Reinserted reading cards now continue from the correct next child line within the same review session
- **Last-line guard:** Incremental Read cards stop reinsert-on-next once the current child is already the last child block
- **Latest snapshot recovery:** Sparse historical sessions are normalized into a full latest-session snapshot during reads
- **Full field inheritance:** Newly saved session blocks continue to carry forward unrelated mode state fields, including shared `lineByLineProgress`
- **Mode isolation:** SM2 and Fixed/Progressive scheduling fields remain independent and do not overwrite each other

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
├── constants.ts           # Shared constants (session key routing)
├── models/
│   ├── session.ts         # Session & CardMeta data models, review mode definitions
│   └── practice.ts        # Today's review status model
├── queries/
│   ├── data.ts            # Core data layer (read practice data from Roam page)
│   ├── today.ts           # Today's review calculation (due/new/completed)
│   ├── save.ts            # Write practice data to Roam session blocks
│   ├── cache.ts           # Per-tag cache (renderMode, etc.)
│   ├── settings.ts        # Settings persistence to Roam page
│   ├── utils.ts           # Roam API query helpers
│   └── legacyRoamSr.ts    # Roam-SR data migration
├── hooks/
│   ├── useSettings.ts     # Settings management with dual-mode support
│   ├── usePracticeData.tsx # Practice data fetching with ref-based caching
│   ├── useCurrentCardData.tsx # Active card data with latest-session resolution
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
