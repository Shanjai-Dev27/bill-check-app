# Put the Bill app online (free) with Render

You need: a free GitHub account, a free Render account, and your Supabase project (see README.md).

## 1. Upload the code to GitHub
1. On github.com click **New repository**, name it `bill-check-app`, keep it **Private**, create it.
2. Click **uploading an existing file** and drag in: `server.js`, `package.json`, `.gitignore`, `README.md`, `supabase.sql`
   and the whole `public` folder (with `admin.html` and `check.html`).
3. **Do not upload `.env` or `bills.json`.** Click **Commit changes**.

## 2. Create the web service on Render
1. Go to render.com, sign up with GitHub, click **New + -> Web Service**, and pick your `bill-check-app` repo.
2. Fill in:
   - **Runtime / Language:** Node
   - **Build Command:** leave empty or `echo ok` (there is nothing to install)
   - **Start Command:** `node server.js`
   - **Instance type:** Free
3. Under **Environment Variables** add:
   - `SUPABASE_URL`    = your Supabase Project URL
   - `SUPABASE_KEY`    = your Supabase secret / service_role key
   - `ADMIN_PASSWORD`  = a strong password of your choice
4. Click **Create Web Service** and wait for the deploy to finish.

## 3. Use it
Render gives you an address like `https://bill-check-app-xxxx.onrender.com`.
- Admin: `https://<your-address>/admin`  (browser asks for the password; any username)
- Delivery person: `https://<your-address>/check`  (no password, share this link)

## Good to know
- On Render's free plan the service goes to sleep when nobody uses it, so the first visit after a quiet period can take
  around a minute to load. Open the check page once before the delivery rounds start.
- Bills live in Supabase, so they are safe when the server sleeps or restarts.
- Free Supabase projects can also pause after inactivity; resume from the Supabase dashboard if you see "Database error".
