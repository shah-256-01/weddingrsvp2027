# Wedding Admin — Current Design System

A snapshot of the admin dashboard's visual and interaction design as of this
writing. Intended to be fed to a design reviewer (e.g. Claude) to critique and
suggest a stronger, more coherent design language.

The admin lives in a single file: `admin.html` (served via GitHub Pages, talks
to Apps Script as an API). It has five tabs: **Guests · Messages · RSVPs ·
Settings · CSV Upload**.

This document captures what exists today — tokens, components, layouts,
interactions, and known tradeoffs. It does **not** prescribe changes.

---

## 1. Design tokens (`:root`)

### Colors — a muted wine/gold palette

| Token | Hex | Role |
|---|---|---|
| `--blush` | `#f5e6da` | Soft warm tint (hover backgrounds) |
| `--rose` | `#c97b84` | Accent (unused in admin; lives in guest site) |
| `--wine` | `#6b2737` | Primary ink (headings, button text, focus) |
| `--wine-d` | `#4a1a25` | Deeper wine (tab bar background) |
| `--gold` | `#b8924a` | Metallic accent (borders, pending state) |
| `--gold-lt` | `#e8c87a` | Pale gold (button text on wine) |
| `--gold-pale` | `#f7edda` | Cream gold (card tints, mode switcher bg) |
| `--green` | `#2d4a3e` | Success / RSVP'd (traffic light green) |
| `--cream` | `#fdf6ef` | Guest-site background (not used in admin) |
| `--ink` | `#2a1f1a` | Body text, admin nav background |
| `--teal` | `#4a7c74` | Overseas badge |
| `--muted` | `#8a7060` | Secondary text, labels |
| `--border` | `rgba(184,146,74,.22)` | Gold-tinted hairline borders |
| `--red` | `#8b2020` | Danger (delete, "not sent", declined) |
| `--admin-bg` | `#f0ebe4` | Admin page background |
| `--card-bg` | `#fff` | Card surface |

### Typography scale

Body is set to **19px**, so every `rem` cascades against that.

| Token | rem | ≈ px | Intended use |
|---|---|---|---|
| `--fs-2xs` | `.62rem` | ~11.8px | Cinzel micro — pills, eyebrows, pagination |
| `--fs-xs` | `.72rem` | ~13.7px | Cinzel small — tabs, small labels |
| `--fs-sm` | `.8rem` | ~15.2px | Cinzel buttons, card titles |
| `--fs-md` | `.9rem` | ~17.1px | Jost body copy |
| `--fs-lg` | `1.05rem` | ~20px | Cormorant names, large inline data |
| `--fs-xl` | `1.3rem` | ~24.7px | Cormorant modal titles |

### Letter-spacing

Cinzel all-caps elements lean heavily on generous tracking:

| Token | Value | Used for |
|---|---|---|
| `--ls-tight` | `.12em` | Dense Cinzel (code pills, pagination) |
| `--ls-wide` | `.16em` | Eyebrows, tabs, filters |
| `--ls-wider` | `.2em` | Page/section titles |

### Typefaces

Imported from Google Fonts (same set as the guest site):

- **Cormorant Garamond** (serif, italic variants) — names, modal titles,
  stat numbers. The sense of "wedding" lives here.
- **Cinzel** (serif, all-caps) — eyebrows, buttons, tabs, labels.
- **Jost** (sans, light 300 / 400) — body copy, form inputs, muted text.

### Spacing / sizing

There's **no explicit spacing scale** in tokens. Values are hand-picked rems
per rule (`.35rem`, `.7rem`, `.9rem`, `1rem`, `1.2rem`, `1.5rem`, `1.7rem`,
`2rem`). Inconsistency is a known weak point — see Open Questions.

Notable fixed pixels (not scaled by body font):

- Buttons: `40px` min-height, `10px 20px` padding.
- Status dots: `12px` diameter.
- Modals: `640px` max-width on desktop.
- Admin nav + sticky tab bar: `51px` nav + ~48px tab bar on desktop, `40px`
  nav on mobile.

