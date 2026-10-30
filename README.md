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

## Local development

```bash
npm install
python -m http.server 4173
```

Open `http://localhost:4173/index.html`.

The site uses the local Emirates Medium font and curated aviation photos in `assets/photos`. The landing page uses a local Emirates tail image, and the flight board reads from the Emirates PTFS FIDS endpoint with a representative local schedule fallback.

## Discord sign-in

The header sign-in uses Discord OAuth2 authorization code + PKCE. The Discord application must be configured as a public client with `https://<your-domain>/index.html` registered as an OAuth2 redirect URL. No client secret is stored in the front end.

