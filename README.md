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

- Use admin panel → **CSV Upload** tab for bulk guest import
- Or add rows directly to the **Guests** tab in the sheet
- Invitation codes = event IDs joined + `2027` (e.g. `LSW2027`)

### CSV Upload Format

```
first_name, last_name, phone, email, relationship, notes, events, L_adults, L_children, S_adults, S_children, A_adults, A_children, G_adults, G_children, W_adults, W_children, B_adults, B_children
```

Example:
```
Priya, Sharma, +91 98765 43210, priya@email.com, Bride's Family, VIP guest, "L,S,W", 2, 1, 2, 1, 0, 0, 0, 0, 3, 1, 0, 0
```

- `events` column — comma-separated event IDs (e.g. `L,S,W`)
- `invitation_code` is auto-generated from the events column
- Allocation columns — max adults/children for each event (0 = not invited)

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
