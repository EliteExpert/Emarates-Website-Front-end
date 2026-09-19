// Vercel serverless function: shared crew gallery on Vercel Blob.
//   GET  /api/photos  -> { photos: [{ url, flight, by, avatar, ts }] }
//   POST /api/photos  -> verifies the caller's Discord token, stores the
//                        image in Blob, and appends it to the shared list.
// Requires BLOB_READ_WRITE_TOKEN (created when you attach a Blob store to
// the Vercel project). Without it the function answers 503 and the site
// falls back to curated + local-only photos.
const { put, list } = require('@vercel/blob');

const DISCORD_API = 'https://discord.com/api/v9';
const INDEX_PATH = 'gallery/index.json';
const MAX_INDEX_ENTRIES = 120;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readIndexJson() {
  const { blobs } = await list({ prefix: INDEX_PATH, limit: 1 });
  const entry = blobs.find((blob) => blob.pathname === INDEX_PATH);
  if (!entry) return [];
  const response = await fetch(entry.url, { cache: 'no-store' });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function writeIndexJson(entries) {
  await put(INDEX_PATH, JSON.stringify(entries.slice(0, MAX_INDEX_ENTRIES)), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
    cacheControlMaxAge: 0
  });
}

async function verifyDiscordToken(authorizationHeader) {
  if (!authorizationHeader?.startsWith('Bearer ')) return null;
  try {
    const response = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: authorizationHeader }
    });
    if (!response.ok) return null;
    const profile = await response.json();
    return {
      id: profile.id,
      by: profile.global_name || profile.username,
      avatar: profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=64`
        : null
    };
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const photos = await readIndexJson();
      return json(res, 200, { photos });
    } catch (error) {
      if (String(error.message).includes('BLOB_READ_WRITE_TOKEN') || /No token found/i.test(String(error.message))) {
        return json(res, 503, { error: 'Blob store is not connected to this deployment.' });
      }
      console.error('GET /api/photos failed:', error);
      return json(res, 500, { error: 'Could not load the gallery.' });
    }
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      return json(res, 400, { error: 'Invalid JSON body.' });
    }

    if (!body?.dataUrl?.startsWith('data:image/') || typeof body.flight !== 'string') {
      return json(res, 400, { error: 'A photo (dataUrl) and flight caption are required.' });
    }

    const pilot = await verifyDiscordToken(req.headers.authorization);
    if (!pilot) {
      return json(res, 401, { error: 'Log in with Discord to add photos.' });
    }

    try {
      const matches = body.dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (!matches) return json(res, 400, { error: 'Unsupported image encoding.' });
      const [, contentType, base64] = matches;
      const buffer = Buffer.from(base64, 'base64');
      if (buffer.length > 4.5 * 1024 * 1024) {
        return json(res, 413, { error: 'Photo is too large.' });
      }

      const stamp = Date.now().toString(36);
      const extension = contentType === 'image/png' ? 'png' : 'jpg';
      const image = await put(`gallery/${pilot.id}-${stamp}.${extension}`, buffer, {
        access: 'public',
        contentType
      });

      const entries = await readIndexJson();
      const entry = {
        url: image.url,
        flight: body.flight.trim().slice(0, 24) || 'Crew photo',
        by: pilot.by,
        avatar: pilot.avatar,
        ts: Date.now()
      };
      entries.unshift(entry);
      await writeIndexJson(entries);

      return json(res, 200, { photo: entry });
    } catch (error) {
      if (/No token found/i.test(String(error.message)) || String(error.message).includes('BLOB_READ_WRITE_TOKEN')) {
        return json(res, 503, { error: 'Blob store is not connected to this deployment.' });
      }
      console.error('POST /api/photos failed:', error);
      return json(res, 500, { error: 'Could not save the photo.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { error: 'Method not allowed.' });
};
