# Wedding RSVP 2027

A wedding RSVP website with a guest-facing site on GitHub Pages and a Google Sheets backend via Google Apps Script.

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

## Quick Start

1. Follow the step-by-step instructions in [`appsscript/setup.md`](appsscript/setup.md)
2. Push this repo to GitHub and enable GitHub Pages (Settings → Pages → Source: main branch)
3. Update `SCRIPT_URL` in `index.html` with your Apps Script Web App URL
4. Update the Site URL in the admin panel Settings tab

## How to Update Events

Edit the **Events** tab directly in the Google Sheet. Changes are live immediately — no code change or redeployment needed.

| Column | Example |
|--------|---------|
| id | M |
| name | Mehendi & Haldi |
| date | Friday 24th December 2027 |
| time | 10:00 AM – 2:00 PM |
| venue | Host Family Residence, Kochi |
| icon | 🌿 |
| active | TRUE |

Set `active` to `FALSE` to hide an event from the guest site.

## How to Manage Guests

Open the admin panel at `YOUR_WEB_APP_URL?page=admin`. From there you can:

- Add, edit, and delete guests
- Assign guests to events (generates invitation codes automatically)
- Copy invite links to share with guests
- View RSVP status across three views: List, By Code, and RSVP Status

## Handling Duplicate RSVPs

If a guest submits the RSVP form more than once (same invitation code), duplicates are flagged in the admin panel:

1. Go to **Guest List** tab → **✓ RSVP Status** view
2. Scroll to the **Duplicate Submissions** section at the bottom
3. Review each duplicate and resolve manually in the Google Sheet

## Valid Invitation Codes

All codes are formed from event ID subsets + `2027`. With 4 events (M, S, C, W), there are 15 valid codes:

| Code | Events |
|------|--------|
| M2027 | Mehendi & Haldi |
| S2027 | Sangeet Night |
| C2027 | Cocktail Evening |
| W2027 | The Wedding Day |
| MS2027 | Mehendi, Sangeet |
| MC2027 | Mehendi, Cocktail |
| MW2027 | Mehendi, Wedding |
| SC2027 | Sangeet, Cocktail |
| SW2027 | Sangeet, Wedding |
| CW2027 | Cocktail, Wedding |
| MSC2027 | Mehendi, Sangeet, Cocktail |
| MSW2027 | Mehendi, Sangeet, Wedding |
| MCW2027 | Mehendi, Cocktail, Wedding |
| SCW2027 | Sangeet, Cocktail, Wedding |
| MSCW2027 | All four events |

## Custom Domain + Cloudflare

- Register your domain and add it to Cloudflare
- In GitHub repo Settings → Pages → Custom domain, enter your domain
- In Cloudflare DNS, add a CNAME record pointing to `yourusername.github.io`
- Set Cloudflare SSL to **Full (strict)**
- Enable **Always Use HTTPS** in Cloudflare SSL/TLS settings

## Redeployment Reminder

Any time you change `Code.gs` or `admin.html` in the Apps Script editor, always redeploy as a **New version**:

Deploy → Manage deployments → Edit → Version: New version → Deploy

The Web App URL stays the same across versions.