---

## 2. Button system — unified

All `.btn*` variants share **one rectangle**: `12px` Cinzel uppercase, `10px
20px` padding, `40px` min-height, `.15em` letter-spacing. Fixed-px so a body
font-size bump doesn't inflate buttons.

Variants differ only in color:

| Class | Background | Text | Border | Use |
|---|---|---|---|---|
| `.btn-primary` | `--wine` | `--gold-lt` | none | Primary CTA (Save, Send) |
| `.btn-secondary` | transparent | `--wine` | `1px --border` | Default action (Copy, View) |
| `.btn-ghost` | transparent | `--muted` | none | Low-priority (Skip, Cancel) |
| `.btn-danger` | `--red` | `#fde` | none | Destructive (Logout) |
| `.btn-danger-ghost` | transparent | `--red` | `1px rgba(139,32,32,.25)` | Destructive secondary (Delete) |
| `.btn-sm` | — | — | — | **Historical alias**, identical to `.btn` |
| `.btn-icon` | — | — | — | 40×40 square, icon-only |

Hover transitions: `all .22s` → invert fill/text for primary, tint to blush
for secondary, wine text for ghost.

**Not considered buttons** (different visual language, not unified):

- `.admin-tab` — sticky tab nav (`--fs-sm`, wine-d bg, gold underline active)
- `.view-btn` — view switchers on Guests/RSVPs (44px min-height, cream bg,
  wine active)
- `.event-filter-btn`, `.page-btn`, `.msg-mode-btn` — segmented controls

---

## 3. Status system — traffic light

The admin uses **three colored states** repeatedly:

| State | Dot color | Token | Meaning |
|---|---|---|---|
| Invite not sent | 🔴 | `--red` | `invite_sent_at` is blank |
| Awaiting RSVP | 🟠 | `--gold` | Invite sent, RSVP not submitted |
| RSVP'd | 🟢 | `--green` | Submission in `RSVPs_by_family` |

Surfaced via two sibling classes:

- `.guest-status-dot` — 12×12 circle with a subtle 2px light ring
  (`box-shadow: 0 0 0 2px rgba(0,0,0,.04)`). Used in every row that shows a
  guest (Guests list, Messages list, RSVP Status view, By-Event view).
- `.guest-status-legend` — flex row of dot+label pairs, shown above any
  table/list that uses the dot so the color code is always explained nearby.

A JS helper `guestStatus(g) → 'not-sent' | 'pending' | 'rsvp'` is the single
source of truth; `guestStatusDot(g)` returns the HTML span.

### Session tags (conceptually separate)

The Messages tab adds *per-session* chips that aren't about RSVP state —
they're about the admin's workflow:

| Class | Meaning |
|---|---|
| `.msg-tag--next` | "Up next" — the guest that **Send next** will open |
| `.msg-tag--skipped` | The admin chose to skip this one in the current session |
| `.msg-tag--sent` | Invite was sent recently (shows date, e.g. "Sent 20 Apr") |

The dot carries invite/RSVP state; the tag carries session state. They are
intentionally decoupled — a green dot guest can still be "Up next" for a
chase message, for example.

### RSVP-response pills

Used on the RSVPs tab's Submissions and Matrix views:

| Class | Meaning |
|---|---|
| `.rsvp-evt-pill--yes` | green tint — attending (with guest count suffix) |
| `.rsvp-evt-pill--no` | red tint — declined |
| `.rsvp-evt-pill--tbc` | gold tint — TBC |

Pill structure: `<span class="rsvp-evt-pill rsvp-evt-pill--yes"><span
class="rsvp-evt-pill__icon">🎶</span> Yes · 6</span>`. Legend above the list
shows Yes / TBC / No chips so the color map carries.

---

## 5. Layout patterns

### 5.1 App chrome (top of every page)

