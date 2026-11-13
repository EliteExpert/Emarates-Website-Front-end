// Vercel serverless function: earn Skywards miles for a flown FIDS departure.
//   GET  /api/claim (Authorization: Bearer <Discord token>)
//        -> { flights: [{ flightNumber, date, departureTime, destination,
//             event, claimState, estimatedMiles }] }
//   POST /api/claim (Authorization: Bearer <Discord token>)
//        body: { flightNumber: "EK 410", date: "2026-10-30" }
//        -> { earned, base, travelClass, miles, tier }
//
// Attendance rule: each FIDS flight is linked to its Discord scheduled event
// by staff through the flight's discordEvent field (a discord.com/events/...
// share URL or a raw event ID). The function verifies the linked event
// exists in the guild and that the member is on its subscriber list, using
// the bot token against the Discord API. Miles are the Dubai -> destination
// distance times the member's travel-class role multiplier and stored tier
// bonus — the same multiplier chain the Discord bot applies.
const { getPool, ensureSchema, upsertAccount, tierInfo, TIER_MULTIPLIERS, CLASS_MULTIPLIERS, TRAVEL_CLASS_ROLE_IDS } = require('./db');

const DISCORD_API = process.env.DISCORD_API_BASE || 'https://discord.com/api/v9';
const DISCORD_BOT_TOKEN = (process.env.DISCORD_BOT_TOKEN || '').trim();
const DISCORD_GUILD_ID = (process.env.DISCORD_GUILD_ID || '1294732873143685160').trim();
const FIDS_FLIGHTS_URL = process.env.FIDS_FLIGHTS_URL || 'https://emirates-ptfs-fids.onrender.com/api/flights';
const DXB = { lat: 25.2532, lon: 55.3657 };
const DEFAULT_MILES = 1500;

// Coordinates for airports the FIDS board is likely to serve; anything
// unknown falls back to DEFAULT_MILES.
const AIRPORTS = {
  AKL: [-37.0082, 174.785], AMM: [31.7226, 35.9932], ARN: [59.6519, 17.9186],
  AUH: [24.433, 54.6511], BAH: [26.2708, 50.6336], BCN: [41.2974, 2.0833],
  BHX: [52.4539, -1.748], BKK: [13.69, 100.7501], BOM: [19.0896, 72.8656],
  BOS: [42.3656, -71.0096], BNE: [-27.3842, 153.1175], CCU: [22.6547, 88.4467],
  CDG: [49.0097, 2.5479], CGK: [-6.1256, 106.6559], CHC: [-43.4894, 172.5322],
  COK: [10.152, 76.4019], CPH: [55.618, 12.656], CPT: [-33.9715, 18.6021],
  CAI: [30.1219, 31.4056], DAC: [23.8433, 90.3978], DEL: [28.5562, 77.1],
  DOH: [25.2731, 51.608], DUB: [53.4213, -6.2701],
  EWR: [40.6895, -74.1745], FCO: [41.8003, 12.2389], FRA: [50.0379, 8.5622],
  GLA: [55.8719, -4.4331], GRU: [-23.4356, -46.4731], HEL: [60.3172, 24.9633],
  HKG: [22.308, 113.9185], HND: [35.5494, 139.7798], HYD: [17.2403, 78.4294],
  ICN: [37.4602, 126.4407], ISB: [33.549, 72.8259], IST: [41.2753, 28.7519],
  IAD: [38.9531, -77.4565], JED: [21.6796, 39.1565], JFK: [40.6413, -73.7781],
  JNB: [-26.1392, 28.246], KBL: [34.5658, 69.2123], KHI: [24.9065, 67.1608],
  KUL: [2.7456, 101.7099], KWI: [29.2266, 47.9689], LAX: [33.9416, -118.4085],
  LHE: [31.5216, 74.4036], LHR: [51.47, -0.4543], LIS: [38.7742, -9.1342],
  MAA: [12.9941, 80.1709], MAD: [40.4936, -3.5668], MAN: [53.3537, -2.275],
  MCT: [23.5933, 58.2844], MEL: [-37.669, 144.841], MEX: [19.4363, -99.0721],
  MLE: [4.1918, 73.5291], MNL: [14.5086, 121.0198], MUC: [48.3538, 11.7861],
  NRT: [35.772, 140.3929], PEK: [40.0799, 116.6031], PVG: [31.1443, 121.8083],
  RUH: [24.9576, 46.6988], SIN: [1.3644, 103.9915], SFO: [37.6213, -122.379],
  SGN: [10.8188, 106.652], SEA: [47.4502, -122.3088], SYD: [-33.9399, 151.1753],
  TLV: [32.0114, 34.8867], TBS: [41.6692, 44.9547], VCE: [45.5053, 12.3519],
  VIE: [48.1103, 16.5697], YYZ: [43.6777, -79.6248], ZRH: [47.4647, 8.5492]
};

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function verifyDiscordToken(authorizationHeader) {
  if (!authorizationHeader?.startsWith('Bearer ')) return null;
  try {
    const response = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: authorizationHeader },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return null;
    const profile = await response.json();
    return { id: profile.id, name: profile.global_name || profile.username };
  } catch {
    return null;
  }
}

