# Google Drive Storage — Setup Guide

Attachments uploaded through the Approval Hub are stored in Google Drive
when `GDRIVE_CREDENTIALS` and `GDRIVE_FOLDER_ID` are both set in the
server's environment. Files are owned by a **Service Account** (a
Google-managed robot account) so no human has to log in or approve an
OAuth consent screen.

This is the recommended storage backend for Render deployments because
Render's ephemeral filesystem wipes files on every restart.

---

## Step 1 — Create a Google Cloud project

1. Open [console.cloud.google.com](https://console.cloud.google.com).
2. Click **Select a project → New Project**.
3. Name it anything (e.g. `sp-college-hub`). Click **Create**.
4. Make sure the new project is selected in the top dropdown.

---

## Step 2 — Enable the Google Drive API

1. In the left menu go to **APIs & Services → Library**.
2. Search for **Google Drive API**.
3. Click it, then click **Enable**.

---

## Step 3 — Create a Service Account

1. Go to **APIs & Services → Credentials**.
2. Click **Create Credentials → Service Account**.
3. Give it any name (e.g. `spc-attachments`). Click **Create and Continue**.
4. Skip the optional role and user access steps. Click **Done**.
5. You should see your new service account listed. Click its **email address**
   to open it.
6. Go to the **Keys** tab → **Add Key → Create new key**.
7. Choose **JSON**. Click **Create**.  
   A file like `spc-attachments-xxxx.json` downloads to your computer.
   **Keep this file secret — it is equivalent to a password.**

---

## Step 4 — Create a Google Drive folder

1. Open [drive.google.com](https://drive.google.com).
2. Click **+ New → Folder**. Name it anything (e.g. `SPC Attachments`).
3. Right-click the new folder → **Share**.
4. In the "Add people and groups" box, paste the service account's email
   address. It looks like `spc-attachments@sp-college-hub.iam.gserviceaccount.com`
   (find it in the Credentials page or at the top of the JSON key file as
   `"client_email"`).
5. Set the permission to **Editor**. Click **Send** (no notification is sent).
6. Open the folder. Copy its ID from the URL:
   ```
   https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz
                                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                           This is your GDRIVE_FOLDER_ID
   ```

---

## Step 5 — Generate the base64 credential string

The JSON key file must be encoded to a single line so it can be pasted
into Render's environment variable form.

**Linux / macOS:**
```bash
base64 -w0 spc-attachments-xxxx.json
```

**Windows PowerShell:**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("spc-attachments-xxxx.json"))
```

Copy the output — it is a long string of letters and numbers with no
spaces or newlines.

---

## Step 6 — Add the environment variables to Render

1. Open your Render dashboard → your web service → **Environment**.
2. Add two variables:

   | Key | Value |
   |---|---|
   | `GDRIVE_CREDENTIALS` | The base64 string from Step 5 |
   | `GDRIVE_FOLDER_ID` | The folder ID from Step 4 |

3. Click **Save Changes**. Render will redeploy the service automatically.

---

## Step 7 — Verify it works

1. Log in as a Head user and open any submitted request.
2. Use "Attach a document" to upload a test PDF.
3. Trigger a Render redeploy (or wait for the service to restart from
   idle) to confirm the ephemeral filesystem has been reset.
4. Log in as the Principal and open the same request.
5. Click Download on the attached file — it should download successfully
   because the file now lives in Google Drive, not the container.
6. Check the shared Drive folder in your browser — you should see the
   uploaded file there too.

---

## Local development

When `GDRIVE_CREDENTIALS` and `GDRIVE_FOLDER_ID` are **not** set (e.g.
in your local `.env`), the server automatically falls back to writing
files to the local `uploads/` directory. You do **not** need a service
account to run the project locally.

---

## Storage limits

- Each Google account gets **15 GB free** on Drive.
- The college can use the Drive folder to browse and download all
  uploaded quotations and documents directly through the Drive UI.
- If storage grows beyond 15 GB, upgrade to Google One or create a
  second service account with its own Drive.

---

## Revoking access

If the service account key is ever compromised, go to
**APIs & Services → Credentials**, click the service account, go to
**Keys**, and delete the key. Generate a new one and update the Render
environment variable. Existing uploaded files are unaffected.
