// script.js - Complete Rewrite

// BACKEND CONFIGURATION - ADD THIS AT THE TOP
const BACKEND_URL = "https://emarates-website-production.up.railway.app";

// Flight operations (FIDS) and Discord community sources
const FIDS_URL = "https://emirates-ptfs-fids.onrender.com";
const DISCORD_INVITE_CODE = "PJVAvbJbdn";
const DISCORD_GUILD_ID = "1294732873143685160";
const CREW_VOICE_CHANNEL_ID = "1376278983859245147";
// Discord OAuth2 (implicit) — paste your Discord application's Client ID here
// and add "<your-site>/index.html" as an OAuth2 redirect URI in the
// Discord Developer Portal. Leave empty to keep the gallery view-only.
const DISCORD_OAUTH_CLIENT_ID = "1550876222719004703";
const OAUTH_STORE_KEY = "discord-oauth";
const GALLERY_STORE_KEY = "crew-gallery";

// JWT Token Management
function storeToken(token) {
    localStorage.setItem('jwt_token', token);
}

function getToken() {
    return localStorage.getItem('jwt_token');
}

function removeToken() {
    localStorage.removeItem('jwt_token');
}

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Emirates PTFS Website Loaded');
    
    // Check for token in URL after Discord redirect
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
        storeToken(token);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        console.log('✅ JWT Token stored from URL');
    }
    
    initAll();
});

// Main initialization function
async function initAll() {
    console.log('🔄 Initializing all components...');
    initMobileOptimizations();
    initNavigation();
    initSmoothScrolling();
    initFlightStatus();
    initDiscordStats();
    initScrollReveal();
    initCounters();
    initFooterYear();
    initMarquee();
    initFlipClock();
    initThemeToggle();
    initCrewCount();
    initGalleryTool();
    initDiscordAuth();
    initPageFeatures();

    // Set active navigation link
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
}

// Navigation functionality
function initNavigation() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (!hamburger || !navMenu) return;
    
    // Toggle mobile menu
    hamburger.addEventListener('click', function() {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
    });
    
    // Close mobile menu when clicking on a link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function() {
            if (hamburger && navMenu) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            }
        });
    });
    
    // Elevate the masthead once the page scrolls
    window.addEventListener('scroll', function() {
        const header = document.querySelector('header');
        if (header) {
            header.style.boxShadow = window.scrollY > 24
                ? '0 10px 30px rgb(20 25 30 / .08)'
                : 'none';
        }
    });
}

// Smooth scrolling for anchor links
function initSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const headerHeight = document.querySelector('header')?.offsetHeight || 70;
                const targetPosition = targetElement.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Weekly flights (sourced from the FIDS flight operations service)
const TAIL_LOGOS = {
    EK: { src: 'assets/emirates-tail.png', alt: 'Emirates' },
    FZ: { src: 'assets/flydubai-tail.png', alt: 'flydubai' }
};

const displayTimeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
const displayDateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function tailLogo(flightNumber) {
    const match = String(flightNumber || '').trim().toUpperCase().match(/^([A-Z]{2})/);
    return match ? TAIL_LOGOS[match[1]] : null;
}

function gmtWeekStart() {
    const now = new Date();
    const sunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - now.getUTCDay()));
    return sunday;
}

function addUtcDays(date, days) {
    const value = new Date(date.getTime());
    value.setUTCDate(value.getUTCDate() + days);
    return value;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
}

function fidsStatusClass(status) {
    return `status-${String(status || '').toLowerCase().replace(/\s+/g, '-')}`;
}

async function fetchWeeklyFlights(weekOffset = 0) {
    const response = await fetch(`${FIDS_URL}/api/flights`);
    if (!response.ok) throw new Error(`Flight service returned HTTP ${response.status}.`);
    const flights = await response.json();
    if (!Array.isArray(flights)) throw new Error('Flight service returned an invalid schedule.');

    const weekStart = addUtcDays(gmtWeekStart(), 7 * weekOffset);
    const weekEnd = addUtcDays(weekStart, 6);
    const startKey = weekStart.toISOString().slice(0, 10);
    const endKey = weekEnd.toISOString().slice(0, 10);

    return flights
        .filter((flight) => flight.date >= startKey && flight.date <= endKey)
        .map((flight) => {
            const time = flight.departureTime || flight.arrivalTime || '00:00';
            return { ...flight, scheduledTs: Date.parse(`${flight.date}T${time}:00Z`), scheduledTime: time };
        })
        .sort((a, b) => a.scheduledTs - b.scheduledTs);
}

