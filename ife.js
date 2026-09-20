// ife.js — Emarates ICE, built on the real seat-back photo.
// The seat picture is the base; the functional screen is overlaid exactly
// on the display area. Unlocked only while an FIDS flight is airborne,
// Discord login required, quiz authored by select roles and admins.

const IFE_CONFIG = {
    seat: 46,                       // seat number shown in the white bar
    cruiseSpeedKmh: 902,
    // Role IDs allowed to author the flight quiz (paste from Discord)
    quizAdminRoleIds: [],           // e.g. ['1416276747246244013']
    firstClassRoleIds: [],
    businessClassRoleIds: []
};

// The PTFS world — departure/arrival must come from these airports,
// positioned on our map (percentages of the map image).
const PTFS_AIRPORTS = {
    'Orenji':           { x: 42.9, y: 14.6 },
    'Perth':            { x: 61.4, y: 26.8 },
    'Grindavik':        { x: 24.4, y: 45.1 },
    'Izolirani':        { x: 77.7, y: 53.6 },
    'Mellor':           { x: 38.2, y: 66.2 },
    'Greater Rockford': { x: 48.9, y: 73.4 },
    'Sauthemptona':     { x: 22.3, y: 79.5 },
    'Larcana':          { x: 63.7, y: 86.9 },
    'Phapos':           { x: 70.3, y: 90.1 }
};

// Default quiz; admins can replace it via the editor (stored on Vercel Blob)
const IFE_DEFAULT_QUIZ = [
    { q: 'What does PTFS stand for?', options: ['Pilot Training Flight Simulator', 'Private Terminal Flight System', 'Pilot Test Flight School'], answer: 0 },
    { q: 'Which aircraft is nicknamed the Queen of the Skies?', options: ['A380', 'Boeing 747', 'Concorde'], answer: 1 },
    { q: 'What color is the Emirates tail fin?', options: ['Green', 'Blue', 'Red'], answer: 2 },
    { q: 'DXB is which airport?', options: ['Dubai International', 'Doha Hamad', 'Dammam'], answer: 0 },
    { q: 'Who welcomes you aboard with "Ahlan wa Sahlan"?', options: ['The captain only', 'The cabin crew', 'Ground staff'], answer: 1 }
];

const IFE_CONTACTS = [
    { icon: 'fab fa-discord', name: 'Emirates PTFS Server', detail: 'News, events and support', href: 'https://discord.gg/PJVAvbJbdn' },
    { icon: 'fas fa-robot', name: 'Applications Bot', detail: 'Careers and cabin applications', href: 'https://discord.gg/PJVAvbJbdn' },
    { icon: 'fas fa-plane-departure', name: 'Flight Operations', detail: 'Weekly schedule and clearances', href: 'https://discord.gg/PJVAvbJbdn' },
    { icon: 'fas fa-headset', name: 'Cabin Crew', detail: 'Call for anything on board', href: 'https://discord.gg/PJVAvbJbdn' }
];

const ifeRoot = document.getElementById('ife-root');
let ifeFlights = [];
let ifeQuiz = null;

function ifeEscape(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
}

function ifeDurationMinutes() {
    // The Emarates experience is a 1hr flight, always.
    return 60;
}

function ifeFlightState(flight) {
    const start = flight.scheduledTs;
    const end = start + ifeDurationMinutes() * 60000;
    const now = Date.now();
    if (now < start) return { state: 'before', minutesToStart: Math.round((start - now) / 60000), end };
    if (now < end) return { state: 'airborne', progress: (now - start) / (end - start), end };
    return { state: 'arrived' };
}

function ifeNextFlight() {
    return ifeFlights
        .map((flight) => ({ flight, state: ifeFlightState(flight) }))
        .filter((entry) => entry.state.state === 'before')
        .sort((a, b) => a.flight.scheduledTs - b.flight.scheduledTs)[0] || null;
}

function ifeDestinationCity(flight) {
    // "Dubai to Sydney" — strip any (XXX) code and take the city part
    return String(flight.destination || '')
        .replace(/\s*\([A-Z]{3}\)\s*$/, '')
        .trim() || 'Dubai';
}

