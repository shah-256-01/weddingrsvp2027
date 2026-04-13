# Deployment Guide — Wedding RSVP Apps Script

## Prerequisites

- The Google Sheet already exists with ID: `1vMYAD7IvF3sz-10oRRkeqg2R-xHrVhwQ5d__Vo53fEc`
- You need edit access to this Google Sheet

## Steps

### 1. Create the Apps Script project

Go to [script.google.com](https://script.google.com) → **New project** → rename to **Wedding RSVP 2027**.

### 2. Add Code.gs

In the editor, replace the contents of `Code.gs` with the full contents of `appsscript/Code.gs` from this repository.

### 3. Create admin.html

Click **+** (next to Files) → **HTML** → name it `admin` (not `admin.html`, just `admin`). Paste the full contents of `appsscript/admin.html` from this repository.

### 4. Verify Sheet ID

In `Code.gs`, confirm the `SHEET_ID` constant is set to:

```
1vMYAD7IvF3sz-10oRRkeqg2R-xHrVhwQ5d__Vo53fEc
```

### 5. Set your admin PIN

Change the `ADMIN_PIN` value in `Code.gs` to your chosen PIN (default is `2027`).

### 6. Run setupSheet()

In the Apps Script editor, select `setupSheet` from the function dropdown and click **Run**. Authorise when prompted. Verify that four tabs appear in the Google Sheet:

- **Events** — with seed data (M, S, C, W)
- **Guests** — with column headers
- **RSVPs_by_family** — empty (headers built on first submission)
- **RSVPs_by_event** — with column headers

### 7. Deploy as Web App

Click **Deploy** → **New deployment** → choose **Web App**:

- **Execute as:** Me
- **Who has access:** Anyone

Click **Deploy** and copy the Web App URL.

### 8. Configure the guest site

Paste the Web App URL into `index.html` as the `SCRIPT_URL` value:

```javascript
const SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

### 9. Access the admin panel

Your admin panel is available at:

```
YOUR_WEB_APP_URL?page=admin
```

Log in with the PIN you set in step 5.

### 10. Update SITE_URL after deployment

After pushing to GitHub Pages and enabling Pages:

1. Open the admin panel
2. Go to **Settings** tab
3. Enter your GitHub Pages URL (e.g. `https://yourusername.github.io/weddingrsvp2027`)
4. Click **Save**

This URL is used to generate invite links for guests.

---

## Redeployment

**Important:** Any time you change `Code.gs` or `admin.html`, you must redeploy:

1. **Deploy** → **Manage deployments** → **Edit** (pencil icon)
2. Set **Version** to **New version**
3. Click **Deploy**

Never edit an existing deployment version — always create a new one. The Web App URL stays the same.