function fidsCountdown(flight) {
    const remaining = flight.scheduledTs - Date.now();
    if (remaining <= 0 || ['Delayed', 'Cancelled', 'Arrived'].includes(flight.status)) return '';
    const totalMinutes = Math.floor(remaining / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const text = `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
    return flight.type === 'departure' ? `Departs in ${text}` : `Arrives in ${text}`;
}

function flightCardHtml(flight, index) {
    const isDeparture = flight.type === 'departure';
    const scheduledDate = new Date(flight.scheduledTs);
    const tail = tailLogo(flight.flightNumber);
    const tailHtml = tail
        ? `<img class="tail-logo" src="${tail.src}" alt="" onerror="this.style.display='none'">`
        : '';
    const countdown = fidsCountdown(flight);
    const eventUrl = typeof flight.discordEvent === 'string' && flight.discordEvent.startsWith('https://discord.com/')
        ? ` <a class="event-chip" href="${escapeHtml(flight.discordEvent)}" target="_blank" rel="noopener">Event ↗</a>`
        : '';
    return `
        <article class="flight-card" style="animation-delay:${Math.min(index * 45, 360)}ms">
            <div class="time">
                <time datetime="${escapeHtml(new Date(flight.scheduledTs).toISOString())}">${escapeHtml(displayTimeFmt.format(scheduledDate))}</time>
                ${countdown ? `<span class="countdown">${countdown}</span>` : ''}
            </div>
            <div class="flight-id">
                <div class="flight-number-row">${tailHtml}<span class="flight-number">${escapeHtml(flight.flightNumber)}</span></div>
                <span class="airline">${escapeHtml(flight.airline || 'Emirates PTFS')}</span>
            </div>
            <div class="cell destination-cell"><span class="cell-label">${isDeparture ? 'Destination' : 'Origin'}</span><span class="cell-value">${escapeHtml(flight.destination)}${eventUrl}</span></div>
            <div class="cell aircraft-cell"><span class="cell-label">Aircraft</span><span class="cell-value">${escapeHtml(flight.aircraft || 'TBD')}</span></div>
            <div class="cell terminal-cell"><span class="cell-label">Terminal</span><span class="terminal">${escapeHtml(flight.terminal || 'TBD')}</span></div>
            <span class="status ${fidsStatusClass(flight.status)}">${escapeHtml(flight.status)}</span>
        </article>`;
}

function renderFidsBoard(listElement, flights) {
    if (!flights.length) {
        listElement.innerHTML = `
            <div class="empty-state">
                No flights are scheduled for this week yet. New flights appear here as soon as operations publish them.
            </div>
        `;
        return;
    }
    const groups = flights.reduce((all, flight) => {
        (all[flight.date] ||= []).push(flight);
        return all;
    }, {});
    let index = 0;
    listElement.innerHTML = Object.entries(groups).map(([date, items]) => `
        <section class="date-group">
            <h2 class="date-heading">${displayDateFmt.format(new Date(`${date}T00:00:00Z`))}</h2>
            ${items.map((flight) => flightCardHtml(flight, index++)).join('')}
        </section>`).join('');
}

function flightsErrorHtml() {
    return `
        <div class="empty-state">
            The weekly schedule is unavailable right now. Try the live board at
            <a href="${FIDS_URL}/departures" target="_blank" rel="noopener">emirates-ptfs-fids.onrender.com</a>.
        </div>
    `;
}

// Weekly flights page (booking.html)
async function initWeeklyFlightsPage() {
    const list = document.getElementById('weekly-flights-list');
    if (!list) return;

    const searchInput = document.getElementById('flight-search');
    const resultCount = document.getElementById('result-count');
    const airlineTabs = document.getElementById('airline-tabs');

    let allFlights = [];
    let activeAirline = 'all';

    // The board lists every airline; the tabs and search only narrow it down.
    const matchesAirline = (flight) => {
        if (activeAirline === 'all') return true;
        const code = String(flight.flightNumber || '').trim().toUpperCase().match(/^([A-Z]{2})/)?.[1] || 'other';
        return activeAirline === 'other' ? !['EK', 'FZ'].includes(code) : code === activeAirline;
    };

    const applyFilter = () => {
        if (!allFlights.length && !list.querySelector('.flight-card')) return;
        const query = (searchInput?.value || '').trim().toLowerCase();
        const visible = allFlights.filter((flight) => matchesAirline(flight) &&
            [flight.flightNumber, flight.destination, flight.aircraft, flight.status]
                .some((value) => String(value || '').toLowerCase().includes(query)));
        if (resultCount) resultCount.textContent = `${visible.length} ${visible.length === 1 ? 'flight' : 'flights'} shown`;
        if (!visible.length && query) {
            list.innerHTML = '<div class="empty-state">No flights match that search. Try a flight number, destination or aircraft.</div>';
        } else {
            renderFidsBoard(list, visible);
        }
    };
    if (searchInput) searchInput.addEventListener('input', applyFilter);
    if (airlineTabs) airlineTabs.addEventListener('click', (event) => {
        const tab = event.target.closest('.airline-tab');
        if (!tab) return;
        activeAirline = tab.dataset.airline;
        airlineTabs.querySelectorAll('.airline-tab').forEach((button) => button.classList.toggle('is-active', button === tab));
        applyFilter();
    });

    const load = async () => {
        try {
            allFlights = await fetchWeeklyFlights();
            let weekLabel = '';
            if (!allFlights.length) {
                // Late in the week the schedule is often already published for
                // next week; show that instead of an empty board.
                const nextWeek = await fetchWeeklyFlights(1);
                if (nextWeek.length) {
                    allFlights = nextWeek;
                    const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
                    weekLabel = `Next week (${fmt.format(addUtcDays(gmtWeekStart(), 7))} – ${fmt.format(addUtcDays(gmtWeekStart(), 13))} GMT) · `;
                }
            }
            if (resultCount) resultCount.textContent = `${weekLabel}${allFlights.length} ${allFlights.length === 1 ? 'flight' : 'flights'} shown`;
            renderFidsBoard(list, allFlights);
            const updateTimeElement = document.getElementById('update-time');
            if (updateTimeElement) updateTimeElement.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (error) {
            console.error('Weekly flights fetch failed:', error);
            list.innerHTML = flightsErrorHtml();
        }
    };

    await load();
    setInterval(load, 5 * 60 * 1000);
}

// Home page preview: the next few upcoming departures
async function initHomePreview() {
    const container = document.getElementById('home-flights-preview');
    if (!container) return;

    const render = async (flights) => {
        let source = flights;
        if (!flights.filter((flight) => flight.scheduledTs > Date.now()).length) {
            try { source = await fetchWeeklyFlights(1); } catch { source = flights; }
        }
        const heroFlightCount = document.getElementById('hero-flight-count');
        if (heroFlightCount) heroFlightCount.textContent = source.length.toLocaleString();
        const upcoming = source.filter((flight) => flight.scheduledTs > Date.now()).slice(0, 4);
        if (!upcoming.length) {
            container.innerHTML = `
                <div class="empty-state">
                    No upcoming flights this week — check back after the next Sunday schedule drop.
                </div>
            `;
            return;
        }
        container.innerHTML = upcoming.map((flight, index) => flightCardHtml(flight, index)).join('');
    };

    try {
        await render(await fetchWeeklyFlights());
    } catch (error) {
        console.error('Home flight preview failed:', error);
        container.innerHTML = flightsErrorHtml();
    }
    setInterval(async () => {
        try { await render(await fetchWeeklyFlights()); } catch (error) { console.warn('Home flight preview refresh failed:', error); }
    }, 5 * 60 * 1000);
}

// Flight status functionality
function initFlightStatus() {
    setInterval(updateFlightStatus, 30000);
    updateFlightStatus();
}

function updateFlightStatus() {
    const updateTimeElement = document.getElementById('update-time');
    if (updateTimeElement) {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        updateTimeElement.textContent = timeString;
    }
}

// Community statistics (member and online counts are live from Discord)
function updateCommunityStats() {
    const flightCount = document.getElementById('flight-count');
    const eventCount = document.getElementById('event-count');

    if (flightCount && flightCount.dataset.live !== 'true') flightCount.textContent = '40+';
    if (eventCount) eventCount.textContent = '8+';
}

// Live Discord member/online counts from the public invite endpoint
async function initDiscordStats() {
    const memberCount = document.getElementById('member-count');
    const onlineCount = document.getElementById('online-count');
    const heroMemberCount = document.getElementById('hero-member-count');
    if (!memberCount && !onlineCount && !heroMemberCount) return;

    const update = async () => {
        try {
            const response = await fetch(`https://discord.com/api/v9/invites/${DISCORD_INVITE_CODE}?with_counts=true`);
            if (!response.ok) throw new Error(`Discord invite API returned HTTP ${response.status}.`);
            const data = await response.json();
            const members = data.approximate_member_count;
            const online = data.approximate_presence_count;
            if (Number.isFinite(members)) {
                const label = `${members.toLocaleString()}`;
                if (memberCount) memberCount.textContent = label;
                if (heroMemberCount) heroMemberCount.textContent = label;
            }
            if (Number.isFinite(online) && onlineCount) onlineCount.textContent = online.toLocaleString();
        } catch (error) {
            console.warn('Discord member count unavailable:', error);
        }
    };

    update();
    setInterval(update, 60 * 1000);
}

