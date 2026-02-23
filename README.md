# 🏍️ MotoTracker

A Progressive Web App (PWA) for dirt bike riders to track their profile, sessions, riding hours, and suspension setup. Data is stored directly in your GitHub repository.

## Features

- **Rider Profile** — Bike details (make/model/year/engine), tires, setup notes, injury log
- **Track Log** — Calendar view, session logging with conditions, type, and feel rating
- **Riding Hours** — Stats dashboard with monthly bar chart and weekly/monthly summaries
- **Suspension Setup** — Fork and shock settings with multiple saved presets per track

## Setup Instructions

### 1. Create your data repo
Create a new GitHub repository (e.g. `moto-data`). It can be private.

### 2. Host this app on GitHub Pages
1. Fork or push this repo to your GitHub account
2. Go to **Settings → Pages**
3. Set source to **GitHub Actions**
4. The app will be deployed to `https://yourusername.github.io/moto-tracker`

### 3. Generate a GitHub Personal Access Token
1. Go to https://github.com/settings/tokens/new
2. Set scopes: `repo` (full control)
3. Copy the token (starts with `ghp_`)

### 4. Connect the app
1. Open the app URL
2. Enter your GitHub username, data repo name, and token
3. Tap **Connect & Start**

## Data Storage

Data is stored as JSON files in your data repository:
```
your-data-repo/
  data/
    profile.json     ← Rider profile & injuries
    sessions.json    ← All track sessions
    suspension.json  ← Suspension presets
```

## Install as PWA

**iOS (Safari):** Tap Share → Add to Home Screen  
**Android (Chrome):** Tap menu → Install App  
**Desktop (Chrome):** Click the install icon in the address bar

## Offline Support

The app works offline after first load. Data syncs to GitHub when you tap the sync button (↻) in the top right.