```
┌─────────────────────────────────────────────────┐ ink bg, sticky top:0
│ ✦ WEDDING ADMIN                   [ LOGOUT ]    │
├─────────────────────────────────────────────────┤ wine-d bg, sticky top:51
│ 👥 GUESTS  ✉ MESSAGES  📋 RSVPS  ⚙ SETTINGS  📤 CSV │
└─────────────────────────────────────────────────┘
```

- `.admin-nav` — sticky `top:0`, z-index 60. Dark ink background, gold Cinzel
  nav title, inline logout (danger button).
- `.admin-tabs` — sticky `top:51px` on desktop / `40px` on mobile, z-index 55.
  Wine-d background with overflow-x:auto so tab labels scroll horizontally on
  narrow screens. Active tab: `--gold-lt` text + 3px gold bottom border.
  Soft shadow below bar to float over scrolling content.

Mobile note: the `svh` unit + a 40px nav/tab offset keep the tab bar anchored
even when the iOS URL chrome collapses.

### 5.2 Panel & card

Each tab renders into `.admin-panel` (max-width 1100px, `2rem 1.5rem` padding,
centered). Content inside lives in `.admin-card` blocks:

- White surface, hairline `rgba(0,0,0,.07)` border, `1.7rem` padding, `2px`
  radius.
- `.admin-card-title` — Cinzel `--fs-sm` wine all-caps, with a flex:1 gold
  pseudo-rule trailing it (`::after{content:'';flex:1;height:1px;background:rgba(184,146,74,.17)}`)
  so every section reads as `TITLE ───────`.

Stats row: `.stats-row` is a flex-wrap of `.stat-card` cells (Cormorant
`2rem` number + Cinzel eyebrow label). Used on Dashboard/Overview.

### 5.3 Data rows — unified `.invite-row` pattern

A CSS-grid row used across Messages and the RSVPs Submissions view. Two
logical columns: identity on the left, controls on the right.

```
.invite-row{
  display:grid;
  grid-template-columns:1fr auto;
  column-gap:1rem; row-gap:.45rem;
  padding:.65rem .35rem;
  border-bottom:1px solid rgba(0,0,0,.05);
}
```

- Below 780px the controls drop to a full-width row under the identity.
- Modifier classes: `.invite-row--next` (gold tint), `.invite-row--skipped`
  (55% opacity), `.invite-row--flash` (1.4s green flash when Send-next fires).

### 5.4 Guest list table — 3-col desktop, 2-col mobile card

Desktop (`>640px`): a proper `<table class="guest-table guest-list-table">`
with three cells:

1. Identity: status dot + Cormorant `--fs-lg` name + overseas badge /
   relationship line / code pill.
2. Contact & Events: phone (Jost md) + inline event icons.
3. Actions: `.guest-actions-col` — three buttons **stacked vertically**
   (View, Edit, Delete), stretch-aligned, `120px` min-width.

Mobile (`<=640px, >360px`): the table rows become CSS-grid cards —
`tbody/tr` become block, `thead` hidden, each `tr` a 2-col grid:

```
[dot] Shanah Shah         +254748502536
      Groom's Family       🎶 🎩 🥂 🪔 🌿
      [B5RHWZ]

[👁 VIEW] [✎ EDIT] [✕ DELETE]         ← row 2, full width, flex:1 each
```

Very-narrow fallback (`<=360px`): single-column stack.

Rationale: 3 stacked 40px buttons would have forced the actions column wide
enough to overflow on narrow phones; stacking the row + making actions
horizontal solves it without shrinking the button size.

### 5.5 Modals

`.modal-overlay` — fixed fullscreen dim `rgba(42,31,26,.7)`, flexbox
center, `1.5rem` padding. `.modal` — white card, `640px` max-width, scrolls
internally (`overflow-y:auto`) up to `88svh`. `.modal-header` sticky at top,
`.modal-footer` sticky at bottom with `safe-area-inset-bottom` padding.

