# Invitation images

Per-event invitation artwork. Each image is shown at the top of that event's
card on the guest RSVP page, and again on the "already submitted" screen.
File names are referenced from `index.html` via the `INVITE_IMAGES` map
(search for that const).

Any event whose file isn't uploaded yet just shows the normal text card, so
you can add these one at a time — nothing breaks in the meantime.

## Expected files

| Event ID | Event              | File(s)                                                                  |
| :------: | ------------------ | ------------------------------------------------------------------------ |
| **Lg**   | Lagnotri           | `lagnotri-brides.jpg` **and** `lagnotri-grooms.jpg` (one per side)       |
| **MS**   | Mehendi & Sangeet  | `mehndi-sangeet.jpg`                                                     |
| **Ma**   | Mandvo             | `mandvo-brides.jpg` **and** `mandvo-grooms.jpg` (one per side)           |
| **Lu**   | Luncheon           | `luncheon.jpg` (bride's side only)                                       |
| **MG**   | Meet & Greet       | `meet-greet.jpg`                                                         |
| **We**   | Wedding            | `wedding-day.jpg` ✅ uploaded                                            |
| **BT**   | Black Tie          | `black-tie.jpg` ✅ uploaded                                              |

Optional welcome image shown once above all the event cards:
`welcome-brides.jpg` and `welcome-grooms.jpg`.

**Side-specific images** (Lagnotri, Mandvo, welcome): the guest sees the
bride's-side or groom's-side version based on their *relationship*. If only
one side's file exists, guests from the other side get the text card for
that event.

## Format

- **JPG preferred** for illustrative artwork (smaller file size than PNG).
- **Vertical aspect ratio** (roughly 9:16 or 4:5) matches the way the
  cards stack on mobile.
- **Width 1080–1200 px.** Bigger just wastes guests' mobile data; smaller
  may look soft on high-DPI phones. Aim for under ~500 KB each.
- File names are **case-sensitive** and must match the table exactly.

## How to add or replace

Two options:

1. **GitHub web UI** (easiest): open
   `https://github.com/shah-256-01/weddingrsvp2027/tree/main/invitations`,
   click **Add file → Upload files**, drag the image in, commit.
2. **Git**: drop the file at `invitations/<name>.jpg`, commit, push.

GitHub Pages serves it at `https://jainishanay.com/invitations/<name>.jpg`
within a minute or two. No Apps Script redeploy is needed.

## Changing which file an event uses

Edit `INVITE_IMAGES` in `index.html`. Keys must be the event IDs from the
Events sheet (`Lg`, `MS`, `Ma`, `Lu`, `MG`, `We`, `BT`):

```js
const INVITE_IMAGES = {
  Lg: { brides: 'invitations/lagnotri-brides.jpg', grooms: 'invitations/lagnotri-grooms.jpg' },
  MS: 'invitations/mehndi-sangeet.jpg',
  // …
};
```

A plain string means the same image for everyone; `{ brides, grooms }` means
one per side.