async function ifeFetchMemberRoles() {
    const stored = (() => {
        try { return JSON.parse(localStorage.getItem(OAUTH_STORE_KEY)); }
        catch { return null; }
    })();
    if (!stored?.token || stored.expires_at <= Date.now()) return null;
    try {
        const response = await fetch(`https://discord.com/api/v9/users/@me/guilds/${DISCORD_GUILD_ID}/member`, {
            headers: { Authorization: `Bearer ${stored.token}` }
        });
        if (!response.ok) return null;
        return (await response.json()).roles || [];
    } catch {
        return null;
    }
}

function ifeIsQuizAdmin(roles) {
    return IFE_CONFIG.quizAdminRoleIds.some((id) => roles?.includes(id));
}

async function ifeLoadQuiz() {
    if (ifeQuiz) return ifeQuiz;
    try {
        const response = await fetch('/api/quiz');
        if (response.ok) {
            const body = await response.json();
            if (Array.isArray(body.questions) && body.questions.length) {
                ifeQuiz = body.questions;
                return ifeQuiz;
            }
        }
    } catch { /* offline / not on Vercel */ }
    ifeQuiz = IFE_DEFAULT_QUIZ;
    return ifeQuiz;
}

/* ---------- Screen chrome (over the seat photo) ---------- */

function iceShell() {
    ifeRoot.innerHTML = `
        <div class="ife-seat-base">
            <img class="ife-photo" src="assets/photos/seat-back-base.png" alt="Your Emirates seat back with the Emarates ICE screen">
            <div class="ife-screen-overlay">
                <header class="ice-topbar">
                    <span class="ice-logo-red">Emarates</span>
                    <span class="ice-topbar-route">
                        <strong>${IFE_CONFIG.seat}A</strong>
                        <span id="ice-topbar-flight">Emarates ICE</span>
                    </span>
                    <span class="ice-topbar-duration"><i class="fas fa-clock"></i> 1hr flight</span>
                </header>
                <div class="ice-body" id="ice-body"></div>
            </div>
        </div>
        <p class="result-count ice-note" id="ice-note" aria-live="polite"></p>
    `;
}

function iceTopbarUpdate(flight) {
    const element = document.getElementById('ice-topbar-flight');
    if (!element || !flight) return;
    const isDeparture = flight.type === 'departure';
    const from = isDeparture ? 'Dubai' : ifeDestinationCity(flight);
    const to = isDeparture ? ifeDestinationCity(flight) : 'Dubai';
    element.innerHTML = `<strong>${ifeEscape(flight.flightNumber)}</strong> ${ifeEscape(from)} to ${ifeEscape(to)}`;
}

/* ---------- Welcome (home) view ---------- */

function iceWelcomeView(active, user) {
    let sideBox;
    if (!user) {
        sideBox = `
            <div class="ice-side-empty">
                <i class="fas fa-user-lock"></i>
                <p>Log in with Discord to use the ICE system.</p>
                <a class="ice-mini-btn" href="index.html#gallery-tool">How to log in</a>
            </div>`;
    } else if (!active) {
        const next = ifeNextFlight();
        sideBox = `
            <div class="ice-side-empty">
                <i class="fas fa-plane-up"></i>
                <p><strong>ICE starts after departure.</strong> It is available only during the flight.</p>
                ${next ? `<p class="ice-countdown">Next: <strong>${ifeEscape(next.flight.flightNumber)}</strong> in ${Math.floor(next.state.minutesToStart / 60)}h ${next.state.minutesToStart % 60}m</p>` : ''}
            </div>`;
    } else {
        const flight = active.flight;
        sideBox = `
            <div class="ice-side-info">
                <h4><i class="fas fa-route"></i> Now flying</h4>
                <p class="ice-side-route">${ifeEscape(flight.ptfsDeparture || 'PTFS')} <i class="fas fa-long-arrow-alt-right"></i> ${ifeEscape(flight.ptfsArrival || 'PTFS')}</p>
                <div class="ice-minimap" id="ice-minimap" title="Click to enlarge the map">${iceMapSvg(flight, active.state, true)}</div>
                <ul>
                    <li><span>Real route</span><strong>Dubai <i class="fas fa-long-arrow-alt-right"></i> ${ifeEscape(ifeDestinationCity(flight))}</strong></li>
                    <li><span>Duration</span><strong>1hr</strong></li>
                    <li><span>Status</span><strong>${ifeEscape(flight.status)}</strong></li>
                </ul>
            </div>`;
    }

    return `
        <div class="ice-welcome">
            <div class="ice-welcome-inner">
                <h1 class="ice-welcome-title">Welcome</h1>
                <p class="ice-welcome-select">Select to begin…</p>
                <div class="ice-buttons">
                    <div class="ice-btn-wrap">
                        <button class="ice-btn ice-btn-i" type="button" data-ice="i" aria-label="Information"><span>i</span></button>
                        <em>Information</em>
                    </div>
                    <div class="ice-btn-wrap">
                        <button class="ice-btn ice-btn-c" type="button" data-ice="c" aria-label="Communication"><span>C</span></button>
                        <em>Communication</em>
                    </div>
                    <div class="ice-btn-wrap">
                        <button class="ice-btn ice-btn-e" type="button" data-ice="e" aria-label="Entertainment"><span>e</span></button>
                        <em>Entertainment</em>
                    </div>
                </div>
            </div>
            <aside class="ice-sidebox" id="ice-sidebox">${sideBox}</aside>
        </div>
    `;
}

