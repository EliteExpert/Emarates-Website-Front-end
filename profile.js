// Skywards profile page: miles, tier and claiming miles for flown FIDS flights.
// The Discord session itself is handled by script.js (window.__discordToken
// is set there after sign-in; 'discord-auth-changed' fires on changes).
const MILES_TIER_CLASS = { Blue: "tier-blue", Silver: "tier-silver", Gold: "tier-gold", Platinum: "tier-platinum" };

function profileAuthHeaders() {
  return window.__discordToken ? { Authorization: `Bearer ${window.__discordToken}` } : {};
}

function showProfileGate() {
  document.getElementById("profile-gate").hidden = false;
  document.getElementById("profile-view").hidden = true;
}

function formatMiles(value) {
  return new Intl.NumberFormat("en-GB").format(Math.round(value));
}

function renderProfile(data) {
  document.getElementById("profile-gate").hidden = true;
  document.getElementById("profile-view").hidden = false;
  const name = document.getElementById("profile-name");
  const avatar = document.getElementById("profile-avatar");
  name.textContent = data.user?.name || "Member";
  if (data.user?.avatar) {
    avatar.src = data.user.avatar;
    avatar.hidden = false;
  } else {
    avatar.hidden = true;
  }
  document.getElementById("profile-skywards-number").textContent = data.skywardsNumber || "";
  const tierClass = MILES_TIER_CLASS[data.tier.tier] || "tier-blue";
  const tierName = document.getElementById("profile-tier-name");
  tierName.textContent = data.tier.tier;
  tierName.classList.forEach((cls) => { if (cls.startsWith("tier-")) tierName.classList.remove(cls); });
  tierName.classList.add(tierClass);
  document.getElementById("profile-tier-bonus").textContent = data.tier.bonusPct
    ? `+${data.tier.bonusPct}% tier bonus on every flight`
    : "Earn bonus miles as you move up the tiers";
  document.getElementById("profile-miles").textContent = formatMiles(data.miles);
  document.getElementById("tier-fill").style.width = `${data.tier.progressPct}%`;
  const note = document.getElementById("tier-note");
  if (data.tier.nextTier) {
    note.innerHTML = `${formatMiles(Math.max(0, data.tier.upgradeCost - data.miles))} miles to the ${escapeHtml(data.tier.nextTier)} upgrade (${formatMiles(data.tier.upgradeCost)} miles) — <a href="https://discord.gg/PJVAvbJbdn" target="_blank" rel="noopener">upgrade in Discord ↗</a>`;
  } else {
    note.textContent = "You are at the top tier. Thank you for flying with the operation.";
  }
  renderLedger(data.ledger || []);
}

function renderLedger(entries) {
  const list = document.getElementById("ledger-list");
  if (!entries.length) {
    list.innerHTML = '<div class="empty-board">No miles yet — claim your first flown departure.</div>';
    return;
  }
  list.innerHTML = entries.map((entry) => {
    const amount = entry.miles < 0 ? `−${formatMiles(Math.abs(entry.miles))}` : `+${formatMiles(entry.miles)}`;
    const detail = [entry.kind === "flight" ? String(entry.label).replace(/\s*\|\s*/, " · ") : entry.label, entry.detail]
      .filter(Boolean).map((part) => escapeHtml(part)).join(" · ");
    return `
    <div class="ledger-row">
      <div class="ledger-reason"><strong>${detail}</strong><small>${entry.kind === "purchase" ? "Redeemed in the Discord shop" : entry.kind === "event" ? "Discord event" : "Flown flight"}</small></div>
      <span class="ledger-miles${entry.miles < 0 ? " ledger-debit" : ""}">${amount}</span>
    </div>`;
  }).join("");
}

async function loadProfile() {
  if (!window.__discordToken) { showProfileGate(); return; }
  const errorBox = document.getElementById("profile-error");
  errorBox.hidden = true;
  try {
    const response = await fetch("/api/profile", { headers: profileAuthHeaders() });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) { showProfileGate(); return; }
    if (!response.ok) throw new Error(payload.error || "The miles service is unavailable right now.");
    renderProfile(payload);
    await loadClaimableFlights();
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
  }
}

// Flight keys claimed during this session, so buttons render as claimed
// right away; the server enforces the same rule for everyone else.
const CLAIM_STATE_BUTTONS = {
  "already-claimed": { text: "Claimed ✓", cls: "is-claimed" },
  "awarded-in-discord": { text: "Awarded in Discord ✓", cls: "is-claimed" },
  "not-subscribed": { text: "Not checked in", cls: "claim-blocked" },
  "no-event": { text: "No Discord event", cls: "claim-blocked" }
};

async function loadClaimableFlights() {
  const list = document.getElementById("claim-list");
  if (!window.__discordToken) {
    list.innerHTML = '<div class="empty-board">Sign in to see which flights you can claim.</div>';
    return;
  }
  try {
    const response = await fetch("/api/claim", { headers: profileAuthHeaders() });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      list.innerHTML = '<div class="empty-board">Sign in to see which flights you can claim.</div>';
      return;
    }
    if (!response.ok) throw new Error(payload.error || "The flight board is unreachable right now.");
    const flights = payload.flights || [];
    if (!flights.length) {
      list.innerHTML = '<div class="empty-board">No departed flights on the FIDS board yet — check back after the next departure.</div>';
      return;
    }
    list.innerHTML = flights.map((flight) => {
      const destination = String(flight.destination || "").replace(/\s*\([A-Z]{3}\)\s*$/, "");
      const blocked = CLAIM_STATE_BUTTONS[flight.claimState];
      const button = blocked
        ? `<button class="button button-red claim-button ${blocked.cls}" type="button" disabled>${blocked.text}</button>`
        : `<button class="button button-red claim-button" type="button" data-claim-flight="${escapeHtml(flight.flightNumber)}" data-claim-date="${escapeHtml(flight.date)}">Claim +${formatMiles(flight.estimatedMiles)} miles</button>`;
      const eventLine = flight.event
        ? `<small class="claim-event">Discord event: ${escapeHtml(flight.event.name)}</small>`
        : '<small class="claim-event">No Discord event linked — staff can link one on the FIDS board.</small>';
      return `
      <div class="claim-row">
        <div class="claim-route"><strong>${escapeHtml(flight.flightNumber)}</strong><small>${escapeHtml(flight.date)} · ${escapeHtml(String(flight.departureTime))} UTC · Dubai → ${escapeHtml(destination)}</small>${eventLine}</div>
        ${button}
      </div>`;
    }).join("");
  } catch (error) {
    list.innerHTML = `<div class="empty-board">${escapeHtml(error.message)}</div>`;
  }
}

async function claimFlight(button) {
  button.disabled = true;
  button.textContent = "Claiming…";
  try {
    const response = await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...profileAuthHeaders() },
      body: JSON.stringify({ flightNumber: button.dataset.claimFlight, date: button.dataset.claimDate })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Could not claim miles.");
    button.textContent = `+${formatMiles(payload.earned)} miles`;
    button.classList.add("is-claimed");
    await loadProfile();
  } catch (error) {
    button.disabled = false;
    button.textContent = error.message;
    window.setTimeout(() => { button.textContent = "Claim miles"; }, 3500);
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-claim-flight]");
  if (button && !button.disabled) claimFlight(button);
});
window.addEventListener("discord-auth-changed", loadProfile);
document.addEventListener("DOMContentLoaded", () => window.setTimeout(() => { loadProfile(); loadClaimableFlights(); }, 150));
