// Online check-in page: pick a departure, get a seat from the aircraft's
// cabin layout, and a boarding pass from the Emarates boarding-pass service.
// The Discord session itself is handled by script.js (window.__discordToken
// is set there after sign-in; 'discord-auth-changed' fires on changes).

function checkinAuthHeaders() {
  return window.__discordToken ? { Authorization: `Bearer ${window.__discordToken}` } : {};
}

function showCheckinGate() {
  document.getElementById("checkin-gate").hidden = false;
  document.getElementById("checkin-view").hidden = true;
  document.getElementById("checkin-list").innerHTML = '<div class="empty-board">Sign in to see your check-ins.</div>';
}

function upcomingDepartures(flights) {
  const now = Date.now();
  const windowMs = 7 * 86400000;
  return (Array.isArray(flights) ? flights : [])
    .filter((flight) => flight.type === "departure" && !/cancel/i.test(flight.status || ""))
    .map((flight) => ({ ...flight, scheduledTs: Date.parse(`${flight.date}T${flight.departureTime || "00:00"}:00Z`) }))
    .filter((flight) => !Number.isNaN(flight.scheduledTs) && flight.scheduledTs > now && flight.scheduledTs - now < windowMs)
    .sort((a, b) => a.scheduledTs - b.scheduledTs);
}

async function loadFlightPicker() {
  const select = document.getElementById("checkin-flight");
  if (!select) return;
  try {
    const response = await fetch("/api/flights");
    if (!response.ok) throw new Error(`The flight board is unreachable (${response.status}).`);
    const flights = await response.json();
    const upcoming = upcomingDepartures(flights);
    select.innerHTML = "";
    if (!upcoming.length) {
      const option = document.createElement("option");
      option.textContent = "No upcoming departures on the board yet";
      option.disabled = true;
      select.appendChild(option);
      document.getElementById("checkin-submit").disabled = true;
      return;
    }
    upcoming.forEach((flight) => {
      const option = document.createElement("option");
      option.value = JSON.stringify({ flightNumber: flight.flightNumber, date: flight.date });
      option.textContent = `${flight.flightNumber} · ${flight.date} · ${flight.departureTime} GMT · ${String(flight.destination || "").replace(/\s*\([A-Z]{3}\)\s*$/, "")} · ${flight.aircraft}`;
      select.appendChild(option);
    });
    document.getElementById("checkin-submit").disabled = false;
  } catch (error) {
    select.innerHTML = "";
    const option = document.createElement("option");
    option.textContent = "The flight board is unreachable right now";
    option.disabled = true;
    select.appendChild(option);
    document.getElementById("checkin-submit").disabled = true;
  }
}

async function loadCheckins() {
  const list = document.getElementById("checkin-list");
  if (!window.__discordToken) return;
  try {
    const response = await fetch("/api/checkin", { headers: checkinAuthHeaders() });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) return;
    if (!response.ok) throw new Error(payload.error || "The check-in service is unavailable right now.");
    const checkins = payload.checkins || [];
    if (!checkins.length) {
      list.innerHTML = '<div class="empty-board">No check-ins yet — pick a departure above when one is on the board.</div>';
      return;
    }
    list.innerHTML = checkins.map((entry) => `
      <div class="claim-row">
        <div class="claim-route"><strong>${escapeHtml(entry.flightNumber)}</strong><small>${escapeHtml(entry.date)} · Seat <strong class="checkin-seat-badge">${escapeHtml(entry.seat)}</strong> · ${escapeHtml(entry.cabin)} · ${escapeHtml(entry.aircraft)}</small>
          ${entry.passUrl ? `<small class="claim-event"><a class="checkin-pass-link" href="${escapeHtml(entry.passUrl)}" target="_blank" rel="noopener">Open boarding pass ↗</a></small>` : ""}
        </div>
        ${entry.passUrl ? `<a href="${escapeHtml(entry.passUrl)}" target="_blank" rel="noopener"><img class="checkin-thumb" src="${escapeHtml(entry.passUrl)}" alt="Boarding pass for ${escapeHtml(entry.flightNumber)}" loading="lazy"></a>` : ""}
      </div>`).join("");
  } catch (error) {
    list.innerHTML = `<div class="empty-board">${escapeHtml(error.message)}</div>`;
  }
}

async function submitCheckin() {
  const button = document.getElementById("checkin-submit");
  const select = document.getElementById("checkin-flight");
  const errorBox = document.getElementById("checkin-error");
  const result = document.getElementById("checkin-result");
  errorBox.hidden = true;
  result.hidden = true;

  let payload;
  try {
    payload = JSON.parse(select.value);
  } catch {
    errorBox.textContent = "Pick a departure first.";
    errorBox.hidden = false;
    return;
  }

  button.disabled = true;
  button.textContent = "Checking in…";
  try {
    const response = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...checkinAuthHeaders() },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      // Already checked in: the server returns the existing seat and pass.
      if (response.status === 409 && body.seat) {
        seatLine.innerHTML = `You are already checked in — seat <strong>${escapeHtml(body.seat)}</strong>.`;
        result.hidden = false;
        const pass = document.getElementById("checkin-pass");
        if (body.passUrl) { pass.src = body.passUrl; pass.hidden = false; const link = document.getElementById("checkin-pass-link"); if (link) { link.href = body.passUrl; link.hidden = false; } }
        await loadCheckins();
        return;
      }
      throw new Error(body.error || "Check-in could not complete right now.");
    }

    result.hidden = false;
    const seatLine = document.getElementById("checkin-seat-line");
    seatLine.innerHTML = `Seat <strong>${escapeHtml(body.seat)}</strong> · ${escapeHtml(body.cabin)} · ${escapeHtml(body.aircraft)} — boarding pass below.`;
    const pass = document.getElementById("checkin-pass");
    if (body.passUrl) {
      pass.src = body.passUrl;
      pass.hidden = false;
      const link = document.getElementById("checkin-pass-link");
      link.href = body.passUrl;
      link.hidden = false;
    }
    await loadCheckins();
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = "Check in & assign seat";
  }
}

function showCheckinSignedIn() {
  document.getElementById("checkin-gate").hidden = true;
  document.getElementById("checkin-view").hidden = false;
}

document.addEventListener("click", (event) => {
  if (event.target.closest("#checkin-submit")) submitCheckin();
});
window.addEventListener("discord-auth-changed", () => {
  const signedIn = Boolean(window.__discordToken);
  if (signedIn) {
    showCheckinSignedIn();
    loadFlightPicker();
    loadCheckins();
  } else {
    showCheckinGate();
  }
});
document.addEventListener("DOMContentLoaded", () => window.setTimeout(() => {
  if (window.__discordToken) {
    showCheckinSignedIn();
    loadFlightPicker();
    loadCheckins();
  } else {
    showCheckinGate();
    // script.js settles the Discord session shortly after load; the
    // discord-auth-changed listener re-renders this page when it does.
  }
}, 150));
