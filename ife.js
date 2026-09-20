// ife.js — Emarates IFE: in-flight entertainment for Emirates PTFS.
// Unlocks only while an FIDS flight is in the air, requires Discord login,
// and looks for First/Business cabin roles before loading class menus.

const IFE_CONFIG = {
    // Discord role IDs that unlock the premium class menus.
    // Right-click the role in Discord → Copy ID, then paste it here.
    firstClassRoleIds: [],      // e.g. ['1331853227720708146']
    businessClassRoleIds: [],   // e.g. ['1331852990629417020']
    charterRoleIds: [],         // Private Charter role, e.g. ['1240235507000000000']
    cruiseSpeedKmh: 902
};

// Dubai plus destinations our crews fly to (haversine distance for the real route panel)
const AIRPORT_COORDS = {
    DXB: [25.2532, 55.3657], DWC: [24.8968, 55.1614], LHR: [51.4700, -0.4543],
    LGW: [51.1537, -0.1821], JFK: [40.6413, -73.7781], EWR: [40.6895, -74.1745],
    CDG: [49.0097, 2.5479], SIN: [1.3644, 103.9915], SYD: [-33.9399, 151.1753],
    NRT: [35.7719, 140.3928], HND: [35.5494, 139.7798], JNB: [-26.1367, 28.2411],
    GRU: [-23.4356, -46.4731], LAX: [33.9416, -118.4085], BKK: [13.6900, 100.7501],
    HKG: [22.3080, 113.9185], DOH: [25.2731, 51.6080], KRK: [50.0777, 19.7848],
    ICN: [37.4602, 126.4407], FRA: [50.0379, 8.5622], MUC: [48.3538, 11.7861],
    IST: [41.2753, 28.7519], CAI: [30.1219, 31.4056], RUH: [24.9576, 46.6988],
    JED: [21.6796, 39.1565], DEL: [28.5562, 77.1000], BOM: [19.0896, 72.8656],
    CMB: [7.1808, 79.8841], MLE: [4.1918, 73.5291], ZRH: [47.4647, 8.5492],
    VIE: [48.1103, 16.5697], DUB: [53.4213, -6.2701], MAN: [53.3537, -2.2750],
    BHX: [52.4539, -1.7480], GLA: [55.8719, -4.4331], MAD: [40.4983, -3.5676],
    FCO: [41.8003, 12.2389], ATH: [37.9364, 23.9445], TLV: [32.0114, 34.8867],
    AMM: [31.7226, 35.9932], BEY: [33.8209, 35.4884], NBO: [-1.3192, 36.9278],
    LOS: [6.5774, 3.3212], ACC: [5.6052, -0.1668], DAR: [-6.8781, 39.2026],
    BAH: [26.2708, 50.6336], MCT: [23.5933, 58.2844], KWI: [29.2266, 47.9689],
    PEK: [40.0799, 116.6031], PVG: [31.1443, 121.8083], MEL: [-37.6690, 144.8410],
    AKL: [-37.0082, 174.7850], YYZ: [43.6777, -79.6248], BOS: [42.3656, -71.0096]
};

const IFE_MENUS = {
    Economy: {
        label: 'Economy Class',
        courses: [
            { name: 'To begin', items: ['Smoked chicken & rocket wrap', 'Goat cheese and roasted pepper frittata', 'Fresh seasonal fruit plate'] },
            { name: 'Main course', items: ['Herb-grilled chicken with steamed rice', 'Braised beef with root vegetable mash', 'Spinach and ricotta cannelloni'] },
            { name: 'Dessert', items: ['Chocolate fudge brownie', 'Vanilla panna cotta'] },
            { name: 'Beverages', items: ['Soft drinks & juices', 'Coffee and tea service', 'Sparkling water'] }
        ]
    },
    Business: {
        label: 'Business Class',
        courses: [
            { name: 'Canapés', items: ['Smoked salmon blini', 'Truffle arancini', 'Spiced chickpea velouté'] },
            { name: 'Starter', items: ['Lobster and mango salad', 'Roasted butternut soup with crème fraîche'] },
            { name: 'Main course', items: ['Grilled wagyu sirloin with jus', 'Saffron prawns with saffron pilaf', 'Wild mushroom risotto with parmesan crisps'] },
            { name: 'Dessert', items: ['Yuzu cheesecake', 'Dark chocolate fondant with salted caramel gelato'] },
            { name: 'Beverages', items: ['Champagne & premium wines', 'Signature mocktails', 'Speciality teas and barista coffee'] }
        ]
    },
    First: {
        label: 'First Class',
        courses: [
            { name: 'Amuse-bouche', items: ['Ossetra caviar with blinis', 'Chilled forest mushroom consommé'] },
            { name: 'Starter', items: ['Poached lobster with vanilla beurre blanc', 'Foie gras terrine with brioche'] },
            { name: 'Main course', items: ['Pan-seared Dover sole with brown butter', 'Slow-braised lamb shoulder with truffle jus', 'Kurobuta pork belly with apple purée'] },
            { name: 'Cheese board', items: ['Artisan selection with quince and lavosh'] },
            { name: 'Dessert', items: ['Grand Cru chocolate sphere', 'Exotic fruit platter with lemongrass sorbet'] },
            { name: 'Beverages', items: ['Vintage champagne', 'Rare single malts', 'Cellar wines by the glass'] }
        ]
    },
    Charter: {
        label: 'Private Charter',
        courses: [
            { name: 'On demand', items: ['Full bespoke menu designed with the crew before departure', 'Any course, any time — the cabin is yours'] },
            { name: 'Cellar', items: ['Champagne, rare wines and tailored mocktails'] }
        ]
    }
};

