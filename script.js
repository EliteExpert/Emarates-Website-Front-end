const FIDS_URL = "https://emirates-ptfs-fids.onrender.com";
const BACKEND_URL = "https://emarates-website-production.up.railway.app";
const DISCORD_GUILD_ID = "1294732873143685160";
const OAUTH_STORE_KEY = "discord-oauth";
const DISCORD_INVITE = "https://discord.gg/PJVAvbJbdn";
const DISCORD_OAUTH_CLIENT_ID = "1550876222719004703";
const OAUTH_PKCE_KEY = "discord-pkce";

const SAMPLE_FLIGHTS = [
  { date: "2026-10-30", departureTime: "18:30", flightNumber: "EK 004", destination: "London (LHR)", aircraft: "A380", terminal: "3", status: "Boarding", type: "departure" },
  { date: "2026-10-31", departureTime: "01:15", flightNumber: "EK 318", destination: "Tokyo (NRT)", aircraft: "A380", terminal: "3", status: "Scheduled", type: "departure" },
  { date: "2026-10-31", departureTime: "09:40", flightNumber: "EK 202", destination: "New York (JFK)", aircraft: "A380", terminal: "3", status: "Scheduled", type: "departure" },
  { date: "2026-11-01", departureTime: "16:05", flightNumber: "EK 501", destination: "Mumbai (BOM)", aircraft: "777-300ER", terminal: "3", status: "Scheduled", type: "departure" }
];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  })[character]);
}

function getDiscordUser() {
  try { return JSON.parse(localStorage.getItem("discord-user")) || null; } catch { return null; }
}

