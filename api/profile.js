// Vercel serverless function: the signed-in member's Skywards profile.
//   GET /api/profile  (Authorization: Bearer <Discord token>)
//   -> { user: { name, avatar }, skywardsNumber, miles,
//        tier: { tier, bonusPct, nextTier, upgradeCost, progressPct },
//        ledger: [{ kind, label, detail, miles, at }] }
// Data lives in the tables owned by the Emirates-Skywards Discord bot, so
// miles earned at Discord events and spends in the bot shop show up here.
// Tiers are bot-managed (upgrades happen in Discord); this endpoint never
// changes them.
const { getPool, ensureSchema, upsertAccount, tierInfo, SHOP_ITEM_NAMES } = require('./db');

const DISCORD_API = process.env.DISCORD_API_BASE || 'https://discord.com/api/v9';

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
    return {
      id: profile.id,
      name: profile.global_name || profile.username,
      avatar: profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=128`
        : null
    };
  } catch {
    return null;
  }
}

async function recentActivity(discordId) {
  const [awards, flights, purchases] = await Promise.all([
    getPool().query(
      `SELECT COALESCE(e.name, 'Skywards event') AS label, a.travel_class AS detail, a.miles, a.awarded_at
       FROM awards a LEFT JOIN events e ON e.id = a.event_id
       WHERE a.user_id = $1::bigint ORDER BY a.awarded_at DESC LIMIT 8`,
      [discordId]
    ),
    getPool().query(
      `SELECT flight_reference AS label, miles, awarded_at FROM flight_awards
       WHERE user_id = $1::bigint ORDER BY awarded_at DESC LIMIT 8`,
      [discordId]
    ),
    getPool().query(
      `SELECT product_id, cost, purchased_at FROM purchases
       WHERE user_id = $1::bigint ORDER BY purchased_at DESC LIMIT 8`,
      [discordId]
    )
  ]);
  const entries = [
    ...awards.rows.map((row) => ({ kind: 'event', label: row.label, detail: row.detail, miles: Number(row.miles), at: row.awarded_at })),
    ...flights.rows.map((row) => ({ kind: 'flight', label: row.label, detail: null, miles: Number(row.miles), at: row.awarded_at })),
    ...purchases.rows.map((row) => ({ kind: 'purchase', label: SHOP_ITEM_NAMES[row.product_id] || row.product_id, detail: null, miles: -Number(row.cost), at: row.purchased_at }))
  ];
  entries.sort((a, b) => new Date(b.at) - new Date(a.at));
  return entries.slice(0, 12);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const pilot = await verifyDiscordToken(req.headers.authorization);
  if (!pilot) return json(res, 401, { error: 'Sign in with Discord to view your profile.' });

  try {
    await ensureSchema();
    const account = await upsertAccount(pilot.id, pilot.name);
    const miles = Number(account.miles);
    return json(res, 200, {
      user: { name: pilot.name, avatar: pilot.avatar },
      skywardsNumber: account.skywards_number,
      miles,
      tier: tierInfo(account.tier, miles),
      ledger: await recentActivity(pilot.id)
    });
  } catch (error) {
    if (error.code === 'DB_NOT_CONFIGURED' || /DATABASE_URL/.test(error.message)) {
      return json(res, 503, { error: 'The miles service is not configured yet.' });
    }
    console.error('GET /api/profile failed:', error);
    return json(res, 502, { error: 'Could not reach the miles database.' });
  }
};
