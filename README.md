# Emirates PTFS — Departure Lounge

A ground-up Emirates PTFS website concept built around a premium airline booking experience: cinematic route storytelling, a live flight board, cabin tiers, crew roles and an on-board ICE experience.

## Pages

- **Home** — image-led Emirates tail hero, live route board, destination cards and editorial storytelling
- **Flight board** — searchable, filterable weekly operations board with a local fallback when the remote feed is unavailable
- **Cabins** — Economy, Business and First experiences with a comparison table
- **On board** — Emirates ICE seat-back interface with route information, menus and entertainment
- **Careers** — crew roles and working principles
- **About us** — community story and flight-deck gallery
- **Join the community** — community application form and Discord handoff
- **Profile** — Skywards miles, tier progress and claiming miles for flown flights

## Local development

```bash
npm install
python -m http.server 4173
```

Open `http://localhost:4173/index.html`.

The site uses the local Emirates Medium font and curated aviation photos in `assets/photos`. The landing page uses a local Emirates tail image, and the flight board reads from the Emirates PTFS FIDS endpoint with a representative local schedule fallback.

## Discord sign-in

The header sign-in uses Discord OAuth2 authorization code + PKCE. The Discord application must be configured as a public client with `https://<your-domain>/index.html` registered as an OAuth2 redirect URL. No client secret is stored in the front end.

## Skywards profile and miles

Member data lives in the **same Postgres schema as the [Emirates-Skywards Discord bot](https://github.com/EliteExpert/Emirates-Skywards)** — the `accounts`, `awards`, `flight_awards` and `purchases` tables — so miles earned at Discord events and spends in the bot's shop show up on the website, and flight miles claimed on the website are visible to the bot.

The site serves the profile through the `/api/profile` and `/api/claim` Vercel functions. Set `DATABASE_URL` in the Vercel project environment variables. Note that Railway's `postgres.railway.internal` hostname is only reachable from inside Railway — Vercel functions need the Postgres **public TCP proxy URL** from the Railway dashboard (Postgres service → Settings → Networking).

Website claims are **attendance-gated**: a flown FIDS departure is only claimable if the member clicked **Interested** on the flight's Discord scheduled event. Staff link each FIDS flight to its event via the flight's `discordEvent` field on the FIDS board (a `discord.com/events/<guild>/<event>` share URL or a raw event ID) — the site resolves that ID against the guild's scheduled events and verifies the member's subscription through the Discord API using `DISCORD_BOT_TOKEN` (set it in the Vercel project env vars alongside `DATABASE_URL`). Flights whose Discord event was already paid out via the bot's `/flight-awards` are marked "Awarded in Discord" and cannot be claimed again.

The earned amount is the Dubai → destination great-circle distance (rounded to the nearest ten; unknown airports fall back to 1,500) times the member's travel-class role multiplier (First ×3, Business ×2, Economy ×1 — same role IDs as the bot) and their stored tier bonus (Silver +30%, Gold +75%, Platinum +100%). Each flight can be claimed once per member. Tiers themselves are bot-managed: members spend miles to upgrade in Discord, which also syncs their Discord role.
