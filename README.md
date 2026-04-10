# CryptoClassroom — Next.js Web App

A polished web frontend for your Google Sheets crypto trading simulator.
Students log in with their school Google accounts and get a real wallet UI
instead of staring at a spreadsheet.

**Your Apps Script keeps running exactly as-is.** This app just reads and
writes to the same Google Sheet — it's a better window into data that's
already there.

---

## Cost: $0 Forever

| Service | What it does | Free limit |
|---|---|---|
| Vercel | Hosts the web app | Unlimited for this scale |
| Google Sheets API | Reads/writes your sheet | 300 reads/min — plenty |
| Google OAuth | Student login | Free |
| NextAuth | Session management | Free, open source |

---

## Setup (one time, ~30 minutes)

### Step 1 — Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click "New Project" → name it `cryptoclass`
3. Enable these APIs:
   - **Google Sheets API**
   - **Google Drive API** (needed for service account)

### Step 2 — Service Account (for reading/writing the sheet)

1. Go to **IAM & Admin → Service Accounts → Create Service Account**
2. Name: `cryptoclass-reader`
3. Download the JSON key file
4. From the JSON, copy:
   - `client_email` → your `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key`  → your `GOOGLE_PRIVATE_KEY`
5. **Share your Google Sheet** with the service account email
   (same as sharing with a person — give it Editor access)

### Step 3 — OAuth credentials (for student Google login)

1. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0**
2. Application type: **Web application**
3. Add Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (for local dev)
   - `https://your-app.vercel.app/api/auth/callback/google` (for production)
4. Copy the Client ID and Client Secret

### Step 4 — Environment variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
# Then edit .env.local with your real values
```

Key notes:
- `GOOGLE_PRIVATE_KEY` — copy the ENTIRE key including `-----BEGIN...-----END-----`
- `NEXTAUTH_URL` — use `http://localhost:3000` locally, your Vercel URL in production
- `TEACHER_EMAIL` — your school email — you'll see the Teacher Dashboard tab

### Step 5 — Run locally

```bash
npm install
npm run dev
# Open http://localhost:3000
```

### Step 6 — Deploy to Vercel (free)

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → Import project
3. Add all `.env.local` variables in Vercel's Environment Variables dashboard
4. Deploy — Vercel gives you a free URL like `cryptoclass.vercel.app`
5. Update `NEXTAUTH_URL` to your Vercel URL
6. Add the Vercel redirect URI to your Google OAuth credentials

---

## File Structure

```
app/
├── page.jsx                    ← Login page
├── layout.jsx                  ← Root layout + auth provider
├── SessionProvider.jsx         ← Client-side session wrapper
├── dashboard/page.jsx          ← Student wallet (Holdings, Allocation, Trade, History)
├── leaderboard/page.jsx        ← Live leaderboard with podium
├── market/page.jsx             ← Price table + sector heatmap
├── teacher/page.jsx            ← Teacher dashboard (market controls, students, news)
└── api/
    ├── auth/[...nextauth]/     ← Google OAuth
    ├── me/                     ← Current user info
    ├── portfolio/              ← GET student portfolio
    ├── prices/                 ← GET coin prices
    ├── leaderboard/            ← GET all students ranked
    ├── trade/                  ← POST execute trade
    │   └── sellall/            ← POST sell all holdings
    └── teacher/                ← Teacher-only actions
        ├── market-status/
        └── [action]/           ← freeze, unfreeze, bull-run, etc.

lib/
├── sheets.js                   ← All Google Sheets read/write logic
└── api-routes-reference.js     ← Copy-paste reference for all API routes
```

---

## How Trade Execution Works

The web app doesn't re-implement your trade logic — it just fills in the
student's trade form and ticks the checkbox, exactly like a student would:

1. Student clicks BUY/SELL in the web app
2. API route writes to `A15:D15` (action, coin, amount type, amount)
3. API route sets `E15 = TRUE`
4. Your existing Apps Script `onEditInstallable` trigger fires
5. `executeTrade()` runs with full teacher permissions
6. Student's portfolio updates in the Sheet

This means all your existing logic (fee calculation, price lookup,
holdings update, leaderboard refresh) runs exactly as before.

---

## Important Notes for the `GOOGLE_PRIVATE_KEY` in Vercel

When pasting the private key into Vercel's dashboard:
- **Do NOT include surrounding quotes**
- The `\n` newlines in the key will be handled by the `replace(/\\n/g, '\n')` in `lib/sheets.js`
- If you get auth errors, try wrapping the key in Vercel as a single line with literal `\n` characters

---

## Students Accessing the App

Just share the Vercel URL with your students. They click "Sign in with Google",
use their `@southfayette.org` account, and land on their personal wallet.

The auth check in `[...nextauth]/route.js` only allows:
- Your teacher email (`TEACHER_EMAIL`)
- Any `@southfayette.org` address

Everyone else gets blocked at the login page.
