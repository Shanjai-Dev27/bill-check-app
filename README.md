# Bill Check App

Admin enters paid bill numbers; the delivery person checks a bill number and sees **Paid**.

## Run

    node server.js

- Admin page:    http://localhost:3000/admin
- Delivery page: http://localhost:3000/check

Without any setup it stores bills in a local `bills.json` file.

## Use the free online database (Supabase)

1. Create a free account and a new project at https://supabase.com.
2. Open **SQL Editor -> New query**, paste the contents of `supabase.sql`, and click **Run**.
3. Open **Project Settings -> API** and copy the **Project URL** and the **secret / service_role key**.
4. Copy `.env.example` to `.env` and paste both values in.
5. Run `node server.js`. The console should say `Storage: Supabase (online database)`.

Notes:
- The key stays on the server (in `.env`); the HTML pages never see it.
- Do not commit `.env` to Git or share it.
- Free Supabase projects can be paused after a period of inactivity; you can resume them from the dashboard.