function iceMapSvg(flight, state, mini = false) {
    const fromName = String(flight.ptfsDeparture || '').trim();
    const toName = String(flight.ptfsArrival || '').trim();
    const from = PTFS_AIRPORTS[fromName];
    const to = PTFS_AIRPORTS[toName];
    if (!from || !to) {
        return `<div class="ice-map-missing">PTFS route not filed for this flight.</div>`;
    }
    const progress = Math.min(0.98, Math.max(0.02, state?.progress ?? 0));
    const px = from.x + (to.x - from.x) * progress;
    const py = from.y + (to.y - from.y) * progress;
    return `
        <div class="ice-map${mini ? ' ice-map-mini' : ''}"${mini ? ' data-ice-map-mini' : ''}>
            <div class="ice-map-img" style="background-image:url('assets/photos/ptfs-map.png')">
                <span class="ice-map-dot" style="left:${from.x}%;top:${from.y}%"></span><em class="ice-map-label" style="left:${from.x}%;top:${from.y}%">${ifeEscape(fromName)}</em>
                <span class="ice-map-dot" style="left:${to.x}%;top:${to.y}%"></span><em class="ice-map-label" style="left:${to.x}%;top:${to.y}%">${ifeEscape(toName)}</em>
                <span class="ice-map-line" style="left:${from.x}%;top:${from.y}%;width:${Math.hypot(to.x - from.x, to.y - from.y)}%;transform:rotate(${Math.atan2(to.y - from.y, to.x - from.x)}rad);transform-origin:0 0"></span>
                ${state?.state === 'airborne' ? `<i class="fas fa-plane ice-map-plane" style="left:${px}%;top:${py}%;transform:translate(-50%,-50%) rotate(${Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI + 90}deg)"></i>` : ''}
            </div>
        </div>
    `;
}

/* ---------- Section panels ---------- */

function iceInfoPanel(flight, state) {
    const isDeparture = flight.type === 'departure';
    return `
        <div class="ice-panel">
            <h4><i class="fas fa-plane"></i> Flight information</h4>
            <ul class="ice-info-list">
                <li><span>Flight</span><strong>${ifeEscape(flight.flightNumber)}</strong></li>
                <li><span>Route</span><strong>${isDeparture ? 'Dubai' : ifeEscape(ifeDestinationCity(flight))} to ${isDeparture ? ifeEscape(ifeDestinationCity(flight)) : 'Dubai'}</strong></li>
                <li><span>PTFS route</span><strong>${ifeEscape(flight.ptfsDeparture || '—')} to ${ifeEscape(flight.ptfsArrival || '—')}</strong></li>
                <li><span>Duration</span><strong>1hr</strong></li>
                <li><span>Aircraft</span><strong>${ifeEscape(flight.aircraft || 'A380-800')}</strong></li>
                <li><span>Terminal</span><strong>${ifeEscape(flight.terminal || 'T3')}</strong></li>
                <li><span>Status</span><strong>${ifeEscape(flight.status)}</strong></li>
            </ul>
            <div class="ice-map-large" id="ice-map-large">${iceMapSvg(flight, state, false)}</div>
            <p class="ice-map-hint">Live map of the PTFS route — the aircraft marker follows the flight.</p>
        </div>
    `;
}

