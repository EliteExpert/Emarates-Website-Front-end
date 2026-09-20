// ife.js — Emarates iCe: the seat-back screen. Dark cinematic layout with
// the ice tile wall, flight strip, and class-aware dining. Unlocked only
// while an FIDS flight is airborne; Discord login + cabin roles required.

const IFE_CONFIG = {
    // Discord role IDs that unlock the premium class menus.
    // Right-click the role in Discord → Copy ID, then paste it here.
    firstClassRoleIds: [],      // e.g. ['1331853227720708146']
    businessClassRoleIds: [],   // e.g. ['1331852990629417020']
    charterRoleIds: [],         // Private Charter role
    cruiseSpeedKmh: 902
};

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
            { name: 'On demand', items: ['Bespoke menu designed with the crew before departure', 'Any course, any time — the cabin is yours'] },
            { name: 'Cellar', items: ['Champagne, rare wines and tailored mocktails'] }
        ]
    }
};

const IFE_TILES = [
    { icon: 'fa-clapperboard', title: 'Movies', blurb: 'Latest premieres', art: 'linear-gradient(135deg,#8f1d22,#d71921)', items: ['Skyward: The Journey', 'Queen of the Skies', 'Desert Horizon', 'The ATC Files', 'Wings Over Seven Seas', 'Midnight at Terminal 3', 'Golden Hour', 'Fleet of Fortunes'] },
    { icon: 'fa-book-quran', title: 'Quran', blurb: 'Recitations on board', art: 'linear-gradient(135deg,#04543f,#0e8f6b)', items: ['Surah Al-Fatiha', 'Surah Yaseen', 'Surah Ar-Rahman', 'Surah Al-Kahf', 'Surah Al-Mulk', 'Surah Al-Waqiah', 'Full recitation — Mishary Alafasy', 'Full recitation — Abdul Basit'] },
    { icon: 'fa-tv', title: 'TV', blurb: 'Box sets aloft', art: 'linear-gradient(135deg,#123,#2e5f8a)', items: ['PTFS Flight Diaries', 'The Cabin Crew Show', 'World Airports S7', 'Air Crash Investigations', 'Gate 24', 'Sky Pals'] },
    { icon: 'fa-music', title: 'Music', blurb: '3,000+ tracks', art: 'linear-gradient(135deg,#4b1d6e,#8a3ab0)', items: ['Emirates Ambient', 'Desert Lounge', 'Classic Departures', 'Arabic Gold', 'Top of the Clouds', 'Runway Beats'] },
    { icon: 'fa-gamepad', title: 'Games', blurb: 'Play at 41,000 ft', art: 'linear-gradient(135deg,#0f5132,#2fbf71)', items: ['Sky Chess', 'Aviation Trivia', 'Flight Trainer', 'Landing Challenge', 'Sudoku Aloft', 'Cloud Racer'] },
    { icon: 'fa-child', title: 'Kids', blurb: 'For young pilots', art: 'linear-gradient(135deg,#a8620a,#f2a900)', items: ['Sky Pals Adventures', 'Colouring the Fleets', 'Junior Pilot School'] },
    { icon: 'fa-utensils', title: 'Dining', blurb: 'Cabin service', art: 'linear-gradient(135deg,#5c0f27,#a3123a)', items: [] },
    { icon: 'fa-route', title: 'Flight', blurb: 'Route & progress', art: 'linear-gradient(135deg,#1f2937,#4b5563)', items: [] }
];

const ifeRoot = document.getElementById('ife-root');
let ifeFlights = [];

function ifeEscape(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
}

function ifeTailSrc(flightNumber) {
    const match = String(flightNumber || '').trim().toUpperCase().match(/^([A-Z]{2})/);
    if (!match) return null;
    const map = { EK: 'assets/emirates-tail.png', FZ: 'assets/flydubai-tail.png' };
    return map[match[1]] || null;
}

function airportCodeIfe(destination) {
    const match = String(destination || '').toUpperCase().match(/\(([A-Z]{3})\)\s*$/);
    return match ? match[1] : String(destination || '—');
}

