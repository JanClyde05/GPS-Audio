# GuardianTrack — Local Development & Debugging Guide

This guide walks you through setting up a **local server (`http://localhost:8888`)** on your computer to test and debug the web app UI, serverless Netlify Functions, audio playback, and GPS live map before deploying updates to Netlify.

---

## 🛠 Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed on your computer (v18 or higher recommended).

---

## 🚀 Step 1: Install Dependencies & Start Local Dev Server

1. Open your terminal or Command Prompt.
2. Navigate to the backend directory:
   ```bash
   cd "D:\Antigravity\Projects\GPS_Audio\GPS-Audio\backend"
   ```
3. Install project dependencies:
   ```bash
   npm install
   ```
4. Start the Netlify local development server:
   ```bash
   npm run dev
   ```
   *(Alternatively, run `npx netlify dev`)*

---

## 🌐 Step 2: Open & Debug in Browser

Once started, Netlify CLI will output:
```text
◈ Netlify Dev ◈
◈ Local dev server running at http://localhost:8888
```

1. Open your web browser and go to:
   **`http://localhost:8888`**
2. You will see the **GuardianTrack Parent Dashboard** loading locally!

---

## 🔍 How to Test Features Locally

### 1. Test APIs directly from your Browser:
- **View All Events (JSON):** `http://localhost:8888/api/events`
- **Simulate Audio Upload:** Use Postman or `curl` to POST data to `http://localhost:8888/api/upload`.

### 2. Testing ESP32 Receiver Uploads to Localhost (Local Wi-Fi):
To test your physical ESP32 Receiver sending data directly to your local computer instead of the live Netlify cloud:

1. Find your computer's local Wi-Fi IP address:
   - On Windows: Open Command Prompt and run `ipconfig`. Look for **IPv4 Address** (e.g. `192.168.1.50`).
2. In `GPS-Audio/receiver/config.h`, set `BACKEND_URL` to your local IP:
   ```cpp
   #define BACKEND_URL  "http://192.168.1.50:8888"  // Change to your PC's IP
   ```
3. Flash the **Receiver** board. Now when the Receiver uploads audio or GPS telemetry, it will send it straight to your computer's local server!

---

## 🐞 Useful Debugging Commands

| Task | Command |
| :--- | :--- |
| **Start local dev server** | `npm run dev` (inside `GPS-Audio/backend`) |
| **View Netlify CLI logs** | Watch the terminal output where `npm run dev` is running |
| **Inspect Web UI logs** | Open browser Developer Tools (`F12` > **Console** tab) |
| **Inspect Network requests** | Open browser Developer Tools (`F12` > **Network** tab) |
| **Clear local Blob storage** | Delete `.netlify/` folder inside `GPS-Audio/backend` |

---

## 🔄 Switching Back to Production Cloud

When you finish debugging locally and want the ESP32 Receiver to upload to your live Netlify site again:
1. Re-open `GPS-Audio/receiver/config.h`.
2. Change `BACKEND_URL` back to your production Netlify URL:
   ```cpp
   #define BACKEND_URL  "https://YOUR-SITE-NAME.netlify.app"
   ```
3. Re-flash the Receiver board!
