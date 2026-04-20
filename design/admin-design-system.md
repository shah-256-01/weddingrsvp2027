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

## 2. Responsive breakpoints

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
