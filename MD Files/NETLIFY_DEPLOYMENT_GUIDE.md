# GuardianTrack — Netlify Deployment & GitHub Integration Guide

This guide walks you through connecting your GitHub repository to **Netlify** to host the GuardianTrack backend API (Netlify Functions + Blobs) and parent web dashboard. It also covers how to **disable automatic deploys on git push** so you control when site builds occur.

---

## 📋 Pre-Deployment Summary

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Base Directory** | `GPS-Audio/backend` | Subfolder containing `package.json` & `netlify.toml` |
| **Build Command** | *(Leave blank)* or `npm install` | Netlify automatically compiles functions |
| **Publish Directory** | `GPS-Audio/backend/public` | Directory serving the web dashboard UI |
| **Auto-Deploy Status** | **Stopped / Paused** | Prevents Netlify from auto-building on git commits |

---

## 🚀 Step-by-Step Deployment Instructions

### Step 1: Connect GitHub Repository to Netlify

1. Log into your [Netlify Account](https://app.netlify.app/).
2. On your Netlify dashboard, click **Add new site > Import an existing project**.
3. Choose **GitHub** as your Git provider.
4. Authorize Netlify to access your GitHub account and select your **GPS-Audio** repository.

---

### Step 2: Configure Netlify Build Settings

On the project configuration page, set the following fields:

1. **Branch to deploy:** `main` *(or `master`)*
2. **Base directory:**
   ```text
   GPS-Audio/backend
   ```
   *(This points Netlify to the backend subfolder containing `package.json`, `netlify.toml`, and the `functions/` directory).*
3. **Build command:** *(Leave blank)*
4. **Publish directory:**
   ```text
   public
   ```
5. Click **Deploy guardian-track** (or **Deploy site**).

---

### Step 3: Disable Auto-Upload / Auto-Deploy on Git Commit 🛑

By default, Netlify builds and deploys your site every time you push code to GitHub. To disable this so Netlify **does not auto-upload** on new commits:

1. In your Netlify Site Dashboard, go to **Site settings**.
2. In the left sidebar, click **Build & deploy > Continuous deployment**.
3. Scroll down to the **Deploys** section and click **Edit settings**.
4. Change **Build status** to:
   - **Stop builds** (or **Deploys paused**).
5. Click **Save**.

> [!NOTE]
> Now Netlify will **ignore** future git commits and `git push` events. Your production site will stay stable and won't re-deploy automatically.

---

### Step 4: How to Manually Deploy New Updates

Whenever you *do* want to deploy updates after making code changes:

#### Option A: Manual Trigger via Netlify Dashboard (Web UI)
1. Go to your site dashboard on [Netlify](https://app.netlify.app).
2. Click **Deploys** tab.
3. Click the **Trigger deploy** dropdown button and select **Deploy site**.

#### Option B: Manual Deploy via Netlify CLI (Command Line)
Inside your local project terminal (`GPS-Audio/backend` folder):
```bash
npx netlify deploy --prod
```

---

### Step 5: Copy Site URL to Receiver Firmware

Once your site is deployed:

1. Netlify will assign a unique live URL to your site (e.g., `https://guardiantrack-audio-xyz123.netlify.app`).
2. Copy this URL (without any trailing `/`).
3. Open `GPS-Audio/receiver/config.h` in Arduino IDE or your editor.
4. Update line 26:
   ```cpp
   #define BACKEND_URL "https://guardiantrack-audio-xyz123.netlify.app"
   ```
5. Save `receiver/config.h` and flash the **Receiver** board!

---

## 🔒 Verification & API Endpoints

Once deployed, Netlify automatically exposes two backend serverless API endpoints:

- **HTTPS Audio Upload Endpoint:** `https://<YOUR-SITE>.netlify.app/api/upload`
- **Dashboard Events API:** `https://<YOUR-SITE>.netlify.app/api/events`
- **Parent Web Dashboard UI:** `https://<YOUR-SITE>.netlify.app/`