Header uses a Cormorant italic `--fs-xl` title. Body `1.5rem` padding. Footer
flex-end, gap `.6rem`; on mobile footer buttons get `flex:1` to fill width.

### 5.6 View-Guest detail layout (inside a modal)

```
┌─ hero ────────────────────────────────┐
│ [ B5RHWZ ]  🌐 Overseas               │
└───────────────────────────────────────┘

Phone         +254748502536  💬
Email         shanays94@gmail.com
Relationship  Groom's Family
Notes         …

ALLOCATIONS ─────────────────────
🎶  Mandvo                     2 guests
🎩  Black Tie                  2 guests
…

┌─ status ──────────────────────────────┐
│ ● Awaiting RSVP                       │
│   Invite sent 20 Apr — no response yet│
└───────────────────────────────────────┘
```

Dedicated classes: `.view-guest-hero`, `.view-guest-meta` (a `<dl>` grid),
`.view-guest-section-title` (Cinzel eyebrow + trailing gold rule),
`.view-guest-alloc-list` / `.view-guest-alloc` (per-event rows with
icon + Cormorant count), `.view-guest-status` (traffic-light block).

---

## 6. Page-by-page

### 6.1 Guests

The primary management view. Contains filters, a view switcher, and the
guest list itself.

**Filter bar** — search input + three selects (Relationship / RSVP status /
Overseas). Jost inputs, `.filter-bar input/select` at `--fs-md`.

**View switcher** (big segmented buttons, `44px` min-height):
- List — the default `.guest-list-table` (see Layout §5.4).
- Cards — grouped by invitation code, each group card shows a wine-gold
  header with event chips and the guests within. Uses `.event-chip` pills
  (`.2rem .55rem` padding, wine/8% background, Jost `--fs-2xs`).
- RSVP Status — two `.admin-card`s side by side titled "Submitted" and
  "Pending", each listing guests with a status dot, name (`--fs-lg`), and
  relationship · code-pill meta. Below those, a "Duplicate Submissions"
  section flags codes with >1 submission.
- By Event — per-event stat strip (Invitations / Guests Invited / Guests
  Confirmed / Pending / Declined) + an event filter bar + a focused guest
  table for the selected event. Columns are just Name (with dot + rel sub)
  and Guests count (big Cormorant 1.6rem number); the RSVP column was
  intentionally removed in favour of the dot.

**Pagination** bar appears below the default List view.

### 6.2 Messages

Single `.admin-card` titled **Messages** with a mode toggle at top:

```
[ ✉ Initial Invite ][ 🔒 Chase-Up ]     ← .msg-mode-switcher
```

Below the toggle: relationship filter + sent filter (sent filter hidden in
chase mode), legend, progress card, then the row list.

**Progress card** (`.invite-progress-card`):

```
INVITE · GROOM'S FAMILY                     [▶ Send next] [↻ Reset session]
8 sent · 2 skipped · 12 remaining
████░░░░░░░░░░░░░░░░░░░░░░  33%
Up next: Shanah Shah · Groom's Family
```

- Gold-pale background, Cinzel title, Jost subline.
- Progress bar: `6px` gold-tinted track, green fill, smooth width transition.
- Two CTAs right-aligned (primary send-next; ghost reset appears only when
  there are skips).

**Rows** — see Layout §5.3 + Status §3. Each row: dot + name + session tag +
code-pill headline, single muted meta line (relationship · phone), and a
controls row with a per-guest template `<select>`, Copy, Send (primary) +
Skip (ghost). In invite mode, already-sent guests get Resend + an × clear
button.

Per-relationship skip list is persisted in `localStorage` under
`weddingAdmin:msgSkip:{mode}:{rel}` so two admins splitting the work resume
independently.

### 6.3 RSVPs

A larger page focused on responses.

**Filter bar** — search + event filter + response filter + relationship
filter + sort.