// Authentication functions
async function checkAuth() {
    const token = getToken();
    if (!token) {
        return { logged_in: false };
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/user`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const userData = await response.json();
        return userData;
    } catch (error) {
        console.error('Auth check failed:', error);
        return { logged_in: false };
    }
}

// Logout function
function logout() {
    removeToken();
    window.location.href = '/';
}

// Initialize page-specific functionality
function initPageFeatures() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    if (currentPage === 'booking.html') {
        initWeeklyFlightsPage();
    } else if (currentPage === 'index.html') {
        initHomePreview();
    } else if (currentPage === 'join.html') {
        initJoinPage();
    } else if (currentPage === 'my-flights.html') {
        initializeMyFlightsDirect();
    }
}

// Scroll-reveal animations (applied site-wide to common cards and sections)
function initScrollReveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const autoSelectors = [
        '.feature-card', '.class-card', '.career-card', '.event-card',
        '.benefit', '.step', '.stat-card', '.join-card', '.status-container',
        '.booking-container', '.community-stats', '.section-title', '.section-subtitle'
    ];
    autoSelectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((element) => element.classList.add('reveal'));
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    document.querySelectorAll('.reveal').forEach((element, index) => {
        element.style.transitionDelay = `${Math.min(index % 4, 3) * 80}ms`;
        observer.observe(element);
    });
}

// Animated number counters for [data-count] stats
function initCounters() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const element = entry.target;
            observer.unobserve(element);
            const target = Number(element.dataset.count);
            if (!Number.isFinite(target)) return;
            const suffix = element.dataset.suffix || '';
            const duration = 1200;
            const start = performance.now();
            const tick = (now) => {
                const progress = Math.min((now - start) / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                element.textContent = Math.round(target * eased).toLocaleString() + suffix;
                if (progress < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        });
    }, { threshold: 0.4 });

    document.querySelectorAll('[data-count]').forEach((element) => observer.observe(element));
}

// Footer copyright year
function initFooterYear() {
    const yearElement = document.getElementById('footer-year');
    if (yearElement) yearElement.textContent = new Date().getFullYear();
}

// Live "Crew Members" count from the Discord voice channel.
// Requires the server's Discord Widget to be enabled (Server Settings ->
// Widget); falls back to a dash while it is off.
function initCrewCount() {
    const crewElement = document.getElementById('crew-count');
    if (!crewElement) return;

    const update = async () => {
        try {
            const response = await fetch(`https://discord.com/api/v9/guilds/${DISCORD_GUILD_ID}/widget.json`);
            if (!response.ok) throw new Error(`Discord widget returned HTTP ${response.status}.`);
            const widget = await response.json();
            const inChannel = (widget.members || []).filter((member) => member.channel_id === CREW_VOICE_CHANNEL_ID);
            crewElement.textContent = inChannel.length.toLocaleString();
        } catch (error) {
            console.warn('Crew voice count unavailable (is the Discord Widget enabled?):', error.message);
        }
    };

    update();
    setInterval(update, 60 * 1000);
}

