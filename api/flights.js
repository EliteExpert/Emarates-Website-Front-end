// Vercel serverless function: same-origin proxy for the live flight schedule.
//   GET /api/flights -> the flight list served by the Emirates PTFS FIDS app
//                        (https://emirates-ptfs-fids.onrender.com), the data
//                      behind its /departures board.
// The FIDS API sends no CORS headers, so browsers cannot call it directly
// from this site's origin; this function fetches it server-side instead.
const FIDS_ENDPOINT = 'https://emirates-ptfs-fids.onrender.com/api/flights';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  try {
    const upstream = await fetch(FIDS_ENDPOINT, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    if (!upstream.ok) throw new Error(`FIDS responded with ${upstream.status}`);
    const flights = await upstream.json();
    // Cache briefly at the CDN edge so the free-tier Render service is not
    // hammered by every visitor refresh.
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return json(res, 200, flights);
  } catch (error) {
    console.error('GET /api/flights failed:', error);
    return json(res, 502, { error: 'The flight board is unreachable right now.' });
  }
};
