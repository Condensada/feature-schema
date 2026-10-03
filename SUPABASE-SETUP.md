# Admin-only handbook editing

The handbook is publicly readable. Editing handbook pages, adding tabs, and uploading or deleting tab files require Google sign-in as `2240084@slu.edu.ph`. Supabase Row Level Security policies enforce the same restriction independently of the UI.

## Create and configure Supabase

1. Create a Supabase project and note its **Project URL** and **publishable key** (or legacy **anon key**). Do not use a service-role key in the website.
2. In the Supabase SQL Editor, run [`supabase/setup.sql`](./supabase/setup.sql).
3. In Supabase Authentication, enable Google as a provider and configure its OAuth client credentials. Add the deployed site URL and local development URL to the project's allowed redirect URLs.
4. Set `window.HANDBOOK_SUPABASE.url` and `window.HANDBOOK_SUPABASE.anonKey` in [`config.js`](./config.js).
5. Deploy the site. Sign in with `2240084@slu.edu.ph`; the edit and add-tab controls appear for that account only.

The admin email is intentionally repeated in `app.js` and `supabase/setup.sql`: if it changes, update both and re-run the SQL policies after replacing the email there. The public publishable/anon key belongs in `config.js`; never put the service-role key in the browser.

## Editing

Use **Edit current tab** to change a page title, description, and HTML content. Content is sanitized to a small allowlist of formatting and link tags before rendering. Planner and Creative Works embeds retain their configured sheet behavior; set those URLs in `config.js`.

Use **Add link tab** or **Upload file tab** to add a shared custom tab. Files are stored in the public `tab-uploads` bucket so writers can open them. Uploads are limited to 25 MB. Google Sheets have their own sharing permissions; set writers to Viewer in Google Sheets if they should not edit those sheets.

Until Supabase is configured, the site remains view-only and shows the built-in handbook pages. Existing custom tabs saved by an earlier browser-only version are local to that browser and are not automatically migrated to Supabase.