const IFE_ENTERTAINMENT = [
    { icon: 'fa-film', title: 'Movies', items: ['Skyward: The Journey', 'Queen of the Skies — A380 Documentary', 'Desert Horizon', 'The ATC Files', 'Wings Over Seven Seas', 'Midnight at Terminal 3'] },
    { icon: 'fa-tv', title: 'TV', items: ['PTFS Flight Diaries', 'Air Crash Investigations Marathon', 'The Cabin Crew Show', 'World Airports S7'] },
    { icon: 'fa-music', title: 'Music', items: ['Emirates Ambient', 'Desert Lounge', 'Classic Departures', 'Arabic Gold', 'Top of the Clouds'] },
    { icon: 'fa-gamepad', title: 'Games', items: ['Sky Chess', 'Trivia: Aviation Edition', 'Sudoku', 'Flight Trainer', 'Landing Challenge'] },
    { icon: 'fa-child', title: 'Kids', items: ['Sky Pals Adventures', 'Colouring the Fleets', 'Junior Pilot School'] }
];

const ifeRoot = document.getElementById('ife-root');
let ifeFlights = [];
let ifeActiveFlight = null;

function ifeEscape(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
}

function ifeTail(flightNumber) {
    const match = String(flightNumber || '').trim().toUpperCase().match(/^([A-Z]{2})/);
    if (!match) return null;
    const map = { EK: 'assets/emirates-tail.png', FZ: 'assets/flydubai-tail.png' };
    return map[match[1]] || null;
}

function haversineKm(a, b) {
    const toRad = (x) => x * Math.PI / 180;
    const [lat1, lon1] = a, [lat2, lon2] = b;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function routeDistanceKm(originCode, destination) {
    const match = String(destination || '').toUpperCase().match(/\(([A-Z]{3})\)\s*$/);
    const dest = match ? match[1] : null;
    if (!dest || !AIRPORT_COORDS[originCode] || !AIRPORT_COORDS[dest]) return null;
    return Math.round(haversineKm(AIRPORT_COORDS[originCode], AIRPORT_COORDS[dest]));
}

// Flight duration: real-route distance when known, otherwise a sensible default
function ifeDurationMinutes(flight) {
    const distance = routeDistanceKm('DXB', flight.destination);
    if (distance) return Math.round((distance / IFE_CONFIG.cruiseSpeedKmh) * 60 + 35);
    return flight.type === 'arrival' ? 240 : 120;
}

// A flight is "in the air" between departure and the estimated arrival
function ifeFlightState(flight) {
    const start = flight.scheduledTs;
    const end = start + ifeDurationMinutes(flight) * 60000;
    const now = Date.now();
    if (now < start) return { state: 'before', minutesToStart: Math.round((start - now) / 60000), end };
    if (now >= start && now < end) return { state: 'airborne', progress: (now - start) / (end - start), end };
    return { state: 'arrived' };
}

function ifeNextFlight() {
    const upcoming = ifeFlights
        .map((flight) => ({ flight, state: ifeFlightState(flight) }))
        .filter((entry) => entry.state.state === 'before')
        .sort((a, b) => a.flight.scheduledTs - b.flight.scheduledTs);
    return upcoming[0] || null;
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
        const member = await response.json();
        return member.roles || [];
    } catch {
        return null;
    }
}

function ifeClassForRoles(roles) {
    const has = (list) => list.some((id) => roles?.includes(id));
    if (has(IFE_CONFIG.firstClassRoleIds)) return 'First';
    if (has(IFE_CONFIG.charterRoleIds)) return 'Charter';
    if (has(IFE_CONFIG.businessClassRoleIds)) return 'Business';
    return 'Economy';
}