**View switcher + utilities**: Submissions / By Event / Matrix, plus a
"Clear filters" and "Export CSV" pair pushed to the right.

**Event breakdown** — a `.rsvp-breakdown` grid of `.event-rsvp-card`s, one
per event. Each card: icon + name header, then three Cormorant stat columns
(Yes / No / Guests count).

**View container** header combines a Cinzel title + a legend of Yes/TBC/No
pills.

**Submissions view** — `.invite-row` grid. Identity: name, relationship,
code pill, submission timestamp. Controls area holds `.rsvp-evt-pills`
wrapping with per-event response pills.

**By Event view** — per-event `.admin-card` with a Cormorant `--fs-xl`
event title, then Cinzel `--fs-2xs` eyebrow sections for Attending /
Declined, each listing guest name + guest count.

**Matrix view** — a sparse `.guest-table`: guest name (Cormorant `--fs-lg`)
+ code pill on the left, one cell per event with a Yes/No pill or an em-dash
for unanswered, Total guests on the right.

### 6.4 Settings

Stack of `.admin-card`s:

- **Events Configuration** — read-only grid listing events from the sheet
  (ID / Name / Icon / Date / Venue / Active / Seating).
- **Instructions** — prose card explaining event IDs, codes, allocations,
  CSV.
- **Message Settings** — server-persisted deadlines + RSVP URL.
- **Message Templates** — CRUD list of templates with `{{name}}`, `{{code}}`,
  `{{url}}`, `{{deadline}}` variables.
- **Relationship Defaults** — map each relationship to a default template.
- **Generate Invitation Code** — utility block: one-shot "Generate" button
  that rotates a candidate code for pasting onto physical invites.

### 6.5 CSV Upload

- **Download template** button (admin-secondary) streams a CSV with columns
  named from event names (e.g. "Mandvo Guests", "Wedding Table").
- **Drop zone** (`.csv-drop-zone`) for picking a file.
- **Preview table** (`.csv-preview-table`) shows the first 10 rows post-parse.
- **Apply relationship** selector above "Upload guests" lets the admin
  override the CSV's relationship column for the whole batch.
- **Upload** triggers `bulkAddGuests`. Results card below (success/error).

---

## 7. Responsive breakpoints

```css
@media (max-width: 700px)  { /* phones + small tablets */ }
@media (max-width: 640px)  { /* stacked guest-list card */ }
@media (max-width: 400px)  { /* micro tweaks */ }
@media (max-width: 360px)  { /* single-col fallback on the guest list */ }
@media (min-width: 780px)  { /* inline message-row layout */ }
```

Inputs on mobile are forced to `16px` to suppress iOS zoom. Modal height uses
both `vh` and `svh` (`svh` fallback for iOS URL-bar behaviour). Safe-area
padding on the mobile modal-footer prevents the home indicator from hiding
Save/Cancel.

---

## 8. Known tradeoffs and pain points

Things that work OK but a designer might want to revisit:

1. **Spacing is ad-hoc.** No `--sp-*` scale. Rules pick rem values individually,
   leading to minor inconsistencies (`.35rem` vs `.4rem` vs `.55rem` gaps). A
   designer-led scale (`4/8/12/16/24/32`) could clean this up without
   touching colors or type.

2. **Two competing vertical rhythms.** Cinzel all-caps with heavy letter-
   spacing reads as "eyebrow", but some card titles use `--fs-sm` (15px)
   while others still use `--fs-2xs` (12px) depending on context. The scale
   works; its application isn't strictly codified.

3. **Cormorant sizes are inline-picked.** Stat numbers (`2rem`), ersvp-num
   (`1.55rem`), event-guest-count (`1.6rem`), section modal titles
   (`--fs-xl` ≈ 1.3rem). They're roughly a scale but not tokenised. A single
   `--display-*` scale would tidy this.

4. **Three different "segmented" controls** that look superficially similar
   but are styled individually: `.admin-tab`, `.view-btn`, `.msg-mode-btn`,
   `.event-filter-btn`. Could consolidate into one segmented-control
   component with modifier classes.

