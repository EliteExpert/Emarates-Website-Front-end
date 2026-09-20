// Vercel serverless function: the iCe flight quiz.
//   GET  /api/quiz  -> { questions: [{ q, options[3], answer }] }
//   POST /api/quiz  -> admin-only (Discord role check); replaces the quiz.
// Requires BLOB_READ_WRITE_TOKEN (from a Blob store linked to the project)
// and QUIZ_ADMIN_ROLE_IDS (comma-separated Discord role IDs) for authoring.
const { put, list } = require('@vercel/blob');

const DISCORD_API = 'https://discord.com/api/v9';
const QUIZ_PATH = 'ice/quiz.json';
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || '1294732873143685160';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function sanitizeQuestions(input) {
  if (!Array.isArray(input)) return null;
  const questions = input
    .map((entry) => {
      if (!entry || typeof entry.q !== 'string' || !Array.isArray(entry.options)) return null;
      const options = entry.options.filter((option) => typeof option === 'string' && option.trim()).slice(0, 3);
      if (!entry.q.trim() || options.length < 2) return null;
      const answer = Number(entry.answer);
      if (!(answer >= 0 && answer < options.length)) return null;
      return { q: entry.q.trim().slice(0, 200), options: options.map((option) => option.trim().slice(0, 120)), answer };
    })
    .filter(Boolean)
    .slice(0, 40);
  return questions.length ? questions : null;
}

async function readQuiz() {
  const { blobs } = await list({ prefix: QUIZ_PATH, limit: 1 });
  const entry = blobs.find((blob) => blob.pathname === QUIZ_PATH);
  if (!entry) return null;
  const response = await fetch(entry.url, { cache: 'no-store' });
  if (!response.ok) return null;
  return sanitizeQuestions(await response.json());
}

function adminRoleIds() {
  return (process.env.QUIZ_ADMIN_ROLE_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
}

async function verifyAdmin(authorizationHeader) {
  if (!authorizationHeader?.startsWith('Bearer ')) return false;
  const allowed = adminRoleIds();
  if (!allowed.length) return false;
  try {
    const profile = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: authorizationHeader } });
    if (!profile.ok) return false;
    const me = await profile.json();
    const member = await fetch(`${DISCORD_API}/users/@me/guilds/${DISCORD_GUILD_ID}/member`, {
      headers: { Authorization: authorizationHeader }
    });
    if (!member.ok) return false;
    const roles = (await member.json()).roles || [];
    return allowed.some((id) => roles.includes(id));
  } catch {
    return false;
  }
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const questions = await readQuiz();
      return json(res, 200, { questions: questions || [] });
    } catch (error) {
      if (/No token found/i.test(String(error.message)) || String(error.message).includes('BLOB_READ_WRITE_TOKEN')) {
        return json(res, 503, { questions: [], error: 'Blob store is not connected.' });
      }
      console.error('GET /api/quiz failed:', error);
      return json(res, 500, { error: 'Could not load the quiz.' });
    }
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      return json(res, 400, { error: 'Invalid JSON body.' });
    }
    const questions = sanitizeQuestions(body?.questions);
    if (!questions) return json(res, 400, { error: 'Provide at least one valid question.' });

    if (!(await verifyAdmin(req.headers.authorization))) {
      return json(res, 403, { error: 'Only select roles and admins can prepare the quiz.' });
    }

    try {
      await put(QUIZ_PATH, JSON.stringify(questions), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
        cacheControlMaxAge: 0
      });
      return json(res, 200, { questions, saved: true });
    } catch (error) {
      if (/No token found/i.test(String(error.message)) || String(error.message).includes('BLOB_READ_WRITE_TOKEN')) {
        return json(res, 503, { error: 'Blob store is not connected to this deployment.' });
      }
      console.error('POST /api/quiz failed:', error);
      return json(res, 500, { error: 'Could not save the quiz.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { error: 'Method not allowed.' });
};