function ifeShell() {
    ifeRoot.innerHTML = `
        <div class="ife-frame">
            <div class="ife-brand">
                <img src="assets/emirates-tail.png" alt="" class="brand-tail">
                <span class="emirates-wordmark">EMARATES <small>IFE</small></span>
                <span class="ife-live"><span class="live-dot"></span> On board</span>
            </div>
            <div class="ife-strip" id="ife-strip"></div>
            <nav class="tabs ife-tabs" id="ife-tabs"></nav>
            <div class="ife-body" id="ife-body"></div>
            <p class="result-count" id="ife-note"></p>
        </div>
    `;
}

function ifeRenderStrip(flight, state) {
    const strip = document.getElementById('ife-strip');
    const progress = Math.round((state?.progress ?? 0) * 100);
    const isDeparture = flight.type === 'departure';
    strip.innerHTML = `
        <div class="ife-strip-main">
            ${ifeTail(flight.flightNumber) ? `<img class="tail-logo" src="${ifeTail(flight.flightNumber).src}" alt="">` : ''}
            <div>
                <strong>${ifeEscape(flight.flightNumber)}</strong>
                <span class="airline">${ifeEscape(flight.airline || 'Emirates PTFS')} · ${ifeEscape(flight.aircraft || 'A380-800')}</span>
            </div>
        </div>
        <div class="ife-progress">
            <div class="ife-route-line">
                <span>DXB</span>
                <div class="progress-bar"><div class="progress-fill" style="width: ${isDeparture ? progress : 100}%"></div></div>
                <span>${ifeEscape(airportCodeIfe(flight.destination))}</span>
            </div>
            <div class="progress-text">${isDeparture
                ? `${progress}% complete · ${Math.max(1, Math.round((state.end - Date.now()) / 60000))} min to arrival`
                : 'Welcome aboard — arriving shortly'}</div>
        </div>
    `;
}

function airportCodeIfe(destination) {
    const match = String(destination || '').toUpperCase().match(/\(([A-Z]{3})\)\s*$/);
    return match ? match[1] : String(destination || '—');
}

function ifeRoutePanel(flight) {
    const distance = routeDistanceKm('DXB', flight.destination);
    const durationMin = ifeDurationMinutes(flight);
    const destCode = airportCodeIfe(flight.destination);
    const isDeparture = flight.type === 'departure';
    const from = isDeparture ? 'DXB' : destCode;
    const to = isDeparture ? destCode : 'DXB';
    const hours = Math.floor(durationMin / 60);
    const minutes = durationMin % 60;
    return `
        <div class="ife-routes">
            <div class="ife-route-card">
                <h4><i class="fas fa-gamepad"></i> PTFS route</h4>
                <p class="ife-route-line-big">${from} <i class="fas fa-long-arrow-alt-right"></i> ${to}</p>
                <ul>
                    <li><span>Aircraft</span><strong>${ifeEscape(flight.aircraft || 'TBD')}</strong></li>
                    <li><span>Terminal</span><strong>${ifeEscape(flight.terminal || 'TBD')}</strong></li>
                    <li><span>Status</span><strong>${ifeEscape(flight.status)}</strong></li>
                    <li><span>Event</span>${flight.discordEvent ? `<a class="event-chip" href="${ifeEscape(flight.discordEvent)}" target="_blank" rel="noopener">Open ↗</a>` : '—'}</li>
                </ul>
            </div>
            <div class="ife-route-card">
                <h4><i class="fas fa-globe"></i> Real-world route</h4>
                <p class="ife-route-line-big">${from} <i class="fas fa-long-arrow-alt-right"></i> ${to}</p>
                <ul>
                    <li><span>Distance</span><strong>${distance ? `${distance.toLocaleString()} km` : '—'}</strong></li>
                    <li><span>Block time</span><strong>${hours}h ${String(minutes).padStart(2, '0')}m</strong></li>
                    <li><span>Cruise</span><strong>${IFE_CONFIG.cruiseSpeedKmh} km/h · 41,000 ft</strong></li>
                    <li><span>Airline</span><strong>${ifeEscape(flight.airline || 'Emirates')}</strong></li>
                </ul>
            </div>
        </div>
    `;
}

function ifeMenuPanel(flight, cabin) {
    const menu = IFE_MENUS[cabin] || IFE_MENUS.Economy;
    const premium = cabin !== 'Economy';
    return `
        <div class="ife-menu-head">
            <span class="flight-status ${cabin === 'First' || cabin === 'Charter' ? 'landed' : cabin === 'Business' ? 'boarding' : 'scheduled'}">${menu.label}</span>
            ${premium ? '<span class="live-badge">Cabin verified</span>' : '<span class="live-badge" style="background: var(--surface); color: var(--muted);">Standard cabin</span>'}
        </div>
        ${IFE_MENUS[cabin] ? `
        <div class="ife-menu">
            ${menu.courses.map((course) => `
                <div class="ife-course">
                    <h4>${ifeEscape(course.name)}</h4>
                    <ul>${course.items.map((item) => `<li>${ifeEscape(item)}</li>`).join('')}</ul>
                </div>`).join('')}
        </div>` : ''}
        ${cabin === 'Economy' ? `
        <div class="empty-state" style="margin-top: 1rem;">
            <i class="fas fa-crown"></i>
            <p>First and Business dining unlock automatically on board when your cabin role is verified.</p>
        </div>` : ''}
    `;
}

