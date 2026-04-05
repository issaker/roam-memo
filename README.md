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
- Enclose text with `^^`, e.g., `^^hide me^^`
- Or use braces `{}`, e.g., `{hide me too}`

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

## Recent Updates

- **Mobile navigation buttons** — ◀ ▶ buttons in the footer for card navigation on all devices
- **Focus fix** — Resolved focus loss when navigating between blocks with arrow keys or selecting text
- **Forgot reinsertion** — Configurable reinsertion of "Forgot" cards into the current session queue (N cards later)

## Bug Reports & Feature Requests

Create issues at https://github.com/kingfengji/roam-memo

---

Original author: [kingfengji](https://github.com/kingfengji/roam-memo)