// ---- Crew gallery: curated fleet shots + community additions ----
const GALLERY_CURATED = [
    { src: 'assets/photos/crew-ek002.png', flight: 'EK002' },
    { src: 'assets/photos/crew-ek087.png', flight: 'EK087' },
    { src: 'assets/photos/crew-ek242.png', flight: 'EK242 X AC57' },
    { src: 'assets/photos/crew-ek2512.png', flight: 'EK 2512' },
    { src: 'assets/photos/crew-ek356.png', flight: 'EK 356' },
    { src: 'assets/photos/crew-ek342.png', flight: 'EK 342' },
    { src: 'assets/photos/crew-ek241.png', flight: 'EK 241 X AC57' },
    { src: 'assets/photos/fleet-takeoff-day.png', flight: 'Rotation — 777-300ER' },
    { src: 'assets/photos/fleet-gate-a350.png', flight: 'Gate 25L — A350-900' },
    { src: 'assets/photos/fleet-sunset-a380.png', flight: 'Sunset departure — A380' },
    { src: 'assets/photos/fleet-moon-night.png', flight: 'Moonlit climb — A380' }
];

function loadUserGalleryPhotos() {
    try { return JSON.parse(localStorage.getItem(GALLERY_STORE_KEY)) || []; }
    catch { return []; }
}

function saveUserGalleryPhotos(photos) {
    localStorage.setItem(GALLERY_STORE_KEY, JSON.stringify(photos.slice(0, 30)));
}

