# Invitation images

Custom per-event invitation artwork, shown on the returning-guest screen
(after a guest submits their RSVP). File names are referenced from
`index.html` via the `INVITE_IMAGES` map.

## Expected files

| Event ID | Name               | Expected file                     |
| :------: | ------------------ | --------------------------------- |
| **L**    | Lagnotri           | `invitations/lagnotri.jpg`        |
| **S**    | Mehndi & Sangeet   | `invitations/mehndi-sangeet.jpg`  |
| **A**    | Mandvo             | `invitations/mandvo.jpg`          |
| **G**    | Meet & Greet       | `invitations/meet-greet.jpg`      |
| **W**    | Wedding Day        | `invitations/wedding-day.jpg`     |
| **B**    | Black Tie          | `invitations/black-tie.jpg`       |

Only the entries listed in `INVITE_IMAGES` inside `index.html` (search
for that const) are rendered as image cards. Events without an entry
fall back to the auto-generated text card built from the Events sheet.

## Format

- **JPG preferred** for illustrative artwork (smaller file size than PNG).
- **Vertical aspect ratio** (roughly 9:16 or 4:5) matches the way the
  cards stack on mobile.
- **Recommended width 1080–1200 px** — anything bigger just wastes
  bandwidth. Anything smaller may look soft on high-DPI phones.

## How to add or replace

Two options:

1. **Git**: drop the file at the expected path, `git add`, commit, push.
2. **GitHub web UI**: open
   `https://github.com/shah-256-01/weddingrsvp2027/tree/main/invitations`,
   click **Add file → Upload files**, drag the image in, commit.

GitHub Pages will serve the file at
`https://jainishanay.com/invitations/<name>.jpg` within a minute or two.

## Adding support for a new event

Edit `INVITE_IMAGES` in `index.html` and add one line, e.g.:

```js
const INVITE_IMAGES = {
  L: 'invitations/lagnotri.jpg',   // new
  S: 'invitations/mehndi-sangeet.jpg',
  W: 'invitations/wedding-day.jpg',
  B: 'invitations/black-tie.jpg',
};
```

Commit and push — that's it.
