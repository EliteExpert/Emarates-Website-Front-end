# Emirates PTFS — Website

The Emirates PTFS community website: flight classes, the weekly flight schedule (live from the FIDS), careers, and the crew gallery with Discord login. Designed to match the [Flight Information Display](https://github.com/EliteExpert/Emirates-PTFS-FIDS) exactly.

## Pages

- **Home** — immersive hero with live Discord member count and weekly flight count, "This Week in the Air" preview, fleet gallery, destination marquee, stats, and a crew-photo tool
- **Weekly Flights** — the full FIDS-style board (all airlines, filterable by Emirates / flydubai / others) refreshed every 5 minutes
- **Classes** — cabin classes with game-pass links and a comparison table
- **Careers** — why fly with us + how to apply (join the Discord, DM the Applications bot)
- **Join Us** — live community statistics

## Discord integrations

- **Live member / online counts** from the public invite API
- **Crew Members stat** — live count of people in the crew voice channel `1376278983859245147` via the guild widget (enable **Server Settings → Widget**)
- **Discord OAuth (implicit)** — powers the crew-photo tool so uploads carry the pilot's name

## Vercel deployment

The site deploys to Vercel as-is: static pages plus the serverless function in `api/photos.js` (Vercel picks up the `api/` directory automatically).

To enable the shared crew gallery:

1. In the Vercel project, open the **Storage** tab and create a **Blob** store. Vercel links it and adds `BLOB_READ_WRITE_TOKEN` to the environment automatically.
2. In the [Discord Developer Portal](https://discord.com/developers/applications), open your application's **OAuth2** settings and add `https://<your-site>/index.html` as a redirect URI. Paste the application's Client ID into `DISCORD_OAUTH_CLIENT_ID` at the top of `script.js`.
3. Redeploy.

With that in place, **Add a photo to the gallery** on the home page uploads through `POST /api/photos` (the uploader's Discord token is verified server-side and their name is attached) and every visitor sees the shared board via `GET /api/photos`. When the Blob store or Discord login is not configured, the gallery quietly falls back to the curated photos plus anything added locally in that browser.

## Local development

```bash
npm install
python -m http.server 3000   # any static server works
```

`/api/photos` only runs on Vercel; locally the gallery falls back gracefully.