// Fisher-Yates so the board reads differently on every visit
function shuffleList(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

let sharedGalleryPhotos = [];
let sharedGalleryLoaded = false;

async function loadSharedGalleryPhotos() {
    try {
        const response = await fetch('/api/photos');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json();
        if (Array.isArray(body.photos)) {
            sharedGalleryPhotos = body.photos;
            sharedGalleryLoaded = true;
            renderGallery();
        }
    } catch (error) {
        // Not on Vercel (or Blob not connected): curated + local photos only.
        console.warn('Shared gallery unavailable:', error.message);
    }
}

function renderGallery() {
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;

    // Server photos win; skip local copies already stored server-side.
    const localPhotos = loadUserGalleryPhotos().map((photo) => ({ ...photo, user: true }));
    const localPending = sharedGalleryLoaded
        ? localPhotos.filter((photo) => !sharedGalleryPhotos.some((shared) => shared.localKey && photo.key && shared.localKey === photo.key))
        : localPhotos;
    const entries = shuffleList([...localPending, ...sharedGalleryPhotos.map((photo) => ({ ...photo, shared: true })), ...GALLERY_CURATED]);

    grid.innerHTML = '';
    entries.forEach((entry, index) => {
        const figure = document.createElement('figure');
        figure.className = 'gallery-card reveal' + (index % 5 === 0 ? ' gallery-card-wide' : '');
        const img = document.createElement('img');
        img.src = entry.src;
        img.alt = entry.flight;
        img.loading = 'lazy';
        img.addEventListener('error', () => figure.remove());
        const caption = document.createElement('figcaption');
        const chip = entry.user && !entry.shared ? '<span class="gallery-chip">New</span>' : '';
        caption.innerHTML = `${chip}${escapeHtml(entry.flight)}${entry.by ? ` <span class="gallery-by">· by ${escapeHtml(entry.by)}</span>` : ''}`;
        figure.append(img, caption);
        grid.appendChild(figure);
    });

    // Re-run the reveal observer over the fresh cards
    if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const observer = new IntersectionObserver((entries2) => {
            entries2.forEach((entry) => {
                if (entry.isIntersecting) { entry.target.classList.add('revealed'); observer.unobserve(entry.target); }
            });
        }, { threshold: 0.12 });
        grid.querySelectorAll('.reveal').forEach((element, i) => {
            element.style.transitionDelay = `${Math.min(i % 4, 3) * 70}ms`;
            observer.observe(element);
        });
    } else {
        grid.querySelectorAll('.reveal').forEach((element) => element.classList.add('revealed'));
    }
}

// ---- Discord OAuth (implicit flow, no server needed) ----
function getDiscordOauthToken() {
    if (window.__discordToken) return window.__discordToken;
    try {
        const stored = JSON.parse(localStorage.getItem(OAUTH_STORE_KEY));
        return stored?.token && stored.expires_at > Date.now() ? stored.token : null;
    } catch { return null; }
}

function getDiscordUser() {
    try { return JSON.parse(localStorage.getItem('discord-user')); }
    catch { return null; }
}