function ifeEntertainmentPanel(flight) {
    return `
        <div class="ife-entertainment">
            ${IFE_ENTERTAINMENT.map((category) => `
                <div class="ife-category">
                    <h4><i class="fas ${category.icon}"></i> ${ifeEscape(category.title)}</h4>
                    <div class="ife-tiles">
                        ${category.items.map((item) => `
                            <button class="ife-tile" type="button" data-title="${ifeEscape(item)}">
                                <i class="fas fa-play-circle"></i>${ifeEscape(item)}
                            </button>`).join('')}
                    </div>
                </div>`).join('')}
        </div>
    `;
}

function ifeBindTabs(flight, state, cabin) {
    const tabs = [
        { id: 'route', label: 'Route', icon: 'fa-route' },
        { id: 'menu', label: `Dining · ${IFE_MENUS[cabin].label.split(' ')[0]}`, icon: 'fa-utensils' },
        { id: 'fun', label: 'Entertainment', icon: 'fa-film' }
    ];
    const tabBar = document.getElementById('ife-tabs');
    const body = document.getElementById('ife-body');
    let active = 'route';

    const draw = () => {
        tabBar.innerHTML = tabs.map((tabDef) => `
            <button class="tab ${tabDef.id === active ? 'is-active' : ''}" type="button" data-ife-tab="${tabDef.id}">
                <i class="fas ${tabDef.icon}"></i>${tabDef.label}
            </button>`).join('');
        body.innerHTML = active === 'route' ? ifeRoutePanel(flight)
            : active === 'menu' ? ifeMenuPanel(flight, cabin)
            : ifeEntertainmentPanel(flight);
        body.querySelectorAll('[data-ife-tab]').forEach((button) => button.addEventListener('click', () => { active = button.dataset.ifeTab; draw(); }));
        body.querySelectorAll('.ife-tile').forEach((tile) => tile.addEventListener('click', () => {
            tile.classList.toggle('playing');
            const note = document.getElementById('ife-note');
            if (note) note.textContent = `${tile.dataset.title} — queued on your seat-back screen`;
        }));
    };
    draw();
}

function ifeRenderLocked(reasonHtml) {
    ifeRoot.innerHTML = `
        <div class="ife-frame">
            <div class="ife-brand">
                <img src="assets/emirates-tail.png" alt="" class="brand-tail">
                <span class="emirates-wordmark">EMARATES <small>IFE</small></span>
            </div>
            <div class="empty-state ife-locked">
                <i class="fas fa-lock"></i>
                <p>${reasonHtml}</p>
                <a class="btn outline small" href="booking.html"><i class="fas fa-calendar-week"></i> View the weekly schedule</a>
            </div>
        </div>
    `;
}

async function initIfe() {
    if (!ifeRoot) return;

    // 1. Login required
    const user = typeof getDiscordUser === 'function' ? getDiscordUser() : null;
    if (!user) {
        ifeRenderLocked('Emarates IFE is available to signed-in crew. Log in with Discord from the crew gallery on the home page, then return here.');
        return;
    }

    // 2. Flights from the FIDS
    try {
        ifeFlights = await fetchWeeklyFlights();
    } catch (error) {
        ifeRenderLocked('The flight data service is unreachable right now. Try again in a moment.');
        return;
    }

    // 3. Flight-time gate
    const airborne = ifeFlights.filter((flight) => ifeFlightState(flight).state === 'airborne');
    if (!airborne.length) {
        const next = ifeNextFlight();
        ifeRenderLocked(`
            <strong>No flight is in the air right now.</strong><br>
            Emarates IFE unlocks while one of our flights is between departure and arrival.
            ${next ? `<br><br>Next departure: <strong>${ifeEscape(next.flight.flightNumber)}</strong> in about <strong>${Math.floor(next.state.minutesToStart / 60)}h ${next.state.minutesToStart % 60}m</strong>.` : ''}
        `);
        return;
    }

    ifeActiveFlight = airborne[0];
    const state = ifeFlightState(ifeActiveFlight);

    // 4. Cabin role check (First / Business / Charter) before loading menus
    const roles = await ifeFetchMemberRoles();
    const cabin = ifeClassForRoles(roles);

    ifeShell();
    ifeRenderStrip(ifeActiveFlight, state);
    ifeBindTabs(ifeActiveFlight, state, cabin);
    const note = document.getElementById('ife-note');
    if (note) note.textContent = `Welcome aboard, ${user.name}. Dining menus are matched to your verified cabin.`;
}

initIfe();
