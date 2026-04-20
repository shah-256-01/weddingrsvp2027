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

## 5. Responsive breakpoints

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