async function fetchDiscordProfile(token) {
    const response = await fetch('https://discord.com/api/v9/users/@me', {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`Discord profile returned HTTP ${response.status}.`);
    return response.json();
}

async function initDiscordAuth() {
    // Capture the implicit-grant token from the URL fragment
    if (location.hash.includes('access_token')) {
        const params = new URLSearchParams(location.hash.slice(1));
        const token = params.get('access_token');
        const expiresIn = Number(params.get('expires_in')) || 604800;
        localStorage.setItem(OAUTH_STORE_KEY, JSON.stringify({
            token, expires_at: Date.now() + expiresIn * 1000
        }));
        history.replaceState({}, document.title, location.pathname + location.search);
    }

    const stored = (() => {
        try { return JSON.parse(localStorage.getItem(OAUTH_STORE_KEY)); }
        catch { return null; }
    })();
    if (stored?.token && stored.expires_at > Date.now()) {
        window.__discordToken = stored.token;
    } else {
        delete window.__discordToken;
    }
    if (stored?.token && stored.expires_at > Date.now()) {
        try {
            const profile = await fetchDiscordProfile(stored.token);
            localStorage.setItem('discord-user', JSON.stringify({
                id: profile.id,
                name: profile.global_name || profile.username,
                avatar: profile.avatar
                    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=64`
                    : null
            }));
        } catch (error) {
            console.warn('Discord login expired:', error.message);
            localStorage.removeItem(OAUTH_STORE_KEY);
            localStorage.removeItem('discord-user');
        }
    }
    renderGalleryTool();
}

function discordLogout() {
    localStorage.removeItem(OAUTH_STORE_KEY);
    localStorage.removeItem('discord-user');
    renderGalleryTool();
    renderGallery();
}
window.discordLogout = discordLogout;

function renderGalleryTool() {
    const body = document.querySelector('.gallery-tool-body');
    if (!body) return;
    const user = getDiscordUser();

    if (!user) {
        const loginHref = DISCORD_OAUTH_CLIENT_ID
            ? `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(DISCORD_OAUTH_CLIENT_ID)}&redirect_uri=${encodeURIComponent(location.origin + location.pathname)}&response_type=token&scope=identify`
            : '';
        const redirectUri = location.origin + location.pathname;
        body.innerHTML = `
            <h3>Add a photo to the gallery</h3>
            <p>Log in with Discord so your photos carry your name on the board.</p>
            ${loginHref
                ? `<a class="btn discord-btn full-width" href="${loginHref}"><i class="fab fa-discord"></i> Log in with Discord</a>
            <p class="gallery-tool-note">Seeing <strong>invalid oauth2 redirect_uri</strong>? In the Discord Developer Portal → your application → OAuth2 → Redirects, add this exact URL (click to copy) and save:
            <code class="redirect-uri" title="Click to copy" onclick="navigator.clipboard.writeText('${redirectUri}').then(() => this.classList.add('copied'))">${escapeHtml(redirectUri)}</code>
            Add one entry per address you use the site on (e.g. your <code>.vercel.app</code> domain and <code>http://127.0.0.1:8901/index.html</code> locally). It must be the same application as the Client ID in <code>script.js</code>.</p>`
                : `<p class="gallery-tool-note"><i class="fas fa-circle-info"></i> Discord login is not configured yet — set <code>DISCORD_OAUTH_CLIENT_ID</code> in <code>script.js</code> and allow this site as an OAuth2 redirect.</p>`}
        `;
        return;
    }

    const avatar = user.avatar
        ? `<img class="gallery-avatar" src="${user.avatar}" alt="">`
        : '<i class="fas fa-user-astronaut gallery-avatar-icon"></i>';
    body.innerHTML = `
        <h3>Add a photo to the gallery</h3>
        <p>Flew something memorable? Pick the photo, tag it with the flight number, and it joins the board.</p>
        <div class="gallery-identity">${avatar} Adding as <strong>${escapeHtml(user.name)}</strong>
            <button type="button" class="gallery-logout" onclick="discordLogout()">Log out</button>
        </div>
        <form id="gallery-form">
            <label class="gallery-file">
                <input type="file" id="gallery-file" accept="image/*" required>
                <span id="gallery-file-label"><i class="fas fa-image"></i> Choose a photo</span>
            </label>
            <input type="text" id="gallery-flight" placeholder="Flight number (e.g. EK247)" maxlength="24">
            <button type="submit" class="btn primary">Add to Gallery</button>
        </form>
        <p class="gallery-tool-note">Photos you add are kept in this browser and appear first in the rotation.</p>
    `;

    const form = document.getElementById('gallery-form');
    const fileInput = document.getElementById('gallery-file');
    const fileLabel = document.getElementById('gallery-file-label');
    const flightInput = document.getElementById('gallery-flight');

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        fileLabel.innerHTML = file
            ? `<i class="fas fa-check"></i> ${escapeHtml(file.name)}`
            : '<i class="fas fa-image"></i> Choose a photo';
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const file = fileInput.files[0];
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = () => {
            // Downscale so the photo fits comfortably in localStorage
            const image = new Image();
            image.onload = async () => {
                const maxSide = 1600;
                const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(image.width * scale);
                canvas.height = Math.round(image.height * scale);
                canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                const flight = (flightInput.value || '').trim() || 'Crew photo';
                const stored = getDiscordOauthToken();
                if (stored) {
                    try {
                        const response = await fetch('/api/photos', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${stored}` },
                            body: JSON.stringify({ dataUrl, flight })
                        });
                        const body = await response.json().catch(() => ({}));
                        if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
                        sharedGalleryPhotos.unshift(body.photo);
                        sharedGalleryLoaded = true;
                        renderGallery();
                        document.getElementById('gallery-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
                        return;
                    } catch (error) {
                        console.warn('Shared upload failed, keeping the photo local:', error.message);
                    }
                }
                const photos = loadUserGalleryPhotos();
                photos.unshift({ src: dataUrl, flight, by: getDiscordUser()?.name || 'Crew', ts: Date.now() });
                saveUserGalleryPhotos(photos);
                renderGallery();
                document.getElementById('gallery-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
            };
            image.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function initGalleryTool() {
    if (!document.getElementById('gallery-tool')) return;
    renderGallery();
    loadSharedGalleryPhotos();
}


// Theme toggle (works with the late-loaded header via delegation)
function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
    const icon = document.querySelector('#theme-toggle i');
    if (icon) icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

function initThemeToggle() {
    const current = document.documentElement.dataset.theme || 'light';
    applyTheme(current);
    document.addEventListener('click', (event) => {
        if (!event.target.closest('#theme-toggle')) return;
        applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });
}

// Duplicate the marquee content so the CSS -50% loop scrolls seamlessly
function initMarquee() {
    const track = document.getElementById('marquee-track');
    if (track) track.innerHTML += track.innerHTML;
}

// Flip clock, ported from the FIDS live clock
let previousClockValue = '';
let clockCleanupTimer;

function updateFlipClock() {
    const liveClock = document.getElementById('live-clock');
    if (!liveClock) return;

    const clockValue = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit', minute: '2-digit', hour12: false
    }).format(new Date()).replace(/\D/g, '');

    const cards = clockValue.split('').map((digit, index) => {
        const previous = previousClockValue[index] || digit;
        const changed = Boolean(previousClockValue) && previous !== digit;
        return `<span class="flip-card${changed ? ' is-flipping' : ''}">
            <span class="flip-card-face flip-card-current">${previous}</span>
            ${changed ? `<span class="flip-card-face flip-card-next">${digit}</span>` : ''}
        </span>`;
    });
    cards.splice(2, 0, '<span class="flip-separator" aria-hidden="true">:</span>');
    liveClock.innerHTML = cards.join('');
    liveClock.setAttribute('aria-label', `Current local time ${clockValue.slice(0, 2)}:${clockValue.slice(2)}`);
    previousClockValue = clockValue;

    if (liveClock.querySelector('.is-flipping')) {
        window.clearTimeout(clockCleanupTimer);
        clockCleanupTimer = window.setTimeout(() => {
            liveClock.querySelectorAll('.is-flipping').forEach((card) => {
                const nextDigit = card.querySelector('.flip-card-next')?.textContent;
                card.classList.remove('is-flipping');
                card.innerHTML = `<span class="flip-card-face flip-card-current">${nextDigit}</span>`;
            });
        }, 700);
    }
}