function discordFetch(path) {
  return fetch(`${DISCORD_API}${path}`, {
    headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    signal: AbortSignal.timeout(10000)
  });
}

async function fetchScheduledEvents() {
  const response = await discordFetch(`/guilds/${DISCORD_GUILD_ID}/scheduled-events?with_user_count=true`);
  if (!response.ok) throw new Error(`Discord scheduled events responded with ${response.status}`);
  return response.json();
}

// Discord caps this endpoint at 100 rows per page.
async function fetchEventSubscriberIds(eventId) {
  const ids = new Set();
  let after;
  while (true) {
    const query = after ? `&after=${after}` : '';
    const response = await discordFetch(`/guilds/${DISCORD_GUILD_ID}/scheduled-events/${eventId}/users?with_member=true&limit=100${query}`);
    if (!response.ok) throw new Error(`Discord event users responded with ${response.status}`);
    const users = await response.json();
    for (const entry of users) ids.add(String(entry.user?.id || entry.member?.user?.id || ''));
    if (users.length < 100) return ids;
    after = users[users.length - 1].user?.id;
    if (!after) return ids;
  }
}

async function fetchMemberRoleIds(userId) {
  const response = await discordFetch(`/guilds/${DISCORD_GUILD_ID}/members/${userId}`);
  if (!response.ok) return [];
  const member = await response.json();
  return member.roles || [];
}

// Same order as the bot's resolveTravelClass.
function resolveTravelClass(roleIds) {
  const roleSet = new Set(roleIds);
  for (const travelClass of ['First', 'Business', 'Economy']) {
    if (roleSet.has(TRAVEL_CLASS_ROLE_IDS[travelClass])) return travelClass;
  }
  return 'Economy';
}

// Staff link a FIDS flight to its Discord scheduled event via the flight's
// discordEvent field — either the share URL (discord.com/events/<guild>/
// <event>) or a raw event ID.
function discordEventId(flight) {
  const raw = String(flight?.discordEvent || '').trim();
  if (!raw) return null;
  if (/^\d{1,21}$/.test(raw)) return raw;
  const fromUrl = raw.match(/events\/\d+\/(\d{1,21})/);
  if (fromUrl) return fromUrl[1];
  const trailing = raw.match(/(\d{1,21})\D*$/);
  return trailing ? trailing[1] : null;
}

function findMatchingEvent(events, flight) {
  const id = discordEventId(flight);
  if (!id) return null;
  return (events || []).find((event) => String(event.id) === id) || null;
}

function haversineKm(from, to) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = radians(to.lat - from.lat);
  const dLon = radians(to.lon - from.lon);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function baseMilesForDestination(destination) {
  const code = String(destination || '').match(/\(([A-Z]{3})\)/)?.[1];
  const airport = code && AIRPORTS[code];
  if (!airport) return DEFAULT_MILES;
  const km = haversineKm(DXB, { lat: airport[0], lon: airport[1] });
  return Math.round((km * 0.621371) / 10) * 10;
}

