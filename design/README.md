# design/preview.html

A self-contained, design-only snapshot of `index.html` for dropping into
Claude (or any other artifact/playground that takes a single HTML file).

## What it is

- **All the CSS** from `index.html`, unchanged.
- **All the HTML** from `index.html` — landing page, guest page
  (nav + hero + countdown + subnav + RSVP form + already-submitted
  screen + FAQ + overseas info + success screen), unchanged.
- **A stub `<script>` replacing the backend logic**. There are no
  `fetch` calls, no Apps Script dependency, no real validation. The
  stub:
  - Hardcodes six sample events.
  - Hardcodes a demo guest (`Shah Family`) with an `existingRSVP`.
  - On load, jumps straight to the already-submitted screen so the
    invitation cards (including the three image cards) render.
  - Wires up just the visual interactions: event-card expand,
    attend/decline toggles, FAQ accordion, subnav switching,
    countdown ticker.

## How to use it with Claude design

1. Open the GitHub raw view of `design/preview.html`.
2. Select all, copy.
3. Paste into Claude as an artifact prompt (e.g. "Here's my current
   design — iterate on X").

## How to change which screen renders on load

Edit the very first line of the `<script>` block near the top:

```js
var SHOW_STATE = 'invitation-cards';
// one of: 'landing' | 'rsvp-form' | 'invitation-cards' | 'faq' | 'overseas'
```

## Keeping it in sync with `index.html`

This file is a **manual snapshot**, not a generated artifact. If the
real `index.html` changes significantly, either regenerate this file
with the same transform (stub the backend, hardcode sample data) or
accept some drift.