function iceCommsPanel() {
    return `
        <div class="ice-panel">
            <h4><i class="fas fa-satellite-dish"></i> Communication</h4>
            <div class="ice-contacts">
                ${IFE_CONTACTS.map((contact) => `
                    <a class="ice-contact" href="${contact.href}" target="_blank" rel="noopener">
                        <i class="${contact.icon}"></i>
                        <span><strong>${ifeEscape(contact.name)}</strong><em>${ifeEscape(contact.detail)}</em></span>
                        <i class="fas fa-chevron-right"></i>
                    </a>`).join('')}
            </div>
        </div>
    `;
}

async function iceEntertainmentPanel() {
    const questions = await ifeLoadQuiz();
    const roles = await ifeFetchMemberRoles();
    const isAdmin = ifeIsQuizAdmin(roles) && !!getDiscordOauthToken();
    return `
        <div class="ice-panel">
            <h4><i class="fas fa-gamepad"></i> Flight quiz
                ${isAdmin ? '<button class="ice-mini-btn" type="button" id="ice-quiz-edit">Edit quiz</button>' : ''}
            </h4>
            <div class="ice-quiz" id="ice-quiz">
                ${iceQuizQuestionHtml(questions, 0, 0)}
            </div>
            ${isAdmin ? `
            <div class="ice-quiz-editor" id="ice-quiz-editor" hidden>
                <p class="gallery-tool-note">One question per line: <code>question | option A | option B | option C | correct (1-3)</code></p>
                <textarea id="ice-quiz-text" rows="8">${ifeEscape(ifeQuiz.map((q) => [q.q, ...q.options, q.answer + 1].join(' | ')).join('\n'))}</textarea>
                <button class="ice-mini-btn" type="button" id="ice-quiz-save"><i class="fas fa-save"></i> Save quiz for everyone</button>
                <span id="ice-quiz-status"></span>
            </div>` : ''}
        </div>
    `;
}

function iceQuizQuestionHtml(questions, index, score) {
    if (index >= questions.length) {
        return `
            <div class="ice-quiz-done">
                <i class="fas fa-trophy"></i>
                <p>You scored <strong>${score}/${questions.length}</strong> — ${score === questions.length ? 'a perfect flight!' : 'thanks for playing.'}</p>
                <button class="ice-mini-btn" type="button" data-quiz-restart><i class="fas fa-rotate-left"></i> Play again</button>
            </div>`;
    }
    const question = questions[index];
    return `
        <div class="ice-quiz-q">
            <span class="ice-quiz-step">Question ${index + 1} of ${questions.length} · score ${score}</span>
            <p>${ifeEscape(question.q)}</p>
            <div class="ice-quiz-options">
                ${(question.options || []).map((option, optionIndex) => `
                    <button type="button" data-option="${optionIndex}">${ifeEscape(option)}</button>`).join('')}
            </div>
        </div>`;
}