async function fetchFidsFlights() {
  const response = await fetch(FIDS_FLIGHTS_URL, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`FIDS responded with ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload : payload.flights || [];
}

function departedDepartures(flights) {
  return (Array.isArray(flights) ? flights : [])
    .filter((flight) => flight.type === 'departure' && !/cancel/i.test(flight.status || ''))
    .map((flight) => ({ ...flight, scheduledTs: Date.parse(`${flight.date}T${flight.departureTime}:00Z`) }))
    .filter((flight) => !Number.isNaN(flight.scheduledTs) && flight.scheduledTs <= Date.now())
    .sort((a, b) => b.scheduledTs - a.scheduledTs)
    .slice(0, 12);
}

const flightReference = (flightNumber, date) => `${flightNumber} | ${date}`;

function requireBotToken(res) {
  if (DISCORD_BOT_TOKEN) return true;
  json(res, 503, { error: 'Attendance checking is not configured yet — set DISCORD_BOT_TOKEN.' });
  return false;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const pilot = await verifyDiscordToken(req.headers.authorization);
  if (!pilot) return json(res, 401, { error: 'Sign in with Discord to earn miles.' });
  if (!requireBotToken(res)) return;

  let body = {};
  if (req.method === 'POST') {
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      return json(res, 400, { error: 'Invalid JSON body.' });
    }
  }

  try {
    await ensureSchema();
    const account = await upsertAccount(pilot.id, pilot.name);

    const flights = departedDepartures(await fetchFidsFlights());
    const scheduledEvents = await fetchScheduledEvents();

    // Match every departed flight to its linked Discord scheduled event once.
    const matched = new Map();
    for (const flight of flights) {
      matched.set(flight, findMatchingEvent(scheduledEvents, flight));
    }

    if (req.method === 'GET') {
      const { rows: claimedRefs } = await getPool().query(
        'SELECT flight_reference FROM flight_awards WHERE user_id = $1::bigint',
        [account.user_id]
      );
      const claimed = new Set(claimedRefs.map((row) => row.flight_reference));
      const eventIds = [...new Set([...matched.values()].filter(Boolean).map((event) => String(event.id)))];
      const awarded = new Set();
      for (const eventId of eventIds) {
        const { rows } = await getPool().query(
          'SELECT 1 FROM external_event_awards WHERE event_id = $1::bigint LIMIT 1',
          [eventId]
        );
        if (rows.length) awarded.add(eventId);
      }
      const subscriberCache = new Map();
      const roleIds = await fetchMemberRoleIds(pilot.id);
      const travelClass = resolveTravelClass(roleIds);
      const multiplier = CLASS_MULTIPLIERS[travelClass] * (TIER_MULTIPLIERS[account.tier] || 1);

      const list = [];
      for (const flight of flights) {
        const event = matched.get(flight);
        const reference = flightReference(flight.flightNumber, flight.date);
        const base = baseMilesForDestination(flight.destination);
        const estimatedMiles = Math.max(1, Math.round(base * multiplier));
        let claimState = 'no-event';
        if (claimed.has(reference)) claimState = 'already-claimed';
        else if (event && awarded.has(String(event.id))) claimState = 'awarded-in-discord';
        else if (!event) claimState = 'no-event';
        else {
          if (!subscriberCache.has(String(event.id))) {
            subscriberCache.set(String(event.id), await fetchEventSubscriberIds(event.id));
          }
          claimState = subscriberCache.get(String(event.id)).has(pilot.id) ? 'claimable' : 'not-subscribed';
        }
        list.push({
          flightNumber: flight.flightNumber,
          date: flight.date,
          departureTime: flight.departureTime,
          destination: flight.destination,
          event: event ? { id: String(event.id), name: event.name, startsAt: event.scheduled_start_timestamp } : null,
          claimState,
          estimatedMiles
        });
      }
      return json(res, 200, { travelClass, flights: list });
    }

    // POST: claim one flight.
    const flightNumber = String(body?.flightNumber || '').trim().toUpperCase();
    const flightDate = String(body?.date || '').trim();
    if (!flightNumber || !/^\d{4}-\d{2}-\d{2}$/.test(flightDate)) {
      return json(res, 400, { error: 'A flight number and date (YYYY-MM-DD) are required.' });
    }
    const flight = flights.find((entry) =>
      String(entry.flightNumber || '').trim().toUpperCase() === flightNumber && entry.date === flightDate);
    if (!flight) {
      return json(res, 404, { error: 'That flight is not on the FIDS departures board (or has not departed yet).' });
    }
    const reference = flightReference(flightNumber, flightDate);
    const event = findMatchingEvent(scheduledEvents, flight);
    if (!event) {
      return json(res, 404, { error: 'No Discord event is linked to this flight — staff can link one on the FIDS board.' });
    }
    const { rows: awardedRows } = await getPool().query(
      'SELECT 1 FROM external_event_awards WHERE event_id = $1::bigint LIMIT 1',
      [String(event.id)]
    );
    if (awardedRows.length) {
      return json(res, 409, { error: 'Miles for this flight were already awarded in Discord.' });
    }
    const { rows: existing } = await getPool().query(
      'SELECT 1 FROM flight_awards WHERE user_id = $1::bigint AND flight_reference = $2 LIMIT 1',
      [account.user_id, reference]
    );
    if (existing.length) {
      return json(res, 409, { error: 'You already claimed miles for this flight.' });
    }
    const subscribers = await fetchEventSubscriberIds(event.id);
    if (!subscribers.has(pilot.id)) {
      return json(res, 403, { error: 'You are not marked as attending this flight — click Interested on its Discord event before departure.' });
    }

    const roleIds = await fetchMemberRoleIds(pilot.id);
    const travelClass = resolveTravelClass(roleIds);
    const base = baseMilesForDestination(flight.destination);
    const multiplier = CLASS_MULTIPLIERS[travelClass] * (TIER_MULTIPLIERS[account.tier] || 1);
    const earned = Math.max(1, Math.round(base * multiplier));

    await getPool().query(
      `INSERT INTO flight_awards (user_id, miles, flight_reference, awarded_by, awarded_at)
       VALUES ($1::bigint, $2, $3, $1::bigint, NOW())`,
      [account.user_id, earned, reference]
    );
    const { rows } = await getPool().query(
      'UPDATE accounts SET miles = miles + $2 WHERE user_id = $1::bigint RETURNING miles',
      [account.user_id, earned]
    );
    const miles = Number(rows[0].miles);
    return json(res, 200, { earned, base, travelClass, miles, tier: tierInfo(account.tier, miles) });
  } catch (error) {
    if (error.code === 'DB_NOT_CONFIGURED' || /DATABASE_URL/.test(error.message)) {
      return json(res, 503, { error: 'The miles service is not configured yet.' });
    }
    if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(error.message) && /railway\.internal/i.test(String(process.env.DATABASE_URL))) {
      return json(res, 503, { error: 'The database hostname only works inside Railway — set DATABASE_URL to its public TCP proxy URL (DATABASE_PUBLIC_URL).' });
    }
    console.error(`${req.method} /api/claim failed:`, error);
    return json(res, 502, { error: 'Could not record your flight. Try again shortly.' });
  }
};
