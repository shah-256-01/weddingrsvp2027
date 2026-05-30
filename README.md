# Wedding RSVP 2027

Guest RSVP site on GitHub Pages. Backend: Google Sheets + Apps Script.

## Architecture

```
Guest Site (index.html)  ←→  Google Apps Script (Web App)  ←→  Google Sheet
                                      ↑
                              Admin Panel (admin.html)
                              served by Apps Script HTML Service
```

- **`index.html`** — Guest-facing RSVP site, hosted on GitHub Pages
- **`appsscript/Code.gs`** — Google Apps Script backend (all server logic)
- **`appsscript/admin.html`** — Admin panel served by Apps Script
- **Google Sheet** — Data store with 4 tabs: Events, Guests, RSVPs_by_family, RSVPs_by_event

## Setup

1. Go to [script.google.com](https://script.google.com) → **New project** → rename to **Wedding RSVP 2027**
2. Paste `appsscript/Code.gs` into the editor
3. Click **+** → **HTML** → name it `admin` → paste `appsscript/admin.html`
4. Verify `SHEET_ID` in Code.gs is `1vMYAD7IvF3sz-10oRRkeqg2R-xHrVhwQ5d__Vo53fEc`
5. Change `ADMIN_PIN` in Code.gs to your chosen PIN (default: `2027`)
6. Select `setupSheet` from the function dropdown → click **Run** → authorise when prompted
7. Verify 4 tabs appear in the Google Sheet: Events, Guests, RSVPs_by_family, RSVPs_by_event
8. Update event dates/venues directly in the **Events** tab
9. **Deploy** → **New deployment** → **Web App** → Execute as: Me, Who has access: Anyone → Deploy
10. Copy the Web App URL and replace `YOUR_APPS_SCRIPT_URL` in `index.html`
11. Push to GitHub → enable Pages (Settings → Pages → Source: main branch)

Admin panel: `YOUR_WEB_APP_URL?page=admin`

## Managing Guests

- Use admin panel → **CSV Upload** tab for bulk guest import, or click **Download Template** to get a pre-formatted file
- Or add rows directly to the **Guests** tab in the sheet

### CSV Upload Format

Fixed columns (must appear in this order):

```
first_name, last_name, phone, email, relationship, is_overseas, notes, events, invitation_code
```

Followed by one `{Event Name} Guests` column and one `{Event Name} Table` column per event:

```
Lagnotri Guests, Mehendi & Sangeet Guests, Mandvo Guests, Meet & Greet Guests, Wedding Guests, Black Tie Guests,
Lagnotri Table, Mehendi & Sangeet Table, Mandvo Table, Meet & Greet Table, Wedding Table, Black Tie Table
```

Example row:
```
Priya,Sharma,+254700000000,priya@email.com,Bride's Family,FALSE,Vegetarian,"MS,We,BT",,0,2,0,0,2,2,,,,,,
```

- `is_overseas` — `TRUE` or `FALSE` (overseas badge shown in admin and RSVP UI)
- `events` — comma-separated event IDs (e.g. `MS,We,BT`); auto-derived from whichever `Guests` columns are > 0
- `invitation_code` — leave blank to auto-generate; or supply a 6-char code (from `23456789ABCDEFGHJKMNPQRSTUVWXYZ`)
- `{Event Name} Guests` — max guest count for that event; 0 means not invited
- `{Event Name} Table` — optional table assignment (leave blank if not needed)

A ready-to-use template file is included at `guest-import-template.csv`.

## Updating Events

Edit the **Events** tab directly in the Google Sheet. Set `active` to `FALSE` to hide an event. Changes are live immediately — no code change needed.

| Column | Example |
|--------|---------|
| id | L |
| name | Lagnotri |
| date | TBC |
| time | TBC |
| venue | TBC |
| icon | 🪔 |
| active | TRUE |

## Events

| ID | Name | Icon |
|----|------|------|
| L | Lagnotri | 🪔 |
| S | Mehendi & Sangeet | 🌿 |
| A | Mandvo | 🎶 |
| G | Meet & Greet | 🥂 |
| W | Wedding | 💍 |
| B | Black Tie | 🎩 |

## Valid Invitation Codes

All 63 non-empty subsets of `L, S, A, G, W, B` + `2027`.

Examples: `L2027`, `LW2027`, `LSAGWB2027`, `WB2027`, `SAG2027`

## Guest Validation

Guests enter their **first name**, **last name**, and **invitation code** on the landing page. The backend validates the combination against the Guests sheet. Invalid entries show an error message.

## Handling Duplicate RSVPs

If a guest submits the RSVP form more than once, duplicates are flagged in the admin panel under the **RSVPs** tab.

## Redeployment

Any time you change `Code.gs` or `admin.html` in the Apps Script editor:

1. **Deploy** → **Manage deployments** → **Edit** (pencil icon)
2. Set **Version** to **New version**
3. Click **Deploy**

The Web App URL stays the same across versions.

## Custom Domain + Cloudflare

- Register your domain and add it to Cloudflare
- In GitHub repo Settings → Pages → Custom domain, enter your domain
- In Cloudflare DNS, add a CNAME record pointing to `yourusername.github.io`
- Set Cloudflare SSL to **Full (strict)**
- Enable **Always Use HTTPS** in Cloudflare SSL/TLS settings