5. **Icon-text coupling via emoji.** Every action label uses an emoji
   (`👁 VIEW`, `✎ EDIT`, `✕ DELETE`, `💬 SEND`). Looks fine, but means the
   "icon system" is whatever the OS renders. A designed icon set (SVG with
   currentColor) would improve legibility and brand consistency — especially
   the `💬` on the wine Send button, which renders colored and breaks the
   monochrome button.

6. **The guest-site and admin share tokens but diverge on feel.** The guest
   site (`index.html`) leans richer (ornate date formatting, falling petals,
   ornament rules everywhere). The admin is more utilitarian. There's no
   style guide forcing that divergence — it's just how it evolved. Worth
   deciding whether admin should echo the guest-site tone more (warmer
   backgrounds, more flourish) or lean fully utilitarian.

7. **Traffic light is strong; event response pills look similar but live
   in a different namespace.** `.rsvp-evt-pill--yes/no/tbc` and
   `.guest-status-dot--green/orange/red` map to the same colors but can't be
   unified because one is a pill shape, the other a circle. Could formalise
   a shared color-state primitive.

8. **Modal hero vs sticky title duplication (fixed).** The earlier View-
   Guest modal duplicated the guest name between the sticky modal title and
   a body hero. Resolved by keeping the name only in the sticky title. Worth
   calling out as a pattern to avoid going forward.

9. **Dense pages still feel dense.** Even after the typography scale-up,
   RSVPs + Guests lists render a lot of rows on a single card. A designer
   might propose "chip rows" or group headers to break the monotony.

---

## 9. Open questions for the reviewer

Specific things a designer is asked to critique:

- **Is the palette right?** Wine/gold/blush is opinionated. Is it readable
  enough for a data-heavy admin UI, or is the wine-on-cream too warm to hold
  up long sessions?
- **Is Cinzel doing too much work?** Buttons, tabs, titles, eyebrows, badges
  are all Cinzel with varying letter-spacing. Would a sans-serif for UI
  chrome and reserving Cinzel for section titles read cleaner?
- **Card stacking vs denser views.** The admin favors cards with breathing
  room; a denser table-first layout might serve power users (who know every
  guest) better. Should we offer both?
- **Status dot vs status pill.** The dot is compact and consistent, but on
  some rows (especially RSVP Status view and "Pending" cards) a bigger
  status label might be friendlier for less-technical admins.
- **Action buttons labels vs icon-only.** Current: 40px-tall "👁 VIEW /
  ✎ EDIT / ✕ DELETE" even on mobile. Is this overkill, or does the text
  actually help?
- **First-run empty states.** None of the empty-state copy is illustrated
  — just italic muted text. Worth designing?

---

## 10. Reference files

Everything the reviewer may need is reachable from the admin in isolation:

| File | What it is |
|---|---|
| `admin.html` | The entire admin — CSS, HTML, JS all in one file. ~3,000 lines. |
| `index.html` | Guest-facing site for tone reference (the "wedding feel"). |
| `design/preview.html` | Self-contained snapshot of the guest site with backend stubbed out. |
| `design/admin-design-system.md` | This document. |
| `appsscript/Code.gs` | Backend reference only; no design implications. |

The admin CSS sits in the first ~380 lines of `admin.html` — that's the
best place to read actual rules once specific classes have been identified
from this doc.

---

## 11. Change log for this document

- **Stage 1** — tokens, typefaces, breakpoints.
- **Stage 2** — button system, traffic-light status system, session tags,
  RSVP response pills.
- **Stage 3** — layout patterns (chrome, panel/card, invite-row grid, guest
  list 3→2→1 col transitions, modal + view-guest layout).
- **Stage 4** — per-tab walkthrough (Guests, Messages, RSVPs, Settings, CSV).
- **Stage 5** — known tradeoffs, open questions for reviewers, file refs.