function iceBindQuiz() {
    const container = document.getElementById('ice-quiz');
    if (!container) return;
    let index = 0, score = 0;
    const questions = ifeQuiz;

    container.addEventListener('click', async (event) => {
        const restart = event.target.closest('[data-quiz-restart]');
        if (restart) { index = 0; score = 0; container.innerHTML = iceQuizQuestionHtml(questions, index, score); return; }
        const option = event.target.closest('[data-option]');
        if (!option) return;
        const chosen = Number(option.dataset.option);
        const correct = questions[index].answer === chosen;
        option.classList.add(correct ? 'correct' : 'wrong');
        if (correct) score += 1;
        await new Promise((resolve) => setTimeout(resolve, 650));
        index += 1;
        container.innerHTML = iceQuizQuestionHtml(questions, index, score);
    });

    const editButton = document.getElementById('ice-quiz-edit');
    if (editButton) editButton.addEventListener('click', () => {
        const editor = document.getElementById('ice-quiz-editor');
        if (editor) editor.hidden = !editor.hidden;
    });
    const saveButton = document.getElementById('ice-quiz-save');
    if (saveButton) saveButton.addEventListener('click', async () => {
        const status = document.getElementById('ice-quiz-status');
        const text = document.getElementById('ice-quiz-text').value.trim();
        const parsed = text.split('\n').map((line) => {
            const parts = line.split('|').map((part) => part.trim());
            if (parts.length < 5) return null;
            const answer = Number(parts[4]) - 1;
            if (!parts[0] || !parts[1] || !parts[2] || !parts[3] || !(answer >= 0 && answer <= 2)) return null;
            return { q: parts[0], options: [parts[1], parts[2], parts[3]], answer };
        }).filter(Boolean);
        if (!parsed.length) {
            if (status) status.textContent = 'Nothing valid to save — check the format.';
            return;
        }
        try {
            const response = await fetch('/api/quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getDiscordOauthToken()}` },
                body: JSON.stringify({ questions: parsed })
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
            ifeQuiz = parsed;
            index = 0; score = 0;
            container.innerHTML = iceQuizQuestionHtml(questions, 0, 0);
            if (status) status.textContent = 'Saved — everyone sees this quiz now.';
        } catch (error) {
            if (status) status.textContent = `Save failed: ${error.message}`;
        }
    });
}

/* ---------- Section rendering ---------- */

async function iceRenderSection(section, active, user) {
    const body = document.getElementById('ice-body');
    if (!body) return;

    if (section === 'home' || !active) {
        body.innerHTML = iceWelcomeView(active, user);
        body.querySelectorAll('[data-ice]').forEach((button) => {
            button.addEventListener('click', () => {
                if (!active) {
                    const note = document.getElementById('ice-note');
                    if (note) note.textContent = 'ICE unlocks when a flight is in the air.';
                    return;
                }
                iceRenderSection(button.dataset.ice, active, user);
            });
        });
        return;
    }

    if (section === 'i') {
        body.innerHTML = `
            <div class="ice-section-head">
                <button class="ice-mini-btn" type="button" data-ice="home"><i class="fas fa-arrow-left"></i> Welcome</button>
                <h3>Information</h3>
            </div>
            ${iceInfoPanel(active.flight, active.state)}`;
    } else if (section === 'c') {
        body.innerHTML = `
            <div class="ice-section-head">
                <button class="ice-mini-btn" type="button" data-ice="home"><i class="fas fa-arrow-left"></i> Welcome</button>
                <h3>Communication</h3>
            </div>
            ${iceCommsPanel()}`;
    } else {
        body.innerHTML = `
            <div class="ice-section-head">
                <button class="ice-mini-btn" type="button" data-ice="home"><i class="fas fa-arrow-left"></i> Welcome</button>
                <h3>Entertainment</h3>
            </div>
            ${await iceEntertainmentPanel()}`;
        iceBindQuiz();
    }

    body.querySelectorAll('[data-ice]').forEach((button) => {
        button.addEventListener('click', () => iceRenderSection(button.dataset.ice, active, user));
    });

    const miniMap = body.querySelector('[data-ice-map-mini]');
    if (miniMap) {
        miniMap.style.cursor = 'zoom-in';
        miniMap.addEventListener('click', () => {
            const large = body.querySelector('#ice-map-large');
            if (large) large.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }
}

/* ---------- Boot ---------- */

async function initIfe() {
    if (!ifeRoot) return;

    iceShell();
    const user = typeof getDiscordUser === 'function' ? getDiscordUser() : null;

    try {
        ifeFlights = await fetchWeeklyFlights();
    } catch (error) {
        await iceRenderSection('home', null, user);
        const note = document.getElementById('ice-note');
        if (note) note.textContent = 'The flight data service is unreachable right now.';
        return;
    }

    const airborne = ifeFlights
        .map((flight) => ({ flight, state: ifeFlightState(flight) }))
        .filter((entry) => entry.state.state === 'airborne')
        .sort((a, b) => b.flight.scheduledTs - a.flight.scheduledTs);
    const active = airborne[0] || null;

    if (active) iceTopbarUpdate(active.flight);
    await iceRenderSection('home', active, user);

    if (active) {
        // Keep the aircraft marker moving on the PTFS map while aboard
        setInterval(() => {
            const state = ifeFlightState(active.flight);
            if (state.state !== 'airborne') return;
            const from = PTFS_AIRPORTS[String(active.flight.ptfsDeparture || '').trim()];
            const to = PTFS_AIRPORTS[String(active.flight.ptfsArrival || '').trim()];
            if (!from || !to) return;
            const px = from.x + (to.x - from.x) * state.progress;
            const py = from.y + (to.y - from.y) * state.progress;
            document.querySelectorAll('.ice-map-plane').forEach((plane) => {
                plane.style.left = `${px}%`;
                plane.style.top = `${py}%`;
            });
        }, 30 * 1000);
    }
}

initIfe();
