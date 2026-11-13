import io

# --- 1. ife.js (their version) + recap window, auth wait, loading view ---
js = io.open('ife.js', encoding='utf-8').read()

# 1a. Auth wait helper (before ifeDestinationCity)
anchor = 'function ifeDestinationCity(flight) {'
wait_fn = u'''async function ifeWaitAuth() {
    // script.js settles the Discord OAuth state shortly after load; the IFE
    // waits for it so a fresh login is recognized without a reload.
    const deadline = Date.now() + 5000;
    while (window.__authSettled !== true && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
}

''' + anchor
assert anchor in js, 'dest city anchor'
js = js.replace(anchor, wait_fn, 1)

# 1b. Loading view fills the screen body while data loads
old_shell = u'''                <div class="ice-body" id="ice-body"></div>
            </div>'''
new_shell = u'''                <div class="ice-body" id="ice-body">${iceLoadingView()}</div>
            </div>'''
assert old_shell in js, 'shell body'
js = js.replace(old_shell, new_shell, 1)

loading_fn = u'''function iceLoadingView() {
    return `
        <div class="ice-loading">
            <i class="fas fa-circle-notch fa-spin"></i>
            <p>Preparing your entertainment\u2026</p>
        </div>
    `;
}

''' + u'function iceTopbarUpdate(flight) {'
assert u'function iceTopbarUpdate(flight) {' in js
js = js.replace(u'function iceTopbarUpdate(flight) {', loading_fn, 1)

# 1c. Recap window in initIfe
old_select = u'''    const airborne = ifeFlights
        .map((flight) => ({ flight, state: ifeFlightState(flight) }))
        .filter((entry) => entry.state.state === 'airborne')
        .sort((a, b) => b.flight.scheduledTs - a.flight.scheduledTs);
    ifeActive = airborne[0] || null;'''
new_select = u'''    // A flight stays viewable for 7 days after departure (the FIDS retains
    // the record, including the Discord event link, for exactly that long):
    // live while airborne, then as a recap of the completed flight.
    const RETENTION_MS = 7 * 86400000;
    const candidates = ifeFlights
        .map((flight) => {
            const state = ifeFlightState(flight);
            if (state.state === 'arrived' && Date.now() - flight.scheduledTs < RETENTION_MS) {
                state.recap = true;
                state.progress = 1;
            }
            return { flight, state };
        })
        .filter((entry) => entry.state.state === 'airborne' || entry.state.recap)
        .sort((a, b) => b.flight.scheduledTs - a.flight.scheduledTs);
    ifeActive = candidates[0] || null;'''
assert old_select in js, 'selection'
js = js.replace(old_select, new_select, 1)

# 1d. Wait for auth at the top of initIfe
old_boot = u'''async function initIfe() {
    if (!ifeRoot) return;

    iceShell();'''
new_boot = u'''async function initIfe() {
    if (!ifeRoot) return;

    await ifeWaitAuth();
    iceShell();'''
assert old_boot in js, 'boot'
js = js.replace(old_boot, new_boot, 1)

# 1e. Recap label on the side box
old_h4 = u'''                <h4><i class="fas fa-route"></i> Now flying</h4>'''
new_h4 = u'''                <h4><i class="fas fa-route"></i> ${active.state.recap ? 'Flight recap' : 'Now flying'}</h4>'''
assert old_h4 in js, 'side h4'
js = js.replace(old_h4, new_h4, 1)

# 1f. Information panel: Discord event link (retained 7 days)
old_term = u'''                <li><span>Terminal</span><strong>${ifeEscape(flight.terminal || 'T3')}</strong></li>
            </ul>'''
new_term = u'''                <li><span>Terminal</span><strong>${ifeEscape(flight.terminal || 'T3')}</strong></li>
                <li><span>Discord event</span>${flight.discordEvent ? `<a class="event-chip" href="${ifeEscape(flight.discordEvent)}" target="_blank" rel="noopener">View event \u21d7</a>` : '<strong>Not filed</strong>'}</li>
            </ul>'''
assert old_term in js, 'terminal row'
js = js.replace(old_term, new_term, 1)

io.open('ife.js', 'w', encoding='utf-8').write(js)
print('ife.js patched on top of their version')

# --- 2. script.js (their version) + auth flag + profile link ---
sjs = io.open('script.js', encoding='utf-8').read()

old_start = u'''async function initDiscordAuth() {'''
new_start = u'''async function initDiscordAuth() {
    window.__authSettled = false;'''
assert old_start in sjs, 'script auth start'
sjs = sjs.replace(old_start, new_start, 1)

old_set = u'''    renderGalleryTool();
    window.dispatchEvent(new CustomEvent('discord-auth-changed'));
}'''
new_set = u'''    renderGalleryTool();
    window.dispatchEvent(new CustomEvent('discord-auth-changed'));
    window.__authSettled = true;
}'''
assert old_set in sjs, 'script auth end'
sjs = sjs.replace(old_set, new_set, 1)

old_id = u'''        <div class="gallery-identity">${avatar} Adding as <strong>${escapeHtml(user.name)}</strong>
            <button type="button" class="gallery-logout" onclick="discordLogout()">Log out</button>
        </div>'''
new_id = u'''        <div class="gallery-identity">${avatar} Adding as <a class="gallery-profile" href="https://discord.com/users/${escapeHtml(user.id)}" target="_blank" rel="noopener" title="View profile"><strong>${escapeHtml(user.name)}</strong></a>
            <button type="button" class="gallery-logout" onclick="discordLogout()">Log out</button>
        </div>'''
assert old_id in sjs, 'identity row'
sjs = sjs.replace(old_id, new_id, 1)

io.open('script.js', 'w', encoding='utf-8').write(sjs)
print('script.js patched on top of their version')
