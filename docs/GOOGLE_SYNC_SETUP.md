# Turning on "Save to Google Drive" (owner setup)

VisionSense can let each visitor sign in with Google and back up **their own**
charts to **their own** Google Drive. Nothing is stored on any server of ours —
the app stays a plain static website. Data goes into a hidden per-app folder in
the user's Drive that only VisionSense can see; the user can disconnect or revoke
access at any time.

This feature is **off until you do the one-time setup below.** While it is off,
the app looks and behaves exactly as before — no sign-in button appears and no
Google code is ever loaded.

You do **not** need to be a programmer. This is all clicking around in Google's
website. It takes about 15 minutes. You do it once.

---

## What you'll end up with

A "Client ID" — a long piece of text that looks like:

```
1234567890-abc123def456.apps.googleusercontent.com
```

This is **not a password or a secret.** It is a public identifier (Google shows
it to every user during sign-in). You will paste it into the app.

---

## Step 1 — Create a Google Cloud project

1. Go to **https://console.cloud.google.com/**.
2. Sign in with the Google account you want to own this app.
3. At the very top of the page, click the project dropdown, then **New Project**.
4. Name it something like `VisionSense`. Click **Create**.
5. Wait a few seconds, then make sure that new project is selected in the top bar.

## Step 2 — Turn on the Google Drive API

1. In the left menu (the ☰ icon) go to **APIs & Services → Library**.
2. Search for **Google Drive API**.
3. Click it, then click **Enable**.

## Step 3 — Set up the OAuth consent screen

This is the sign-in box users will see.

1. Left menu → **APIs & Services → OAuth consent screen**.
2. Choose **External**, then **Create**.
3. Fill in the required fields:
   - **App name:** `VisionSense`
   - **User support email:** your email
   - **Developer contact email:** your email
   - (You can leave logos and links blank.)
4. Click **Save and Continue**.
5. On the **Scopes** step, just click **Save and Continue** (you don't need to
   add scopes here — the app requests them itself).
6. On the **Test users** step, click **+ Add Users** and add **your own Google
   email address** (and anyone else you want to let in while the app is in
   "testing" mode). Click **Save and Continue**.

> While the app is in **Testing** mode, only the test users you listed can sign
> in. That is fine for personal use. If you later want anyone to use it, come
> back and click **Publish app** — but note Google may then ask you to verify the
> app because it touches Drive.

## Step 4 — Create the Client ID

1. Left menu → **APIs & Services → Credentials**.
2. Click **+ Create Credentials → OAuth client ID**.
3. **Application type:** choose **Web application**.
4. **Name:** `VisionSense Web`.
5. Under **Authorized JavaScript origins**, click **+ Add URI** and add each of
   these, exactly (no trailing slash):
   - `https://lzmediaspirit-hue.github.io`
   - `http://localhost:5173`
   - `http://localhost:4173`

   > The first is where the live app is hosted (GitHub Pages). The two
   > `localhost` ones let you test on your own computer with `npm run dev`
   > (5173) and `npm run preview` (4173). You do **not** need "Authorized
   > redirect URIs" — leave that section empty.
6. Click **Create**. A box pops up with your **Client ID**. Copy it.

## Step 5 — Put the Client ID into the app

You have two ways. Pick one.

### Option A — the permanent way (edit one line, rebuild)

1. Open the file **`src/sync/config.ts`**.
2. Find the line:

   ```ts
   export const GOOGLE_CLIENT_ID = '';
   ```

3. Paste your Client ID between the quotes:

   ```ts
   export const GOOGLE_CLIENT_ID = '1234567890-abc123def456.apps.googleusercontent.com';
   ```

4. Save, rebuild, and deploy the site as usual. The sign-in widget will now
   appear on the dashboard.

### Option B — the quick-test way (no rebuild)

If you just want to try it once without editing files:

1. Open the app in your browser.
2. Open the browser's developer console (press **F12**, then the **Console** tab).
3. Paste this in (with your own ID) and press Enter:

   ```js
   localStorage.setItem('visionsense.sync.clientId', '1234567890-abc123def456.apps.googleusercontent.com')
   ```

4. Refresh the page. The **Connect Google Drive** button now appears.

   To turn it back off:
   `localStorage.removeItem('visionsense.sync.clientId')` then refresh.

---

## Using it

- On the dashboard you'll see **Connect Google Drive**. Click it and pick your
  Google account (it must be one of your **test users** from Step 3).
- The first time, Google asks permission to let VisionSense "see, create, and
  delete its own configuration data in your Google Drive." That is the hidden
  app folder — it cannot see your other files.
- Once connected you'll see **Connected as you@example.com**, when it last
  synced, and buttons for **Sync now** and **Disconnect**.
- After that, edits save to Drive automatically a couple of seconds after you
  make them. Open the app on another device, connect the same Google account,
  and your charts appear.
- **Disconnect** signs you out and stops syncing but **keeps** the charts on the
  current device — it never deletes your data.

## If something goes wrong

- **"Connect" does nothing / an error flashes:** the most common cause is the
  origin not being on the **Authorized JavaScript origins** list (Step 4.5).
  Make sure the address in your browser's bar matches one you added, exactly.
- **"Access blocked" / "app is being tested":** the Google account you're using
  isn't on the **Test users** list (Step 3.6). Add it.
- **The widget shows "Reconnect needed":** your sign-in expired (this is normal
  after about an hour, or after you've been offline). Click **Reconnect**. Your
  local editing is never blocked while this shows.
- Nothing you do here can lose your charts — they always live on your device
  first, and syncing is layered on top.
