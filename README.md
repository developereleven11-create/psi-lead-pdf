# Teardown Studio — Setup Guide

Two pieces that work together:

| | What it does | Where it runs |
|---|---|---|
| **Teardown_Studio_v4.html** | Score panels + 6-page decks + email openers | Your browser (double-click) |
| **GitHub Actions runner** | Tests hundreds of leads overnight | GitHub's servers (laptop can be off) |

You can use the HTML tool alone. The GitHub part exists only so you don't have to babysit 1,180 leads.

---

## Part 1 — Get a free Google API key (3 minutes, once)

1. Open **https://developers.google.com/speed/docs/insights/v5/get-started**
2. Click the blue **"Get a Key"** button
3. Create a project (any name) → click **Enable API**
4. Copy the long key it shows you. Keep it somewhere safe.

Free tier: **25,000 tests per day.** No credit card, no billing.

---

## Part 2 — Use the browser tool (works immediately)

1. Double-click **Teardown_Studio_v4.html** — it opens in Chrome
2. Paste your API key → click **Test key** (should say "Key works")
3. Drag **Tier1_Diamond_PriorityOutreach.csv** onto the drop zone
4. Set **How many** = `5` for your first run, click **Run batch**
5. Watch the table fill in. For each lead you get:
   - **Panel** — Google's real score panel (click to zoom)
   - **Recoverable** — how many seconds of load time you can win back
   - **Copy** — a ready-to-send email opening line, built from their data
   - **Preview** — see the 6-page deck on screen
   - **Deck** — download it as a PDF
   - **PNG** — just the score panel, for pasting into emails

Bottom of the page: **Results CSV**, **All score panels (.zip)**, **All decks (.zip)**.

> ⚠️ **Nothing is saved until you export.** Close the tab and results are gone.
> Export after every batch. The tool tells you which row to start from next time.

---

## Part 3 — Overnight runs on GitHub (no terminal, laptop can be closed)

### 3.1 Create the repository

1. Go to **https://github.com** and sign in (create a free account if needed)
2. Click the **+** in the top-right → **New repository**
3. Name it `teardown-studio`
4. Select **Private**
5. Click **Create repository**

### 3.2 Upload these files

1. On the new repo page, click **uploading an existing file**
2. Drag in the entire contents of this zip *except* `Teardown_Studio_v4.html`:
   - `.github/` folder
   - `scripts/` folder
   - `leads/` folder
   - `results/` folder
3. Scroll down, click **Commit changes**

> If GitHub hides the `.github` folder during drag-and-drop, drag the folders one at a time.

### 3.3 Add your API key as a secret

1. In your repo, click **Settings** (top bar)
2. Left sidebar → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `PSI_API_KEY`
5. Secret: paste your Google API key
6. Click **Add secret**

The key is encrypted. It never appears in logs.

### 3.4 Upload your lead list

1. Click the **leads** folder in your repo
2. **Add file** → **Upload files**
3. Drag in `Tier1_Diamond_PriorityOutreach.csv`
4. **Commit changes**

### 3.5 Run it

1. Click the **Actions** tab
2. If prompted, click **"I understand my workflows, go ahead and enable them"**
3. Left sidebar → **Run PageSpeed Batch**
4. Click **Run workflow** (grey button, right side)
5. Fill in:
   - **csv**: `Tier1_Diamond_PriorityOutreach.csv`
   - **start**: `1`
   - **count**: `150`
6. Click the green **Run workflow**

**Close your laptop.** It runs on GitHub's machines.

### 3.6 Collect the results

Come back in a few hours. In the **Actions** tab, click your run:

- **results/psi_results.csv** is committed straight into your repo — click **results** to see it
- Or scroll to **Artifacts** at the bottom and download `psi-results.zip`

To download the CSV: open `results/psi_results.csv` in the repo → click the **download** icon (top-right of the file view).

### 3.7 Next batch

Run the workflow again with **start** = `151`, **count** = `150`. Repeat.

The runner **skips leads already in the results file**, so re-running is always safe.

---

## What you get in `psi_results.csv`

| Column | Use |
|---|---|
| `Mobile Score` | The number you lead with |
| `Recoverable (s)` | Seconds of load time you can win back — the pitch |
| `Top Fix` | Their single highest-impact fix |
| `Largest Image` / `KB` | Names their actual hero image file |
| `Third Parties` | Their actual heavy scripts, with names |
| `Wedge` | `CWVO Sprint` (score < 60) or `CRO/SEO angle` (already fast) |
| `Email Opener` | Copy-paste first line of your cold email |
| `LHR File` | Raw Google data, for building the deck later |

Sort by `Recoverable (s)` descending. Those are your first calls.

---

## Timing & limits

- Each lead takes ~20–40 seconds (Google runs a real test)
- 150 leads ≈ 1.5–2 hours per workflow run
- GitHub free tier: 2,000 Actions minutes/month on private repos — roughly 1,000 leads/month. Make the repo **public** and it's unlimited (but then your lead list is public — keep it private and split across months, or delete the CSV after each run)
- Google's limit: 25,000/day, 240/minute. The script sleeps 1.5s between leads, nowhere near the ceiling

---

## Recommended workflow

1. **GitHub Actions** → scores for all 1,180 leads, overnight, unattended
2. Download `psi_results.csv`, sort by `Recoverable (s)`
3. **Teardown Studio** → build decks only for the top ~50 you're actually emailing this week
4. Send: score panel PNG in the email body, deck PDF attached, `Email Opener` as your first line

Scores are the slow part. Decks are instant once you have them.

---

## Optional — shareable links via GitHub Pages

Only if you want links instead of attachments. **The PDFs become public** — anyone with the URL can read them, and filenames are guessable. For 1,180 brands that's a real risk. My recommendation: attach the PDF to cold email (links hurt deliverability anyway) and use the **Share** button's Drive flow for LinkedIn DMs and follow-ups.

If you still want it:

1. In your repo: **Settings** → **Pages**
2. Under "Build and deployment" → Source: **Deploy from a branch**
3. Branch: `main`, folder: `/docs` → **Save**
4. Create a `docs` folder: **Add file** → **Create new file** → type `docs/index.html` → put anything in it → **Commit**
5. Upload your PDFs into `docs/` (**Add file** → **Upload files**)

Each PDF is then live at `https://<your-username>.github.io/teardown-studio/TheBlackTux_Speed_Teardown.pdf`

To take one down: delete the file from `docs/` and commit.

---

## Personalising the deck

Page 5 ("About me") pulls from a config block near the top of `Teardown_Studio_v4.html`:

```js
const DECK_CFG={
  photo: YASH_PHOTO,                                  // your headshot, embedded as base64
  linkedin: 'https://www.linkedin.com/in/yashw10/',
  website:  'https://launch.elevenmedia.in/',
};
```

To swap the headshot: convert a square JPEG to base64 (base64.guru or similar) and replace the long `YASH_PHOTO` string.
To change the case-study grid, edit the `cases` array inside `pageFive()`.

---

## Troubleshooting

**"Key failed" in the browser tool** — the key isn't enabled for the PageSpeed Insights API. Redo Part 1, make sure you clicked "Enable API".

**Red banner about the Lighthouse renderer** — your network is blocking `cdn.jsdelivr.net`. Try another network; score panels need it.

**A lead shows `PSI failed`** — Google couldn't reach that store (password-protected, bot-blocked, or down). Normal. Skip it.

**Deck button spins forever** — open the console (F12) and check for errors. Try **Preview** first; if that works, the PDF step is the issue.

**Workflow says "no runs yet"** — you skipped step 3.5's "enable workflows" prompt. Go back to the Actions tab.