function haversineKm(a, b) {
    const toRad = (x) => x * Math.PI / 180;
    const [lat1, lon1] = a, [lat2, lon2] = b;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function routeDistanceKm(originCode, destination) {
    const dest = airportCodeIfe(destination);
    if (!AIRPORT_COORDS[originCode] || !AIRPORT_COORDS[dest]) return null;
    return Math.round(haversineKm(AIRPORT_COORDS[originCode], AIRPORT_COORDS[dest]));
}

function ifeDurationMinutes(flight) {
    const distance = routeDistanceKm('DXB', flight.destination);
    if (distance) return Math.round((distance / IFE_CONFIG.cruiseSpeedKmh) * 60 + 35);
    return flight.type === 'arrival' ? 240 : 120;
}

function ifeFlightState(flight) {
    const start = flight.scheduledTs;
    const end = start + ifeDurationMinutes(flight) * 60000;
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

/* ---------- Screen chrome ---------- */

function iceShell(flight, state, cabin, user) {
    const tail = ifeTailSrc(flight.flightNumber);
    const progress = Math.round((state?.progress ?? 0) * 100);
    const eta = Math.max(1, Math.round(((state?.end ?? Date.now()) - Date.now()) / 60000));
    const etaText = `${Math.floor(eta / 60)}h ${String(eta % 60).padStart(2, '0')}m`;
    ifeRoot.innerHTML = `
      <div class="ice-cabin">
        <div class="ice-screen">
            <header class="ice-header">
                <div class="ice-logo">
                    <span class="ice-ek">EK</span>
                    ${tail ? `<img src="${tail}" alt="" class="brand-tail">` : ''}
                    <span class="emirates-wordmark">EMARATES <small>iCe</small></span>
                </div>
                <div class="ice-flight">
                    <strong>${ifeEscape(flight.flightNumber)}</strong>
                    <span>DXB <i class="fas fa-long-arrow-alt-right"></i> ${ifeEscape(airportCodeIfe(flight.destination))} · ${ifeEscape(flight.aircraft || 'A380-800')}</span>
                </div>
                <div class="ice-status">
                    <span class="ice-eta">${etaText} to arrival</span>
                    <span class="live-dot"></span>
                </div>
            </header>

            <div class="ice-progressbar"><div class="ice-progressfill" style="width:${progress}%"></div></div>

            <main class="ice-main" id="ice-main"></main>

            <footer class="ice-footer">
                <span><i class="fas fa-user"></i> ${ifeEscape(user.name)} · ${IFE_MENUS[cabin].label}</span>
                <span class="ice-clock" id="ice-clock"></span>
            </footer>
        </div>
        <div class="ice-seat" aria-hidden="true">
            <div class="ice-seat-wing left"></div>
            <div class="ice-seat-head"></div>
            <div class="ice-seat-wing right"></div>
        </div>
      </div>
    `;
    const clock = document.getElementById('ice-clock');
    const tick = () => { clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
    tick();
    setInterval(tick, 30000);
}

/* ---------- Views ---------- */

function iceHomeView(flight, state, cabin) {
    const ptfsFrom = flight.ptfsDeparture || airportCodeIfe(flight.destination);
    const ptfsTo = flight.ptfsArrival || 'PTFS route not filed';
    const distance = routeDistanceKm('DXB', flight.destination);
    const durationMin = ifeDurationMinutes(flight);
    return `
        <section class="ice-promo" style="background-image:${promoArtFor(flight)}">
            <div class="ice-promo-inner">
                <p class="ice-promo-kicker">Now on board</p>
                <h2>Emarates iCe</h2>
                <p>Over 3,000 channels of movies, music, games and live flight info — on every seat, on every flight.</p>
                <button class="ice-cta" type="button" data-ice-view="Movies"><i class="fas fa-play"></i> Start watching</button>
            </div>
        </section>
        <nav class="ice-tiles">
            ${IFE_TILES.map((tile) => `
                <button class="ice-tile" type="button" data-ice-view="${tile.title}" style="--tile-art:${tile.art}">
                    <i class="fas ${tile.icon}"></i>
                    <strong>${tile.title}</strong>
                    <span>${tile.blurb}</span>
                </button>`).join('')}
        </nav>
        <section class="ice-stripinfo">
            <div>
                <h4><i class="fas fa-gamepad"></i> PTFS route</h4>
                <p>${ifeEscape(ptfsFrom)} <i class="fas fa-long-arrow-alt-right"></i> ${ifeEscape(ptfsTo)}</p>
            </div>
            <div>
                <h4><i class="fas fa-globe"></i> Real-world route</h4>
                <p>${distance ? `${distance.toLocaleString()} km · ${Math.floor(durationMin / 60)}h ${String(durationMin % 60).padStart(2, '0')}m` : 'Distance upon departure'}</p>
            </div>
            <div>
                <h4><i class="fas fa-signal"></i> Status</h4>
                <p>${ifeEscape(flight.status)} · Terminal ${ifeEscape(flight.terminal || 'TBD')}</p>
            </div>
        </section>
    `;
}

function promoArtFor(flight) {
    const photos = ['assets/photos/fleet-sunset-a380.png', 'assets/photos/fleet-moon-night.png', 'assets/photos/fleet-golden-fuselage.png', 'assets/photos/fleet-a350-flight.png'];
    const pick = photos[String(flight.flightNumber).length % photos.length];
    return `linear-gradient(100deg, rgba(10,11,13,.86) 30%, rgba(10,11,13,.25) 75%), url('${pick}')`;
}

function iceListView(viewId) {
    const tile = IFE_TILES.find((entry) => entry.title === viewId);
    if (!tile) return iceHomeViewSafe();
    return `
        <section class="ice-list">
            <header class="ice-list-head" style="--tile-art:${tile.art}">
                <button class="ice-back" type="button" data-ice-view="home"><i class="fas fa-arrow-left"></i> Home</button>
                <h2><i class="fas ${tile.icon}"></i> ${tile.title}</h2>
            </header>
            <div class="ice-items">
                ${tile.items.map((item) => `
                    <button class="ice-item" type="button" data-title="${ifeEscape(item)}">
                        <i class="fas fa-play-circle"></i> ${ifeEscape(item)}
                    </button>`).join('')}
            </div>
        </section>
    `;
}

function iceDiningView(cabin) {
    const menu = IFE_MENUS[cabin];
    const premium = cabin !== 'Economy';
    return `
        <section class="ice-list">
            <header class="ice-list-head" style="--tile-art:linear-gradient(135deg,#5c0f27,#a3123a)">
                <button class="ice-back" type="button" data-ice-view="home"><i class="fas fa-arrow-left"></i> Home</button>
                <h2><i class="fas fa-utensils"></i> ${menu.label}</h2>
            </header>
            <div class="ice-menu">
                ${menu.courses.map((course) => `
                    <div class="ice-course">
                        <h4>${ifeEscape(course.name)}</h4>
                        <ul>${course.items.map((item) => `<li>${ifeEscape(item)}</li>`).join('')}</ul>
                    </div>`).join('')}
            </div>
            ${premium ? '' : `
            <div class="ice-upgrade">
                <i class="fas fa-crown"></i>
                <p>First and Business dining unlock automatically when your cabin role is verified.</p>
            </div>`}
        </section>
    `;
}

function iceFlightView(flight, state) {
    const isDeparture = flight.type === 'departure';
    const progress = Math.round((state?.progress ?? 0) * 100);
    const distance = routeDistanceKm('DXB', flight.destination);
    const durationMin = ifeDurationMinutes(flight);
    return `
        <section class="ice-list">
            <header class="ice-list-head" style="--tile-art:linear-gradient(135deg,#1f2937,#4b5563)">
                <button class="ice-back" type="button" data-ice-view="home"><i class="fas fa-arrow-left"></i> Home</button>
                <h2><i class="fas fa-route"></i> Flight</h2>
            </header>
            <div class="ice-flightinfo">
                <div class="ice-map">
                    <span class="ice-code">${isDeparture ? 'DXB' : airportCodeIfe(flight.destination)}</span>
                    <div class="ice-mapline"><i class="fas fa-plane" style="left:${progress}%"></i></div>
                    <span class="ice-code">${isDeparture ? airportCodeIfe(flight.destination) : 'DXB'}</span>
                </div>
                <div class="ice-facts">
                    <div><span>PTFS route</span><strong>${ifeEscape(flight.ptfsDeparture || '—')} → ${ifeEscape(flight.ptfsArrival || '—')}</strong></div>
                    <div><span>Distance</span><strong>${distance ? `${distance.toLocaleString()} km` : '—'}</strong></div>
                    <div><span>Block time</span><strong>${Math.floor(durationMin / 60)}h ${String(durationMin % 60).padStart(2, '0')}m</strong></div>
                    <div><span>Aircraft</span><strong>${ifeEscape(flight.aircraft || 'TBD')}</strong></div>
                    <div><span>Terminal</span><strong>${ifeEscape(flight.terminal || 'TBD')}</strong></div>
                    <div><span>Status</span><strong>${ifeEscape(flight.status)}</strong></div>
                </div>
                ${flight.discordEvent ? `<a class="ice-event" href="${ifeEscape(flight.discordEvent)}" target="_blank" rel="noopener"><i class="fas fa-calendar-check"></i> Open the flight event</a>` : ''}
            </div>
        </section>
    `;
}

function iceHomeViewSafe() { return '<div class="ice-upgrade"><p>Unknown section.</p></div>'; }

/* ---------- Locked states ---------- */

function iceLocked(reasonHtml) {
    ifeRoot.innerHTML = `
      <div class="ice-cabin">
        <div class="ice-screen ice-screen-locked">
            <header class="ice-header">
                <div class="ice-logo">
                    <span class="ice-ek">EK</span>
                    <img src="assets/emirates-tail.png" alt="" class="brand-tail">
                    <span class="emirates-wordmark">EMARATES <small>iCe</small></span>
                </div>
            </header>
            <div class="ice-locked">
                <i class="fas fa-lock"></i>
                <div>${reasonHtml}</div>
                <a class="ice-cta" href="booking.html"><i class="fas fa-calendar-week"></i> Weekly schedule</a>
            </div>
        </div>
        <div class="ice-seat" aria-hidden="true">
            <div class="ice-seat-wing left"></div>
            <div class="ice-seat-head"></div>
            <div class="ice-seat-wing right"></div>
        </div>
      </div>
    `;
}

/* ---------- Engine ---------- */

function iceNavigate(view, flight, state, cabin) {
    const main = document.getElementById('ice-main');
    if (!main) return;
    if (view === 'home') main.innerHTML = iceHomeView(flight, state, cabin);
    else if (view === 'Dining') main.innerHTML = iceDiningView(cabin);
    else if (view === 'Flight') main.innerHTML = iceFlightView(flight, state);
    else main.innerHTML = iceListView(view);
    main.querySelectorAll('[data-ice-view]').forEach((button) => {
        button.addEventListener('click', () => iceNavigate(button.dataset.iceView, flight, state, cabin));
    });
    main.querySelectorAll('.ice-item').forEach((item) => {
        item.addEventListener('click', () => {
            item.classList.toggle('playing');
            const note = document.getElementById('ice-note');
            if (note) note.textContent = `${item.dataset.title} — now playing on your seat-back screen`;
            const footer = document.querySelector('.ice-footer');
            if (footer && !document.getElementById('ice-note')) {
                const span = document.createElement('span');
                span.id = 'ice-note';
                footer.prepend(span);
            }
            if (note) { note.textContent = `${item.dataset.title} — now playing`; setTimeout(() => { note.textContent = ''; }, 4000); }
        });
    });
    main.scrollTop = 0;
}

async function initIfe() {
    if (!ifeRoot) return;

    const user = typeof getDiscordUser === 'function' ? getDiscordUser() : null;
    if (!user) {
        iceLocked('<p><strong>Emarates iCe is available to signed-in passengers.</strong></p><p>Log in with Discord from the crew gallery on the home page, then return to your seat.</p>');
        return;
    }

    try {
        ifeFlights = await fetchWeeklyFlights();
    } catch (error) {
        iceLocked('<p>The flight data service is unreachable right now. The cabin crew will restore it shortly.</p>');
        return;
    }

    const airborne = ifeFlights.filter((flight) => ifeFlightState(flight).state === 'airborne');
    if (!airborne.length) {
        const next = ifeNextFlight();
        iceLocked(`
            <p><strong>Your iCe system starts after departure.</strong></p>
            <p>iCe is available while one of our flights is between departure and arrival.</p>
            ${next ? `<p>Next departure: <strong>${ifeEscape(next.flight.flightNumber)}</strong> in about <strong>${Math.floor(next.state.minutesToStart / 60)}h ${next.state.minutesToStart % 60}m</strong>.</p>` : ''}
        `);
        return;
    }

    const flight = airborne[0];
    const state = ifeFlightState(flight);
    const roles = await ifeFetchMemberRoles();
    const cabin = ifeClassForRoles(roles);

    iceShell(flight, state, cabin, user);
    iceNavigate('home', flight, state, cabin);
}

initIfe();
