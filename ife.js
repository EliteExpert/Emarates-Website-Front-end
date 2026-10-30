// ife.js — Emarates ICE, built on the real seat-back photo.
// The seat picture is the base; the functional screen is overlaid exactly
// on the display area. Unlocked only while an FIDS flight is airborne,
// Discord login required, quiz authored by select roles and admins.

const IFE_CONFIG = {
    seat: 46,                       // seat number shown in the white bar
    cruiseSpeedKmh: 902,
    // Role IDs allowed to author the flight quiz (paste from Discord)
    quizAdminRoleIds: [],           // e.g. ['1416276747246244013']
    // Class dining is picked from these roles; highest wins
    // (First > Charter > Business > Economy as fallback).
    firstClassRoleIds: ['1331853227720708146'],
    charterRoleIds: [],
    businessClassRoleIds: ['1331852990629417020']
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

const IFE_MENUS = {
    Economy: {
        label: 'Economy class Dining',
        courses: [
            { name: 'Starters', items: ['Garden Salad with Vinaigrette', 'Lentil Soup'] },
            { name: 'Main Course', items: ['Butter Chicken with Basmari Rice', 'Vegetable Lasagna', 'Grilled Chicken with Mashed Potatoes'] },
            { name: 'Desserts', items: ['Chocolate Brownie', 'Fruit Cup', 'Mini Cheesecake'] },
            { name: 'Beverages', items: ['Water, Soft Drinks, Juices', 'Tea & Coffee'] }
        ]
    },
    Business: {
        label: 'Business class Dining',
        courses: [
            { name: 'Starters', items: ['Mediterranean Mezze Platter', 'Caesar Salad with Grilled Chicken', 'Lentil & Carrot Soup'] },
            { name: 'Main Course', items: ['Truffle Mushroom Pasta', 'Chicken Biryani with Raita', 'Pan-seared Salmon with Lemon Butter Sauce'] },
            { name: 'Desserts', items: ['Tiramisu', 'Pistachio Mousse', 'Chocolate Éclair'] },
            { name: 'Beverages', items: ['Soft Drinks, Fruit Juices', 'Mocktails & Iced Coffee', 'Selection of Teas & Coffees'] }
        ]
    },
    First: {
        label: 'First class Dining',
        courses: [
            { name: 'Starters', items: ['Caviar with Blinis & Crème Fraîche', 'Smoked Salmon Platter with Capers', 'Truffle-infused Mushroom Soup'] },
            { name: 'Main Course', items: ['Wagyu Beef Tenderloin with Red Wine Jus', 'Lobster Thermidor', 'Grilled Vegetable Wellington'] },
            { name: 'Desserts', items: ['Belgian Chocolate Soufflé', 'Classic Crème Brûlée', 'Fruit Tart with Vanilla Cream'] },
            { name: 'Beverages', items: ['Vintage Wines & Champagne', 'Arabic Coffee & Specialty Teas', 'Freshly Squeezed Juices & Signature Mocktails'] }
        ]
    },
    Charter: {
        label: 'Private Charter',
        courses: [
            { name: 'On demand', items: ['Bespoke menu designed with the crew before departure', 'Any course, any time — the cabin is yours'] },
            { name: 'Cellar', items: ['Champagne, rare wines and tailored mocktails'] }
        ]
    }
};

const IFE_CONTACTS = [
    { icon: 'fab fa-discord', name: 'Emirates PTFS Server', detail: 'News, events and support', href: 'https://discord.gg/PJVAvbJbdn' },
    { icon: 'fas fa-robot', name: 'Applications Bot', detail: 'Careers and cabin applications', href: 'https://discord.gg/PJVAvbJbdn' },
    { icon: 'fas fa-plane-departure', name: 'Flight Operations', detail: 'Weekly schedule and clearances', href: 'https://discord.gg/PJVAvbJbdn' },
    { icon: 'fas fa-headset', name: 'Cabin Crew', detail: 'Call for anything on board', href: 'https://discord.gg/PJVAvbJbdn' }
];

const ifeRoot = document.getElementById('ife-root');
let ifeFlights = [];
let ifeQuiz = null;
let ifeActive = null;

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

// For arrivals the filed airport is the origin and the destination is
// always Dubai; departures are the mirror image.
function ifeRouteEndpoints(flight) {
    const city = ifeDestinationCity(flight);
    return flight.type === 'departure'
        ? { from: 'Dubai', to: city }
        : { from: city, to: 'Dubai' };
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

function ifeClassForRoles(roles) {
    const has = (list) => (list || []).some((id) => roles?.includes(id));
    if (has(IFE_CONFIG.firstClassRoleIds)) return 'First';
    if (has(IFE_CONFIG.charterRoleIds)) return 'Charter';
    if (has(IFE_CONFIG.businessClassRoleIds)) return 'Business';
    return 'Economy';
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
                <div class="ice-topbar">
                    <span class="ice-logo-red">Emarates</span>
                    <span class="ice-topbar-route">
                        <span id="ice-topbar-flight">Emarates ICE</span>
                    </span>
                    <span class="ice-topbar-duration"><i class="fas fa-clock"></i> 1hr flight</span>
                </div>
                <div class="ice-body" id="ice-body"></div>
            </div>
        </div>
        <p class="result-count ice-note" id="ice-note" aria-live="polite"></p>
    `;
}

function iceTopbarUpdate(flight) {
    const element = document.getElementById('ice-topbar-flight');
    if (!element || !flight) return;
    const { from, to } = ifeRouteEndpoints(flight);
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
                <a class="ice-mini-btn" href="https://discord.gg/PJVAvbJbdn" target="_blank" rel="noopener">Join Discord</a>
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
                    <li><span>Real route</span><strong>${ifeEscape(ifeRouteEndpoints(flight).from)} <i class="fas fa-long-arrow-alt-right"></i> ${ifeEscape(ifeRouteEndpoints(flight).to)}</strong></li>
                    <li><span>Duration</span><strong>1hr</strong></li>
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
                        <button class="ice-btn ice-btn-i" type="button" data-ice="i" aria-label="Information"${user ? '' : ' disabled'}><span>i</span></button>
                        <em>Information</em>
                    </div>
                    <div class="ice-btn-wrap">
                        <button class="ice-btn ice-btn-c" type="button" data-ice="c" aria-label="Communication"${user ? '' : ' disabled'}><span>C</span></button>
                        <em>Communication</em>
                    </div>
                    <div class="ice-btn-wrap">
                        <button class="ice-btn ice-btn-e" type="button" data-ice="e" aria-label="Entertainment"${user ? '' : ' disabled'}><span>e</span></button>
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
    // The map box is 1177x657, so vertical percentages are relative to a
    // different scale than horizontal ones — convert before the trig.
    const MAP_AR = 1177 / 657;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lineLength = Math.hypot(dx, dy / MAP_AR);
    const lineAngle = Math.atan2(dy / MAP_AR, dx);
    return `
        <div class="ice-map${mini ? ' ice-map-mini' : ''}"${mini ? ' data-ice-map-mini' : ''}>
            <div class="ice-map-img" style="background-image:url('assets/photos/ptfs-map.png')">
                <span class="ice-map-dot" style="left:${from.x}%;top:${from.y}%"></span>
                <span class="ice-map-dot" style="left:${to.x}%;top:${to.y}%"></span>
                <span class="ice-map-line" style="left:${from.x}%;top:${from.y}%;width:${lineLength.toFixed(2)}%;transform:rotate(${lineAngle}rad);transform-origin:0 0"></span>
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
                <li><span>Route</span><strong>${ifeEscape(ifeRouteEndpoints(flight).from)} to ${ifeEscape(ifeRouteEndpoints(flight).to)}</strong></li>
                <li><span>PTFS route</span><strong>${ifeEscape(flight.ptfsDeparture || '—')} to ${ifeEscape(flight.ptfsArrival || '—')}</strong></li>
                <li><span>Duration</span><strong>1hr</strong></li>
                <li><span>Aircraft</span><strong>${ifeEscape(flight.aircraft || 'A380-800')}</strong></li>
                <li><span>Terminal</span><strong>${ifeEscape(flight.terminal || 'T3')}</strong></li>
            </ul>
            <div class="ice-map-large" id="ice-map-large">${iceMapSvg(flight, state, false)}</div>
            <p class="ice-map-hint">Map of the PTFS route.</p>
        </div>
    `;
}

async function iceCommsPanel(flight) {
    const roles = await ifeFetchMemberRoles();
    const cabin = ifeClassForRoles(roles);
    const menu = IFE_MENUS[cabin];
    return `
        <div class="ice-panel">
            <h4><i class="fas fa-utensils"></i> ${ifeEscape(menu.label)}</h4>
            <div class="ice-menu">
                ${menu.courses.map((course) => `
                    <div class="ice-course">
                        <h4>${ifeEscape(course.name)}</h4>
                        <ul>${course.items.map((item) => `<li>${ifeEscape(item)}</li>`).join('')}</ul>
                    </div>`).join('')}
            </div>
        </div>
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
            ${await iceCommsPanel(active.flight)}`;
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

    // Login can land back on this page with the token still in the URL;
    // script.js settles it after DOMContentLoaded and announces the change,
    // so the disabled buttons can enable without a manual reload.
    window.addEventListener('discord-auth-changed', () => {
        if (!document.querySelector('#ice-body .ice-buttons')) return;
        const freshUser = typeof getDiscordUser === 'function' ? getDiscordUser() : null;
        iceRenderSection('home', ifeActive, freshUser);
    });

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
    ifeActive = airborne[0] || null;

    if (ifeActive) iceTopbarUpdate(ifeActive.flight);
    await iceRenderSection('home', ifeActive, user);
}

initIfe();
