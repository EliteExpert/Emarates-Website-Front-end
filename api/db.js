// Shared Postgres access for the Skywards miles API functions.
// Reads DATABASE_URL from the Vercel project environment variables.
//
// IMPORTANT: Railway's postgres.railway.internal hostname only resolves
// inside Railway's private network, so Vercel functions cannot reach it.
// Set DATABASE_URL to the Postgres public TCP proxy URL shown in the
// Railway dashboard (Postgres service -> Settings -> Networking).
//
// The schema is the one owned by the Emirates-Skywards Discord bot
// (github.com/EliteExpert/Emirates-Skywards): accounts, awards,
// flight_awards, purchases, ... The website only reads/writes the subset
// below and never changes tiers — upgrades happen in Discord, where the
// bot deducts miles and syncs roles.
const { Pool } = require('pg');
const crypto = require('node:crypto');

// Mirrors the bot's src/config.js so both sides reward identically.
const TIERS = ['Blue', 'Silver', 'Gold', 'Platinum'];
const TIER_BONUS_PERCENTAGES = { Blue: 0, Silver: 30, Gold: 75, Platinum: 100 };
const TIER_MULTIPLIERS = Object.fromEntries(
  Object.entries(TIER_BONUS_PERCENTAGES).map(([tier, bonus]) => [tier, 1 + bonus / 100])
);
const TIER_UPGRADE_COSTS = { Blue: 0, Silver: 1500, Gold: 3500, Platinum: 7000 };
const CLASS_MULTIPLIERS = { Economy: 1, 'Premium Economy': 1.25, Business: 2, First: 3 };
const TRAVEL_CLASS_ROLE_IDS = {
  Economy: '1295736936299757568',
  Business: '1331852990629417020',
  First: '1331853227720708146'
};
const SHOP_ITEM_NAMES = {
  priority_boarding: 'Priority Boarding',
  lounge_access: 'Lounge Access',
  extra_baggage: 'Extra Baggage',
  upgrade_voucher: 'Upgrade Voucher'
};

let pool = null;
let schemaReady = null;

function normalizeDatabaseUrl(value) {
  return value.startsWith('postgres://') ? `postgresql://${value.slice('postgres://'.length)}` : value;
}

function getPool() {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) {
    const error = new Error('DATABASE_URL is not configured.');
    error.code = 'DB_NOT_CONFIGURED';
    throw error;
  }
  const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);
  pool = new Pool({
    connectionString,
    max: 3,
    // The bot only enables SSL for sslmode=require URLs; mirror that so
    // internal (non-SSL) connection strings keep working if this function
    // ever moves into Railway.
    ssl: /[?&]sslmode=require(?:&|$)/.test(connectionString) ? { rejectUnauthorized: false } : undefined
  });
  return pool;
}

// Used by the local test harness to swap in an in-memory database.
function setPool(override) { pool = override; }

// The website only needs the two tables it touches; the bot owns the rest.
// CREATE TABLE without IF NOT EXISTS plus an "already exists" swallow keeps
// the DDL identical to the bot's schema while staying idempotent.
async function ensureTable(ddl) {
  try {
    await getPool().query(ddl);
  } catch (error) {
    if (error.code !== '42P07' && !/already exists/i.test(String(error.message))) throw error;
  }
}

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await ensureTable(`
        CREATE TABLE accounts (
          user_id BIGINT PRIMARY KEY,
          display_name TEXT NOT NULL,
          skywards_number TEXT NOT NULL UNIQUE,
          tier TEXT NOT NULL DEFAULT 'Blue',
          miles BIGINT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL
        )`);
      await ensureTable(`
        CREATE TABLE flight_awards (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
          miles BIGINT NOT NULL,
          flight_reference TEXT NOT NULL,
          awarded_by BIGINT NOT NULL,
          awarded_at TIMESTAMPTZ NOT NULL
        )`);
      await ensureTable(`
        CREATE TABLE external_event_awards (
          event_id BIGINT PRIMARY KEY,
          awarded_at TIMESTAMPTZ NOT NULL
        )`);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

function newSkywardsNumber() {
  return `ES-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

// Creates the member's account if the bot has not seen them yet, refreshes
// the display name, and returns the stored row.
async function upsertAccount(discordId, displayName) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await getPool().query(
      `INSERT INTO accounts (user_id, display_name, skywards_number, created_at)
       VALUES ($1::bigint, $2, $3, NOW()) ON CONFLICT (user_id) DO NOTHING`,
      [discordId, displayName, newSkywardsNumber()]
    );
    const { rows } = await getPool().query(
      'SELECT user_id, display_name, skywards_number, tier, miles FROM accounts WHERE user_id = $1::bigint',
      [discordId]
    );
    if (rows.length) {
      if (rows[0].display_name !== displayName) {
        await getPool().query('UPDATE accounts SET display_name = $2 WHERE user_id = $1::bigint', [discordId, displayName]);
        rows[0].display_name = displayName;
      }
      return rows[0];
    }
  }
  throw new Error('Could not create or load the Skywards account.');
}

// Tier metadata in the bot's economy: stored tier, its bonus percentage and
// what the next upgrade costs in miles.
function tierInfo(tierName, miles) {
  const tier = TIERS.includes(tierName) ? tierName : 'Blue';
  const index = TIERS.indexOf(tier);
  const nextTier = index + 1 < TIERS.length ? TIERS[index + 1] : null;
  const upgradeCost = nextTier ? TIER_UPGRADE_COSTS[nextTier] : 0;
  return {
    tier,
    bonusPct: TIER_BONUS_PERCENTAGES[tier],
    nextTier,
    upgradeCost,
    progressPct: nextTier ? Math.min(100, Math.round((miles / upgradeCost) * 100)) : 100
  };
}

module.exports = {
  getPool, setPool, ensureSchema, upsertAccount, tierInfo, newSkywardsNumber,
  TIERS, TIER_BONUS_PERCENTAGES, TIER_MULTIPLIERS, TIER_UPGRADE_COSTS,
  CLASS_MULTIPLIERS, TRAVEL_CLASS_ROLE_IDS, SHOP_ITEM_NAMES
};