function randomString(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function discordRedirectUri() { return new URL("index.html", location.href).href; }

function renderDiscordAuth(user, message = "") {
  document.querySelectorAll("[data-discord-auth]").forEach((button) => {
    button.classList.toggle("is-signed-in", Boolean(user));
    button.title = message || (user ? "Sign out of Discord" : "Sign in with Discord");
    if (user) {
      const avatar = user.avatar ? `<img class="auth-avatar" src="${escapeHtml(user.avatar)}" alt="">` : "";
      button.innerHTML = `${avatar}<span>${escapeHtml(user.name || "Community member")}</span>`;
      button.setAttribute("aria-label", "Sign out of Discord");
      button.onclick = discordLogout;
    } else {
      button.textContent = "Sign in";
      button.setAttribute("aria-label", "Sign in with Discord");
      button.onclick = startDiscordAuth;
    }
  });
  document.querySelectorAll("[data-auth-status]").forEach((element) => { element.textContent = message || (user ? `Signed in as ${user.name}` : "Not signed in"); });
}

async function startDiscordAuth() {
  if (!DISCORD_OAUTH_CLIENT_ID) { renderDiscordAuth(null, "Discord login is not configured yet."); return; }
  const verifier = randomString(48);
  const state = randomString(24);
  const challenge = await createCodeChallenge(verifier);
  localStorage.setItem(OAUTH_PKCE_KEY, JSON.stringify({ verifier, state, returnTo: location.pathname + location.search }));
  const params = new URLSearchParams({ client_id: DISCORD_OAUTH_CLIENT_ID, redirect_uri: discordRedirectUri(), response_type: "code", scope: "identify", state, code_challenge: challenge, code_challenge_method: "S256" });
  location.assign(`https://discord.com/oauth2/authorize?${params.toString()}`);
}

async function exchangeDiscordCode(code, verifier) {
  const body = new URLSearchParams({ client_id: DISCORD_OAUTH_CLIENT_ID, grant_type: "authorization_code", code, redirect_uri: discordRedirectUri(), code_verifier: verifier });
  const response = await fetch("https://discord.com/api/v10/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error("Discord token exchange failed.");
  return response.json();
}

async function fetchDiscordProfile(token) {
  const response = await fetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Discord profile could not be loaded.");
  return response.json();
}

async function refreshDiscordToken(stored) {
  if (!stored?.refresh_token) return stored;
  const body = new URLSearchParams({ client_id: DISCORD_OAUTH_CLIENT_ID, grant_type: "refresh_token", refresh_token: stored.refresh_token });
  const response = await fetch("https://discord.com/api/v10/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) throw new Error("Discord session expired.");
  const next = await response.json();
  const refreshed = { ...next, token: next.access_token, expires_at: Date.now() + (Number(next.expires_in) || 604800) * 1000 };
  localStorage.setItem(OAUTH_STORE_KEY, JSON.stringify(refreshed));
  return refreshed;
}

async function initDiscordAuth() {
  const query = new URLSearchParams(location.search);
  const fragment = new URLSearchParams(location.hash.slice(1));
  if (fragment.get("access_token")) {
    localStorage.setItem(OAUTH_STORE_KEY, JSON.stringify({ token: fragment.get("access_token"), expires_at: Date.now() + (Number(fragment.get("expires_in")) || 604800) * 1000 }));
    history.replaceState({}, document.title, location.pathname);
  }
  if (query.get("error")) {
    localStorage.removeItem(OAUTH_PKCE_KEY);
    history.replaceState({}, document.title, location.pathname);
    renderDiscordAuth(null, "Discord sign-in was cancelled.");
    return;
  }
  if (query.get("code")) {
    const pending = (() => { try { return JSON.parse(localStorage.getItem(OAUTH_PKCE_KEY)); } catch { return null; } })();
    if (!pending || pending.state !== query.get("state")) {
      renderDiscordAuth(null, "Discord sign-in could not be verified.");
      return;
    }
    try {
      const token = await exchangeDiscordCode(query.get("code"), pending.verifier);
      localStorage.setItem(OAUTH_STORE_KEY, JSON.stringify({ ...token, token: token.access_token, expires_at: Date.now() + (Number(token.expires_in) || 604800) * 1000 }));
      localStorage.removeItem(OAUTH_PKCE_KEY);
      history.replaceState({}, document.title, location.pathname);
      if (pending.returnTo && pending.returnTo !== location.pathname) { location.replace(pending.returnTo); return; }
    } catch (error) { renderDiscordAuth(null, error.message); }
  }
  let stored = (() => { try { return JSON.parse(localStorage.getItem(OAUTH_STORE_KEY)); } catch { return null; } })();
  if (stored?.expires_at && stored.expires_at < Date.now() + 60000) {
    try { stored = await refreshDiscordToken(stored); } catch { stored = null; localStorage.removeItem(OAUTH_STORE_KEY); localStorage.removeItem("discord-user"); }
  }
  if (!stored?.token || stored.expires_at <= Date.now()) { renderDiscordAuth(null); return; }
  try {
    const profile = await fetchDiscordProfile(stored.token);
    const user = { id: profile.id, name: profile.global_name || profile.username, avatar: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=64` : null };
    localStorage.setItem("discord-user", JSON.stringify(user));
    window.__discordToken = stored.token;
    renderDiscordAuth(user);
    window.dispatchEvent(new CustomEvent("discord-auth-changed"));
  } catch (error) {
    localStorage.removeItem(OAUTH_STORE_KEY); localStorage.removeItem("discord-user"); delete window.__discordToken;
    renderDiscordAuth(null, error.message);
  }
}

function discordLogout() {
  localStorage.removeItem(OAUTH_STORE_KEY);
  localStorage.removeItem(OAUTH_PKCE_KEY);
  localStorage.removeItem("discord-user");
  delete window.__discordToken;
  renderDiscordAuth(null, "Signed out of Discord.");
  window.dispatchEvent(new CustomEvent("discord-auth-changed"));
}
window.discordLogout = discordLogout;

function flightTimestamp(flight) {
  const date = flight.date || new Date().toISOString().slice(0, 10);
  const time = flight.departureTime || flight.arrivalTime || "00:00";
  const timestamp = Date.parse(`${date}T${time}:00Z`);
  return Number.isNaN(timestamp) ? Date.now() : timestamp;
}

function normalizeFlight(flight) {
  return { ...flight, scheduledTs: flight.scheduledTs || flightTimestamp(flight), flightNumber: flight.flightNumber || flight.flight_number || "EK —", destination: flight.destination || flight.destination_name || "Dubai (DXB)", aircraft: flight.aircraft || "A380", status: flight.status || "Scheduled", type: flight.type || "departure" };
}

async function fetchWeeklyFlights() {
  try {
    const response = await fetch(`${FIDS_URL}/api/flights`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Flight service unavailable");
    const payload = await response.json();
    const flights = Array.isArray(payload) ? payload : payload.flights;
    if (!Array.isArray(flights) || !flights.length) throw new Error("No flight data");
    return flights.map(normalizeFlight).sort((a, b) => a.scheduledTs - b.scheduledTs);
  } catch (error) {
    console.warn("Using local flight board fallback:", error.message);
    return SAMPLE_FLIGHTS.map(normalizeFlight);
  }
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(timestamp));
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(timestamp)).toUpperCase();
}

function cityName(value) {
  return String(value || "Dubai").replace(/\s*\([A-Z]{3}\)\s*$/, "");
}

function codeName(value) {
  const match = String(value || "").match(/\(([A-Z]{3})\)/);
  return match ? match[1] : "DXB";
}

function airlineTailMarkup(flightNumber) {
  const code = String(flightNumber || "").trim().toUpperCase().match(/^([A-Z]{2})/)?.[1];
  const tails = {
    EK: { src: "assets/emirates-tail.png", alt: "Emirates" },
    FZ: { src: "assets/flydubai-tail.png", alt: "flydubai" }
  };
  const tail = tails[code];
  return tail
    ? `<img class="flight-tail-logo" src="${tail.src}" alt="${tail.alt} tail logo">`
    : '<span class="flight-tail-logo flight-tail-placeholder" aria-hidden="true"></span>';
}

function flightRow(flight) {
  const destination = cityName(flight.destination);
  const code = codeName(flight.destination);
  return `<article class="flight-row" data-flight-search="${escapeHtml(`${flight.flightNumber} ${destination} ${flight.aircraft} ${flight.status}`.toLowerCase())}">
    <time datetime="${new Date(flight.scheduledTs).toISOString()}"><span class="flight-time-value">${formatTime(flight.scheduledTs)}</span><small>${formatDate(flight.scheduledTs)}</small></time>
    ${airlineTailMarkup(flight.flightNumber)}
    <div class="flight-route"><span class="flight-code">${escapeHtml(flight.flightNumber)}</span><strong>Dubai <span aria-hidden="true">→</span> ${escapeHtml(destination)}</strong><small>DXB → ${escapeHtml(code)}</small></div>
    <div class="flight-aircraft"><small>Aircraft</small><strong>${escapeHtml(flight.aircraft)}</strong></div>
    <div class="flight-terminal"><small>Terminal</small><strong>Terminal ${escapeHtml(flight.terminal || "3")}</strong></div>
    <span class="flight-state">${escapeHtml(flight.status)}</span>
  </article>`;
}

function renderBoard(list, flights, emptyMessage = "No flights match your search.") {
  if (!list) return;
  list.innerHTML = flights.length ? flights.map(flightRow).join("") : `<div class="empty-board">${emptyMessage}</div>`;
}

function initFlightBoards() {
  const fullBoard = document.getElementById("weekly-flights-list");
  const homeBoard = document.getElementById("home-board");
  if (!fullBoard && !homeBoard) return;
  fetchWeeklyFlights().then((flights) => {
    if (homeBoard) renderBoard(homeBoard, flights.filter((flight) => flight.scheduledTs > Date.now()).slice(0, 4));
    if (!fullBoard) return;
    const search = document.getElementById("flight-search");
    const count = document.getElementById("board-status");
    const activeAirline = { value: "all" };
    const update = () => {
      const query = (search?.value || "").trim().toLowerCase();
      const visible = flights.filter((flight) => {
        const airlineCode = String(flight.flightNumber).slice(0, 2).toUpperCase();
        const matchesAirline = activeAirline.value === "all" || (activeAirline.value === "other" ? airlineCode !== "EK" && airlineCode !== "FZ" : airlineCode === activeAirline.value);
        return matchesAirline && (!query || `${flight.flightNumber} ${flight.destination} ${flight.aircraft} ${flight.status}`.toLowerCase().includes(query));
      });
      renderBoard(fullBoard, visible);
      if (count) count.textContent = `${visible.length} ${visible.length === 1 ? "flight" : "flights"} listed · Updated just now`;
    };
    search?.addEventListener("input", update);
    document.querySelectorAll("[data-airline]").forEach((button) => button.addEventListener("click", () => {
      activeAirline.value = button.dataset.airline;
      document.querySelectorAll("[data-airline]").forEach((item) => item.classList.toggle("is-active", item === button));
      update();
    }));
    update();
  });
}

function initRouteSearch() {
  document.querySelectorAll("[data-route-search]").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault();
    const from = form.querySelector("[name=from]")?.value || "Dubai (DXB)";
    const to = form.querySelector("[name=to]")?.value || "London (LHR)";
    const date = form.querySelector("[name=depart]")?.value || "14 Nov 2026";
    const feedback = form.querySelector(".form-feedback") || document.getElementById("search-feedback");
    if (feedback) feedback.textContent = `Flight options ready for ${from} → ${to} · ${date}`;
    const board = document.getElementById("upcoming");
    if (board) board.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  document.querySelectorAll(".booking-tabs button").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll(".booking-tabs button").forEach((item) => item.classList.toggle("is-active", item === button));
  }));
}

function initNavigation() {
  const header = document.querySelector("[data-header]");
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".site-nav-links");
  const current = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav]").forEach((link) => link.classList.toggle("is-active", link.dataset.nav === current));
  const updateHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 20);
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
  toggle?.addEventListener("click", () => {
    const open = links?.classList.toggle("is-open");
    toggle.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(Boolean(open)));
    document.body.classList.toggle("nav-open", Boolean(open));
  });
}

function initReveal() {
  const elements = document.querySelectorAll("[data-reveal]");
  if (!elements.length || !("IntersectionObserver" in window)) { elements.forEach((element) => element.classList.add("is-visible")); return; }
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); } }), { threshold: .12 });
  elements.forEach((element) => observer.observe(element));
}

function initClock() {
  const clocks = document.querySelectorAll("[data-clock]");
  const update = () => clocks.forEach((clock) => { clock.textContent = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" }).format(new Date()) + " UTC"; });
  update();
  if (clocks.length) window.setInterval(update, 1000);
}

function initJoinForm() {
  document.querySelector(".join-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const feedback = event.currentTarget.querySelector(".join-feedback");
    if (feedback) feedback.textContent = "Application captured. The community team will be in touch via Discord.";
    event.currentTarget.reset();
  });
}

async function loadPartial(id, path) {
  const target = document.getElementById(id);
  if (!target) return;
  try { target.innerHTML = await (await fetch(path)).text(); } catch (error) { console.warn(`Could not load ${path}`, error); }
}

function initFooterYear() { const year = document.getElementById("footer-year"); if (year) year.textContent = new Date().getFullYear(); }
function initVideo() { document.querySelectorAll("video").forEach((video) => video.play().catch(() => {})); }
function initImageFallbacks() {
  document.querySelectorAll("img").forEach((image) => {
    const fallback = () => {
      if (image.dataset.fallbackApplied) return;
      image.dataset.fallbackApplied = "true";
      image.src = "assets/photos/fleet-takeoff-day.png";
    };
    image.addEventListener("error", fallback, { once: true });
    if (image.complete && image.naturalWidth === 0) fallback();
  });
}

async function boot() {
  await Promise.all([loadPartial("header", "components/header.html"), loadPartial("footer", "components/footer.html")]);
  initNavigation();
  await initDiscordAuth();
  initRouteSearch();
  initFlightBoards();
  initReveal();
  initClock();
  initJoinForm();
  initFooterYear();
  initVideo();
  initImageFallbacks();
}

document.addEventListener("DOMContentLoaded", boot);