function initFlipClock() {
    if (!document.getElementById('live-clock')) return;
    updateFlipClock();
    const delay = 60_100 - (Date.now() % 60_000);
    window.setTimeout(() => {
        updateFlipClock();
        window.setInterval(updateFlipClock, 60_000);
    }, delay);
}

// Join page specific functionality
function initJoinPage() {
    setInterval(updateDiscordActivity, 15000);
}

function updateDiscordActivity() {
    const members = document.querySelectorAll('.member .status');
    members.forEach(member => {
        if (Math.random() < 0.1) {
            const statuses = ['online', 'idle'];
            const newStatus = statuses[Math.floor(Math.random() * statuses.length)];
            member.className = 'status';
            member.classList.add(newStatus);
        }
    });
}

// My Flights page functionality - DIRECT VERSION
function initializeMyFlightsDirect() {
    console.log('📍 Initializing My Flights page');
    
    checkAuth().then(userData => {
        if (userData.logged_in) {
            document.getElementById('login-prompt').style.display = 'none';
            document.getElementById('flights-content').style.display = 'block';
            document.getElementById('welcome-message').textContent = 
                `Welcome back, ${userData.user.global_name || userData.user.username}!`;
            loadUserFlights();
        } else {
            document.getElementById('login-prompt').style.display = 'block';
            document.getElementById('flights-content').style.display = 'none';
            const discordLoginPrompt = document.getElementById('discord-login-prompt');
            if (discordLoginPrompt) {
                discordLoginPrompt.addEventListener('click', function() {
                    window.location.href = `${BACKEND_URL}/auth/discord`;
                });
            }
        }
    }).catch(error => {
        console.error('Auth error:', error);
    });
}

// Load user flights - SIMPLE VERSION WITH CANCEL BUTTON
async function loadUserFlights() {
    const token = getToken();
    if (!token) {
        document.getElementById('flights-list').innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Please log in to view your flights.</p>
            </div>
        `;
        return;
    }
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/my-flights`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        
        const flightsList = document.getElementById('flights-list');
        const noFlights = document.getElementById('no-flights');
        
        if (data.success && data.flights && data.flights.length > 0) {
            let flightsHTML = '';
            
            data.flights.forEach((flight) => {
                flightsHTML += `
                <div class="flight-booking-card" data-pnr="${flight.pnr}">
                    <div class="flight-booking-header">
                        <div class="flight-route-large">
                            <span class="city">${flight.departure}</span>
                            <i class="fas fa-long-arrow-alt-right"></i>
                            <span class="city">${flight.destination}</span>
                        </div>
                        <div class="booking-status ${flight.status.toLowerCase()}">${flight.status}</div>
                    </div>
                    
                    <div class="flight-booking-details">
                        <div class="detail-group">
                            <label>Flight Number</label>
                            <span>${flight.flight_number}</span>
                        </div>
                        <div class="detail-group">
                            <label>PNR</label>
                            <span class="pnr-code">${flight.pnr}</span>
                        </div>
                        <div class="detail-group">
                            <label>Class</label>
                            <span>${flight.class}</span>
                        </div>
                        <div class="detail-group">
                            <label>Departure</label>
                            <span>${flight.departure_time} • ${flight.departure_name}</span>
                        </div>
                        <div class="detail-group">
                            <label>Arrival</label>
                            <span>${flight.arrival_time} • ${flight.destination_name}</span>
                        </div>
                        <div class="detail-group">
                            <label>Booking Date</label>
                            <span>${new Date(flight.booking_date).toLocaleDateString()}</span>
                        </div>
                    </div>
                    
                    <div class="flight-booking-actions">
                        <a href="${BACKEND_URL}/serve_image/${flight.pnr}" target="_blank" class="btn outline">
                            <i class="fas fa-download"></i> Download Itinerary
                        </a>
                        <button class="btn danger cancel-flight-btn" data-pnr="${flight.pnr}" 
                                style="background: #dc3545; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600; margin-left: 10px;"
                                onclick="cancelFlight('${flight.pnr}')">
                            <i class="fas fa-times"></i> Cancel Flight
                        </button>
                    </div>
                </div>
                `;
            });
            
            flightsList.innerHTML = flightsHTML;
            noFlights.style.display = 'none';
            flightsList.style.display = 'block';
        } else {
            flightsList.style.display = 'none';
            noFlights.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading flights:', error);
        document.getElementById('flights-list').innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading flights. Please try again.</p>
            </div>
        `;
    }
}

// CANCEL FLIGHT FUNCTION WITH CONFIRMATION AND BACKEND DELETION
async function cancelFlight(pnr) {
    // Show confirmation dialog
    const confirmed = confirm('Are you sure you want to cancel this flight? This action cannot be undone.');
    
    if (!confirmed) {
        console.log('Cancellation cancelled by user');
        return;
    }
    
    console.log('Cancelling flight:', pnr);
    
    const token = getToken();
    if (!token) {
        alert('Please log in to cancel flights');
        return;
    }
    
    try {
        // Call backend to delete the flight data
        const response = await fetch(`${BACKEND_URL}/api/cancel-flight`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ pnr: pnr })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Only remove from frontend if backend deletion was successful
            const flightCard = document.querySelector(`.flight-booking-card:has(button[onclick="cancelFlight('${pnr}')"])`);
            if (flightCard) {
                // Add smooth removal animation
                flightCard.style.transition = 'all 0.3s ease';
                flightCard.style.opacity = '0';
                flightCard.style.transform = 'translateX(-100%)';
                
                setTimeout(() => {
                    flightCard.remove();
                    console.log('Flight removed from page and backend');
                    
                    // Check if no flights left
                    const remainingFlights = document.querySelectorAll('.flight-booking-card');
                    if (remainingFlights.length === 0) {
                        document.getElementById('flights-list').style.display = 'none';
                        document.getElementById('no-flights').style.display = 'block';
                    }
                }, 300);
            }
        } else {
            alert('Failed to cancel flight: ' + result.error);
        }
    } catch (error) {
        console.error('Cancel flight error:', error);
        alert('Failed to cancel flight. Please try again.');
    }
}

// Global function to reinitialize components
function reinitComponents() {
    initNavigation();

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
}

// Video fallback: if the fleet video cannot load, hide it so the
// photographic background beneath the frame shows instead.
window.addEventListener('load', function() {
    const video = document.getElementById('bg-video');
    if (!video) return;

    const hideVideo = () => video.closest('.fleet-video-frame')?.classList.add('video-unavailable');

    video.addEventListener('error', hideVideo);
    setTimeout(function() {
        if (video.readyState === 0) hideVideo();
    }, 3000);
});

// Mobile-specific optimizations
function initMobileOptimizations() {
  // Prevent double-tap zoom
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function (event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, false);
  
  // Better touch handling
  if ('ontouchstart' in window) {
    document.documentElement.classList.add('touch-device');
  }
  
  // Load video only on desktop
  if (window.innerWidth > 768) {
    const video = document.getElementById('bg-video');
    if (video) {
      video.preload = 'auto';
    }
  }
}

// Make functions globally available for HTML onclick events
window.cancelFlight = cancelFlight;
window.reinitComponents = reinitComponents;
window.logout = logout;

// Force center header
document.addEventListener('DOMContentLoaded', function() {
    const userContainer = document.querySelector('.user-info-container');
    if (userContainer && userContainer.innerHTML.trim() === '') {
        userContainer.remove(); // Completely remove empty container
    }
});
